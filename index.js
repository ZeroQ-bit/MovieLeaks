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

// Simple in-memory cache - separate cache for each sort type
const catalogCache = {};
const cacheTimestamp = {};
const seriesCatalogCache = {};
const seriesCacheTimestamp = {};

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
  if (seriesCatalogCache[cacheKey] && seriesCacheTimestamp[cacheKey] && (now - seriesCacheTimestamp[cacheKey]) < CACHE_DURATION) {
    console.log(`Returning cached series catalog (${seriesCatalogCache[cacheKey].length} total items, skip=${skip})`);
    
    // Filter by genre if specified
    let filteredMetas = seriesCatalogCache[cacheKey];
    if (genre) {
      filteredMetas = seriesCatalogCache[cacheKey].filter(meta => 
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
  }

  console.log(`Fetching fresh series data...`);
  
  // Fetch from MDBList RSS feed
  const mdblistSeries = await fetchSeriesFromMDBList();
  
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

  // Check cache
  const now = Date.now();
  const cacheKey = 'all';
  if (catalogCache[cacheKey] && cacheTimestamp[cacheKey] && (now - cacheTimestamp[cacheKey]) < CACHE_DURATION) {
    console.log(`Returning cached catalog (${catalogCache[cacheKey].length} total items, skip=${skip})`);
    
    // Filter by genre if specified
    let filteredMetas = catalogCache[cacheKey];
    if (genre) {
      filteredMetas = catalogCache[cacheKey].filter(meta => 
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
        // Only apply RPDB if movie has IMDb ID
        if (meta.id && meta.id.startsWith('tt')) {
          const rpdbPoster = getRPDBPosterUrl(meta.id, rpdbApiKey);
          if (rpdbPoster) {
            return { ...meta, poster: rpdbPoster };
          }
        }
        return meta;
      });
    }
    
    console.log(`Returning ${paginatedMetas.length} items from position ${skip} (Tier: ${isSupporter ? 'Supporter' : 'Free'}, Limit: ${tierLimit}, RPDB: ${rpdbApiKey ? 'Enabled' : 'Disabled'})`);
    return { metas: paginatedMetas };
  }

  console.log(`Fetching fresh movie data...`);
  
  // Fetch movies from all sources in parallel
  const [rlsbbMovies, redditMovies, mdblistMovies] = await Promise.all([
    fetchMovies(500),
    fetchMoviesFromReddit(100),
    fetchMoviesFromMDBList()
  ]);
  
  console.log(`Fetched ${rlsbbMovies.length} from rlsbb.to, ${redditMovies.length} from r/movieleaks, ${mdblistMovies.length} from MDBList`);
  
  // Merge all sources
  const movies = [...rlsbbMovies, ...redditMovies, ...mdblistMovies];
  
  // Remove duplicates based on IMDb ID (use slug as fallback)
  const uniqueMovies = [];
  const seenIds = new Set();
  for (const movie of movies) {
    const uniqueKey = movie.imdbId || movie.id;
    if (!seenIds.has(uniqueKey)) {
      seenIds.add(uniqueKey);
      uniqueMovies.push(movie);
    }
  }
  
  console.log(`Fetched ${movies.length} posts, ${uniqueMovies.length} unique movies`);
  
  // Enrich with Cinemeta metadata
  const metas = (await Promise.all(uniqueMovies.map(async (movie) => {
    let cinemataData = null;

    // Try to fetch from Cinemeta if we have an IMDb ID
    if (movie.imdbId) {
      try {
        cinemataData = await getMovieByImdbId(movie.imdbId);
      } catch (error) {
        console.error(`Failed to fetch Cinemeta data for ${movie.imdbId}:`, error.message);
      }
    }

    // Skip movies without IMDb ID (we need IMDb ID for Stremio)
    if (!movie.imdbId || !movie.imdbId.startsWith('tt')) {
      console.log(`Skipping movie without valid IMDb ID: ${movie.title} (ID: ${movie.imdbId})`);
      return null;
    }

    // Build description
    let description = cinemataData?.description || movie.description || 'HD movie release';

    // Build meta object
    const meta = {
      id: movie.imdbId,
      type: 'movie',
      name: cinemataData?.name || movie.title,
      releaseInfo: cinemataData?.releaseInfo || movie.year,
      poster: cinemataData?.poster || movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Poster',
      posterShape: 'poster',
      background: cinemataData?.background,
      logo: cinemataData?.logo,
      description: description,
      genres: Array.isArray(cinemataData?.genres) ? cinemataData.genres : [],
      director: cinemataData?.director,
      cast: Array.isArray(cinemataData?.cast) ? cinemataData.cast : [],
      imdbRating: cinemataData?.imdbRating,
      runtime: cinemataData?.runtime,
      year: cinemataData?.year || movie.year,
      links: []
    };

    // Add IMDb link if available
    if (movie.imdbId) {
      meta.links.push({
        name: 'IMDb',
        category: 'Metadata',
        url: `https://www.imdb.com/title/${movie.imdbId}/`
      });
    }

    return meta;
  }))).filter(meta => meta !== null);

  // Update cache for this sort type
  catalogCache[cacheKey] = metas;
  cacheTimestamp[cacheKey] = now;

  console.log(`Catalog updated with ${metas.length} movies total`);
  
  // Apply tier limits
  const tierLimit = isSupporter ? metas.length : FREE_TIER_LIMIT;
  const availableMetas = metas.slice(0, tierLimit);
  
  // Apply RPDB posters only if supporter with valid key
  let finalMetas = availableMetas;
  if (canUseRPDB) {
    console.log(`Applying RPDB posters for supporter (user provided key)`);
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
  
  console.log(`Returning page: skip=${skip}, count=${paginatedMetas.length}, tierLimit=${tierLimit} (${isSupporter ? 'Supporter' : 'Free'}, RPDB: ${canUseRPDB ? 'Enabled' : 'Disabled'})`);
  
  // If we have no more items to return, return empty array
  // Otherwise Stremio will keep requesting
  if (paginatedMetas.length === 0) {
    console.log('No more items available');
  }
  
  return { metas: paginatedMetas };
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
