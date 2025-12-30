import { addonBuilder } from 'stremio-addon-sdk';
import addonSDK from 'stremio-addon-sdk';
import { fetchMovies } from './rlsbb.js';
import { fetchMoviesFromReddit } from './reddit.js';
import { fetchSeriesFromMDBList, fetchMoviesFromMDBList } from './mdblist.js';
import { getMovieByImdbId, getSeriesByImdbId } from './cinemeta.js';
import { getRPDBPosterUrl } from './rpdb.js';
import { validateCode } from './supporters.js';

const { serveHTTP } = addonSDK;

// Configuration
const PORT = process.env.PORT || 7000;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT = 25000; // 25 seconds - Stremio times out around 30s

// Simple in-memory cache - separate cache for each sort type
const catalogCache = {};
const cacheTimestamp = {};
const seriesCatalogCache = {};
const seriesCacheTimestamp = {};

// Track if a fetch is in progress to avoid duplicate fetches
let movieFetchInProgress = false;
let seriesFetchInProgress = false;

/**
 * Helper to wrap a promise with a timeout
 */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

// Addon manifest
const manifest = {
  id: 'community.movieleaks.v3',
  version: '2.5.0',
  name: 'Movie Leaks Catalog',
  description: 'HD Movies & Series - Latest Releases. Report bugs: https://github.com/Zerr0-C00L/MovieLeaks-Issues/issues',
  logo: 'https://i.imgur.com/hovSkIN.png',
  resources: ['catalog', 'meta'],
  types: ['movie', 'series'],
  stremioAddonsConfig: {
    issuer: 'https://stremio-addons.net',
    signature: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..zlTlArrwEGcRhH15mu0v0g.X_8XIWZEG_nGTh_zBdkUmhKXaR_E8m8UcaBzKDTlVj0AuN-kQPyNzT2BzgqWtfvrVSML4Uo6Zdd9gzv1NIMHe8B5maFTIMetX577u4lrwpJagLVnjUtFY09Uzq3mdBxw.UCTvBwP1JTLeJAUTzZP71Q'
  },
  catalogs: [
    {
      type: 'movie',
      id: 'movieleaks',
      name: 'Latest Releases',
      posterShape: 'poster',
      extra: [
        {
          name: 'genre',
          isRequired: false,
          options: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'],
          optionsLimit: 1
        },
        {
          name: 'skip',
          isRequired: false
        }
      ]
    },
    {
      type: 'series',
      id: 'seriesleaks',
      name: 'Latest Series',
      posterShape: 'poster',
      extra: [
        {
          name: 'genre',
          isRequired: false,
          options: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'],
          optionsLimit: 1
        },
        {
          name: 'skip',
          isRequired: false
        }
      ]
    }
  ],
  config: [
    {
      key: 'supporter_code',
      type: 'text',
      title: '💎 Supporter Code - Get unlimited access: https://ko-fi.com/summary/c5818b97-d200-406e-abbc-6384d2f58cb7',
      required: false,
      default: ''
    },
    {
      key: 'rpdb_api_key',
      type: 'text',
      title: '🎨 RPDB API Key (Optional)',
      required: false,
      default: ''
    }
  ],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  },
  idPrefixes: ['tt', 'ml']
};

const builder = new addonBuilder(manifest);

/**
 * Helper function to handle series catalog requests
 */
async function handleSeriesCatalog({ skip, genre, isSupporter, canUseRPDB, rpdbApiKey }) {
  const PAGE_SIZE = 100;
  const FREE_TIER_LIMIT = 100;
  
  // Check cache
  const now = Date.now();
  const cacheKey = 'all';
  const hasFreshCache = seriesCatalogCache[cacheKey] && seriesCacheTimestamp[cacheKey] && (now - seriesCacheTimestamp[cacheKey]) < CACHE_DURATION;
  const hasAnyCache = seriesCatalogCache[cacheKey] && seriesCatalogCache[cacheKey].length > 0;
  
  // Helper function to return data from cache
  const returnFromCache = (cache) => {
    console.log(`Returning cached series catalog (${cache.length} total items, skip=${skip})`);
    
    // Filter by genre if specified
    let filteredMetas = cache;
    if (genre) {
      filteredMetas = cache.filter(meta => 
        meta.genres && meta.genres.includes(genre)
      );
      console.log(`Filtered to ${filteredMetas.length} series in genre: ${genre}`);
    }
    
    // Apply tier limits
    const tierLimit = isSupporter ? filteredMetas.length : FREE_TIER_LIMIT;
    const availableMetas = filteredMetas.slice(0, tierLimit);
    
    // Return paginated slice from cache
    let paginatedMetas = availableMetas.slice(skip, skip + PAGE_SIZE);
    
    // Apply RPDB posters only if supporter with valid key
    if (canUseRPDB) {
      console.log(`Applying RPDB posters for series (supporter with user provided key)`);
      paginatedMetas = paginatedMetas.map(meta => {
        if (meta.id && meta.id.startsWith('tt')) {
          const rpdbPoster = getRPDBPosterUrl(meta.id, rpdbApiKey);
          if (rpdbPoster) {
            return { ...meta, poster: rpdbPoster };
          }
        }
        return meta;
      });
    }
    
    console.log(`Returning ${paginatedMetas.length} series from position ${skip} (Tier: ${isSupporter ? 'Supporter' : 'Free'}, Limit: ${tierLimit})`);
    return { metas: paginatedMetas };
  };
  
  // If we have fresh cache, return it immediately
  if (hasFreshCache) {
    return returnFromCache(seriesCatalogCache[cacheKey]);
  }
  
  // If fetch is already in progress and we have stale cache, return stale cache
  if (seriesFetchInProgress && hasAnyCache) {
    console.log(`Series fetch in progress, returning stale cache...`);
    return returnFromCache(seriesCatalogCache[cacheKey]);
  }
  
  seriesFetchInProgress = true;
  console.log(`Fetching fresh series data...`);
  
  try {
    // Fetch from MDBList RSS feed with timeout
    const fetchPromise = fetchSeriesFromMDBList().catch(err => {
      console.error('MDBList series fetch error:', err.message);
      return [];
    });
    
    const mdblistSeries = await withTimeout(fetchPromise, REQUEST_TIMEOUT, null);
    
    if (!mdblistSeries) {
      console.log(`⚠️ Series fetch timed out after ${REQUEST_TIMEOUT}ms`);
      seriesFetchInProgress = false;
      
      if (hasAnyCache) {
        console.log(`Returning stale series cache due to timeout`);
        return returnFromCache(seriesCatalogCache[cacheKey]);
      }
      return { metas: [] };
    }
    
    console.log(`Fetched ${mdblistSeries.length} from MDBList`);
  
  // Use MDBList as the only source
  const series = mdblistSeries;
  
  // Remove duplicates based on IMDb ID
  const uniqueSeries = [];
  const seenIds = new Set();
  for (const show of series) {
    const id = show.imdbId || show.id;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      uniqueSeries.push(show);
    }
  }
  
  console.log(`Fetched ${series.length} posts, ${uniqueSeries.length} unique series`);
  
  // Enrich with Cinemeta metadata
  const metas = (await Promise.all(uniqueSeries.map(async (show) => {
    let cinemataData = null;

    // Try to fetch from Cinemeta if we have an IMDb ID
    if (show.imdbId) {
      try {
        cinemataData = await getSeriesByImdbId(show.imdbId);
        if (!cinemataData) {
          console.log(`No Cinemeta data for ${show.title} (${show.imdbId}) - using fallback`);
        }
      } catch (error) {
        console.error(`Failed to fetch Cinemeta data for ${show.imdbId}:`, error.message);
      }
    }

    // Skip series without IMDb ID
    if (!show.imdbId || !show.imdbId.startsWith('tt')) {
      console.log(`Skipping series without valid IMDb ID: ${show.title} (ID: ${show.imdbId})`);
      return null;
    }

    // Build description - prefer Cinemeta but fallback to basic info
    let description = cinemataData?.description || `${show.title} - New series from ${show.year}. Season 1 available on rlsbb.to.`;
    
    // Add episode info if available
    if (show.episodeCount) {
      description += ` • ${show.episodeCount} episode${show.episodeCount > 1 ? 's' : ''} available`;
    }

    // Build meta object
    const meta = {
      id: show.imdbId,
      type: 'series',
      name: cinemataData?.name || show.title,
      releaseInfo: cinemataData?.releaseInfo || `${show.year}–`,
      poster: cinemataData?.poster || `https://via.placeholder.com/300x450/2c2c2c/ffffff?text=${encodeURIComponent(show.title)}`,
      posterShape: 'poster',
      background: cinemataData?.background,
      logo: cinemataData?.logo,
      description: description,
      genres: Array.isArray(cinemataData?.genres) && cinemataData.genres.length > 0 ? cinemataData.genres : ['Drama'],
      director: cinemataData?.director || [],
      cast: Array.isArray(cinemataData?.cast) ? cinemataData.cast : [],
      imdbRating: cinemataData?.imdbRating,
      runtime: cinemataData?.runtime,
      status: cinemataData?.status || 'Continuing',
      links: [],
      year: cinemataData?.year || show.year
    };

    // Filter: Only show series from last 365 days (current year and previous year)
    const currentYear = new Date().getFullYear();
    const metaYear = parseInt(meta.year) || currentYear;
    
    // Accept current year and previous year (covers last 365 days)
    if (metaYear < currentYear - 1) {
      console.log(`Skipping old series: ${meta.name} (${meta.year}) - older than last year`);
      return null;
    }

    // Add IMDb link if available
    if (show.imdbId) {
      meta.links.push({
        name: 'IMDb',
        category: 'Metadata',
        url: `https://www.imdb.com/title/${show.imdbId}/`
      });
    }

    return meta;
  }))).filter(meta => meta !== null);

  // Keep original order from MDBList RSS feed (already sorted by MDBList)

  // Update cache
  seriesCatalogCache[cacheKey] = metas;
  seriesCacheTimestamp[cacheKey] = now;
  seriesFetchInProgress = false;

  console.log(`Series catalog updated with ${metas.length} series total`);
  
  // Apply tier limits
  const tierLimit = isSupporter ? metas.length : FREE_TIER_LIMIT;
  const availableMetas = metas.slice(0, tierLimit);
  
  // Apply RPDB posters only if supporter with valid key
  let finalMetas = availableMetas;
  if (canUseRPDB) {
    console.log(`Applying RPDB posters for series (supporter with user provided key)`);
    finalMetas = availableMetas.map(meta => {
      if (meta.id && meta.id.startsWith('tt')) {
        const rpdbPoster = getRPDBPosterUrl(meta.id, rpdbApiKey);
        if (rpdbPoster) {
          return { ...meta, poster: rpdbPoster };
        }
      }
      return meta;
    });
  }
  
  // Return paginated slice
  const paginatedMetas = finalMetas.slice(skip, skip + PAGE_SIZE);
  
  console.log(`Returning page: skip=${skip}, count=${paginatedMetas.length}, tierLimit=${tierLimit} (${isSupporter ? 'Supporter' : 'Free'})`);
  
  if (paginatedMetas.length === 0) {
    console.log('No more series available');
  }
  
  return { metas: paginatedMetas };
  
  } catch (error) {
    console.error(`Series catalog fetch error:`, error.message);
    seriesFetchInProgress = false;
    
    // Return stale cache if available, otherwise empty
    if (hasAnyCache) {
      console.log(`Returning stale series cache due to error`);
      return returnFromCache(seriesCatalogCache[cacheKey]);
    }
    return { metas: [] };
  }
}

/**
 * Helper function to process movies and enrich with Cinemeta metadata
 */
async function processMoviesForCatalog(movies, now) {
  // Remove duplicates based on IMDb ID
  const uniqueMovies = [];
  const seenIds = new Set();
  for (const movie of movies) {
    const uniqueKey = movie.imdbId || movie.id;
    if (uniqueKey && !seenIds.has(uniqueKey)) {
      seenIds.add(uniqueKey);
      uniqueMovies.push(movie);
    }
  }
  
  console.log(`Processing ${uniqueMovies.length} unique movies`);
  
  // Enrich with Cinemeta metadata (limit concurrent requests)
  const metas = (await Promise.all(uniqueMovies.map(async (movie) => {
    // Skip movies without IMDb ID
    if (!movie.imdbId || !movie.imdbId.startsWith('tt')) {
      return null;
    }
    
    let cinemataData = null;
    try {
      cinemataData = await getMovieByImdbId(movie.imdbId);
    } catch (error) {
      // Silently continue - we'll use fallback data
    }

    // Build meta object
    return {
      id: movie.imdbId,
      type: 'movie',
      name: cinemataData?.name || movie.title,
      releaseInfo: cinemataData?.releaseInfo || movie.year,
      poster: cinemataData?.poster || movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Poster',
      posterShape: 'poster',
      background: cinemataData?.background,
      logo: cinemataData?.logo,
      description: cinemataData?.description || movie.description || 'HD movie release',
      genres: Array.isArray(cinemataData?.genres) ? cinemataData.genres : [],
      director: cinemataData?.director,
      cast: Array.isArray(cinemataData?.cast) ? cinemataData.cast : [],
      imdbRating: cinemataData?.imdbRating,
      runtime: cinemataData?.runtime,
      year: cinemataData?.year || movie.year,
      links: movie.imdbId ? [{ name: 'IMDb', category: 'Metadata', url: `https://www.imdb.com/title/${movie.imdbId}/` }] : []
    };
  }))).filter(meta => meta !== null);
  
  return metas;
}

/**
 * Background function to fetch additional sources and update cache
 */
async function fetchAdditionalSources(cacheKey) {
  console.log(`Starting background fetch for additional sources...`);
  
  try {
    const [rlsbbMovies, redditMovies] = await Promise.all([
      fetchMovies(500).catch(err => { console.error('rlsbb background fetch error:', err.message); return []; }),
      fetchMoviesFromReddit(100).catch(err => { console.error('reddit background fetch error:', err.message); return []; })
    ]);
    
    if (rlsbbMovies.length === 0 && redditMovies.length === 0) {
      console.log(`No additional movies from background fetch`);
      return;
    }
    
    console.log(`Background fetch got ${rlsbbMovies.length} from rlsbb, ${redditMovies.length} from reddit`);
    
    // Get existing cache
    const existingMetas = catalogCache[cacheKey] || [];
    const existingIds = new Set(existingMetas.map(m => m.id));
    
    // Merge new movies (avoid duplicates)
    const newMovies = [...rlsbbMovies, ...redditMovies].filter(m => m.imdbId && !existingIds.has(m.imdbId));
    
    if (newMovies.length > 0) {
      const newMetas = await processMoviesForCatalog(newMovies, Date.now());
      
      // Merge and update cache
      const mergedMetas = [...existingMetas, ...newMetas];
      catalogCache[cacheKey] = mergedMetas;
      cacheTimestamp[cacheKey] = Date.now();
      
      console.log(`Background fetch added ${newMetas.length} movies, total now: ${mergedMetas.length}`);
    }
  } catch (error) {
    console.error(`Background fetch error:`, error.message);
  }
}

/**
 * Catalog handler - returns list of HD movies and series
 */
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  const skip = parseInt(extra?.skip || 0);
  const genre = extra?.genre || null;
  const PAGE_SIZE = 100; // Stremio's default catalog page size
  const supporterCode = config?.supporter_code || '';
  const rpdbApiKey = config?.rpdb_api_key || '';
  
  // Validate supporter code
  const validation = await validateCode(supporterCode);
  const isSupporter = validation.valid;
  const FREE_TIER_LIMIT = 100;
  
  // RPDB only works for supporters
  const canUseRPDB = isSupporter && rpdbApiKey;
  if (rpdbApiKey && !isSupporter) {
    console.log(`⚠️  RPDB key provided but no valid supporter code - RPDB disabled`);
  }
  
  console.log(`Catalog request: type=${type}, id=${id}, skip=${skip}, genre=${genre || 'all'}, Supporter: ${isSupporter ? 'YES' : 'NO'}, RPDB: ${canUseRPDB ? 'Enabled' : 'Disabled'}`);
  
  // Handle series catalog
  if (type === 'series' && id === 'seriesleaks') {
    return handleSeriesCatalog({ skip, genre, isSupporter, canUseRPDB, rpdbApiKey });
  }
  
  // Handle movie catalog
  if (type !== 'movie' || id !== 'movieleaks') {
    return { metas: [] };
  }

  // Check cache first - return immediately if we have cached data
  const now = Date.now();
  const cacheKey = 'all';
  const hasFreshCache = catalogCache[cacheKey] && cacheTimestamp[cacheKey] && (now - cacheTimestamp[cacheKey]) < CACHE_DURATION;
  const hasAnyCache = catalogCache[cacheKey] && catalogCache[cacheKey].length > 0;
  
  // Helper function to return data from cache
  const returnFromCache = (cache) => {
    console.log(`Returning cached catalog (${cache.length} total items, skip=${skip})`);
    
    // Filter by genre if specified
    let filteredMetas = cache;
    if (genre) {
      filteredMetas = cache.filter(meta => 
        meta.genres && meta.genres.includes(genre)
      );
      console.log(`Filtered to ${filteredMetas.length} movies in genre: ${genre}`);
    }
    
    // Apply tier limits
    const tierLimit = isSupporter ? filteredMetas.length : FREE_TIER_LIMIT;
    const availableMetas = filteredMetas.slice(0, tierLimit);
    
    // Return paginated slice from cache
    let paginatedMetas = availableMetas.slice(skip, skip + PAGE_SIZE);
    
    // Apply RPDB posters only if supporter with valid key
    if (canUseRPDB) {
      console.log(`Applying RPDB posters for supporter (user provided key)`);
      paginatedMetas = paginatedMetas.map(meta => {
        if (meta.id && meta.id.startsWith('tt')) {
          const rpdbPoster = getRPDBPosterUrl(meta.id, rpdbApiKey);
          if (rpdbPoster) {
            return { ...meta, poster: rpdbPoster };
          }
        }
        return meta;
      });
    }
    
    console.log(`Returning ${paginatedMetas.length} items from position ${skip} (Tier: ${isSupporter ? 'Supporter' : 'Free'}, Limit: ${tierLimit})`);
    return { metas: paginatedMetas };
  };
  
  // If we have fresh cache, return it immediately
  if (hasFreshCache) {
    return returnFromCache(catalogCache[cacheKey]);
  }
  
  // If fetch is already in progress and we have stale cache, return stale cache
  if (movieFetchInProgress && hasAnyCache) {
    console.log(`Fetch in progress, returning stale cache...`);
    return returnFromCache(catalogCache[cacheKey]);
  }
  
  // Start fresh fetch with timeout
  movieFetchInProgress = true;
  console.log(`Fetching fresh movie data...`);
  
  try {
    // Fetch ALL sources in parallel with individual timeouts
    // This ensures we get data from all sources that respond in time
    const sourceTimeout = 20000; // 20 seconds per source
    
    // MDBList disabled - only using rlsbb and Reddit
    const [rlsbbMovies, redditMovies] = await Promise.all([
      withTimeout(
        fetchMovies(200).catch(err => { console.error('rlsbb fetch error:', err.message); return []; }),
        sourceTimeout,
        []
      ),
      withTimeout(
        fetchMoviesFromReddit(50).catch(err => { console.error('reddit fetch error:', err.message); return []; }),
        sourceTimeout,
        []
      )
    ]);
    
    console.log(`Fetched: rlsbb=${rlsbbMovies.length}, Reddit=${redditMovies.length}`);
    
    // Merge sources - rlsbb first, then reddit
    const allMovies = [...rlsbbMovies, ...redditMovies];
    
    if (allMovies.length === 0) {
      console.log(`No movies from any source`);
      movieFetchInProgress = false;
      
      if (hasAnyCache) {
        return returnFromCache(catalogCache[cacheKey]);
      }
      return { metas: [] };
    }
    
    // Process all movies
    const metas = await processMoviesForCatalog(allMovies, now);
    
    if (metas.length > 0) {
      // Update cache
      catalogCache[cacheKey] = metas;
      cacheTimestamp[cacheKey] = now;
      console.log(`Catalog ready with ${metas.length} movies from all sources`);
      
      movieFetchInProgress = false;
      return returnFromCache(catalogCache[cacheKey]);
    }
    
  } catch (error) {
    console.error(`Catalog fetch error:`, error.message);
    movieFetchInProgress = false;
    
    // Return stale cache if available, otherwise empty
    if (hasAnyCache) {
      console.log(`Returning stale cache due to error`);
      return returnFromCache(catalogCache[cacheKey]);
    }
    return { metas: [] };
  }
});

/**
 * Meta handler - returns detailed info for a specific movie or series
 */
builder.defineMetaHandler(async ({ type, id, config }) => {
  const supporterCode = config?.supporter_code || '';
  const rpdbApiKey = config?.rpdb_api_key || '';
  
  // Validate supporter code
  const validation = await validateCode(supporterCode);
  const isSupporter = validation.valid;
  
  // RPDB only works for supporters
  const canUseRPDB = isSupporter && rpdbApiKey;
  
  console.log(`Meta request for ${id}, type: ${type} (Supporter: ${isSupporter ? 'YES' : 'NO'}, RPDB: ${canUseRPDB ? 'Enabled' : 'Disabled'})`);
  
  if (type !== 'movie' && type !== 'series') {
    return { meta: null };
  }

  let meta = null;

  // Try to find in appropriate cache based on type
  let cached = null;
  if (type === 'series') {
    // Search series cache
    for (const sortKey in seriesCatalogCache) {
      if (seriesCatalogCache[sortKey]) {
        cached = seriesCatalogCache[sortKey].find(m => m.id === id);
        if (cached) break;
      }
    }
  } else {
    // Search movie cache
    for (const sortKey in catalogCache) {
      if (catalogCache[sortKey]) {
        cached = catalogCache[sortKey].find(m => m.id === id);
        if (cached) break;
      }
    }
  }
  
  if (cached) {
    // Make a deep copy to avoid mutating cache
    meta = JSON.parse(JSON.stringify(cached));
    console.log(`Found ${id} in ${type} cache`);
    
    // For series, fetch full metadata with videos (episodes)
    if (type === 'series' && id.startsWith('tt')) {
      try {
        const fullSeriesData = await getSeriesByImdbId(id);
        if (fullSeriesData && fullSeriesData.videos) {
          meta.videos = fullSeriesData.videos;
          console.log(`Added ${fullSeriesData.videos.length} episodes to series metadata`);
        }
      } catch (error) {
        console.error(`Failed to fetch full series data for ${id}:`, error.message);
      }
    }
  } else {
    // Not in our catalog - don't provide metadata
    // Let Cinemeta handle it to avoid conflicts
    console.log(`${id} not in our catalog, skipping`);
    return { meta: null };
  }

  // Apply RPDB poster only if supporter with valid key
  if (meta && canUseRPDB && id.startsWith('tt')) {
    const rpdbPoster = getRPDBPosterUrl(id, rpdbApiKey);
    if (rpdbPoster) {
      meta.poster = rpdbPoster;
      console.log(`Applied RPDB poster for ${id} (supporter with RPDB key)`);
    }
  }

  return meta ? { meta } : { meta: null };
});

// Start the addon server
serveHTTP(builder.getInterface(), { port: PORT }).then(() => {
  console.log(`🎬 Movie Leaks Stremio Addon running at http://localhost:${PORT}`);
  console.log(`📦 Manifest available at: http://localhost:${PORT}/manifest.json`);
  console.log(`🔧 Metadata provider: Cinemeta (Stremio official)`);
  console.log(`\nTo install in Stremio, add this URL: http://localhost:${PORT}/manifest.json`);
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
