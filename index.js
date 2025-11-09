import { addonBuilder } from 'stremio-addon-sdk';
import addonSDK from 'stremio-addon-sdk';
import { fetchMovieLeaks } from './reddit.js';
import { getMovieByImdbId } from './cinemeta.js';
import { getRPDBPosterUrl } from './rpdb.js';
import { getMDBListRatings, formatRatingsForDescription } from './mdblist.js';

const { serveHTTP } = addonSDK;

// Configuration
const PORT = process.env.PORT || 7000;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Simple in-memory cache
let catalogCache = null;
let cacheTimestamp = null;

// Addon manifest
const manifest = {
  id: 'com.movieleaks.stremio',
  version: '1.0.0',
  name: 'Movie Leaks Catalog',
  description: 'Catalog of leaked and upcoming movies from r/movieleaks subreddit\n\n☕ Support: https://ko-fi.com/zeroq',
  logo: 'https://i.imgur.com/hovSkIN.png',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  catalogs: [
    {
      type: 'movie',
      id: 'movieleaks',
      name: 'Latest Leaks',
      extra: [
        {
          name: 'skip',
          isRequired: false
        }
      ]
    }
  ],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  },
  config: [
    {
      key: 'rpdb_api_key',
      type: 'text',
      title: 'RPDB API Key',
      required: false,
      default: ''
    },
    {
      key: 'mdblist_api_key',
      type: 'text',
      title: 'MDBList API Key',
      required: false,
      default: ''
    }
  ],
  idPrefixes: ['tt', 'ml']
};

const builder = new addonBuilder(manifest);

/**
 * Catalog handler - returns list of movies from r/movieleaks
 */
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  const skip = parseInt(extra?.skip || 0);
  const PAGE_SIZE = 100; // Stremio's default catalog page size
  const rpdbApiKey = config?.rpdb_api_key || '';
  const mdblistApiKey = config?.mdblist_api_key || '';
  console.log(`Catalog request: type=${type}, id=${id}, skip=${skip}, RPDB API: ${rpdbApiKey ? 'configured' : 'not configured'}, MDBList API: ${mdblistApiKey ? 'configured' : 'not configured'}`);
  
  if (type !== 'movie' || id !== 'movieleaks') {
    return { metas: [] };
  }

  // Check cache
  const now = Date.now();
  if (catalogCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log(`Returning cached catalog (${catalogCache.length} total items, skip=${skip})`);
    // Return paginated slice from cache, but apply RPDB posters if configured
    let paginatedMetas = catalogCache.slice(skip, skip + PAGE_SIZE);
    
    // Apply RPDB posters if API key is configured
    if (rpdbApiKey) {
      console.log(`Applying RPDB posters to cached results`);
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
    
    console.log(`Returning ${paginatedMetas.length} items from position ${skip}`);
    return { metas: paginatedMetas };
  }

  console.log('Fetching fresh data from Reddit...');
  
  // Fetch movies from Reddit (JSON API supports pagination)
  const movies = await fetchMovieLeaks(300);
  
  // Remove duplicates based on IMDb ID or slug
  const uniqueMovies = [];
  const seenIds = new Set();
  for (const movie of movies) {
    if (!seenIds.has(movie.id)) {
      seenIds.add(movie.id);
      uniqueMovies.push(movie);
    }
  }
  
  console.log(`Fetched ${movies.length} posts, ${uniqueMovies.length} unique movies`);
  
  // Enrich with Cinemeta metadata
  const metas = (await Promise.all(uniqueMovies.map(async (movie) => {
    let cinemataData = null;
    let mdblistRatings = null;

    // Try to fetch from Cinemeta if we have an IMDb ID
    if (movie.imdbId) {
      try {
        cinemataData = await getMovieByImdbId(movie.imdbId);
      } catch (error) {
        console.error(`Failed to fetch Cinemeta data for ${movie.imdbId}:`, error.message);
      }

      // Fetch MDBList ratings if API key is configured
      if (mdblistApiKey) {
        try {
          mdblistRatings = await getMDBListRatings(movie.imdbId, mdblistApiKey);
        } catch (error) {
          console.error(`Failed to fetch MDBList data for ${movie.imdbId}:`, error.message);
        }
      }
    }

    // Skip movies without IMDb ID and without poster
    if (!movie.imdbId && !movie.poster && !movie.thumbnail) {
      console.log(`Skipping movie without IMDb ID or poster: ${movie.title}`);
      return null;
    }

    // Build description with ratings
    let description = cinemataData?.description || movie.description || `Leaked movie from r/movieleaks\n\nPosted by u/${movie.author} on Reddit.\n\n${movie.redditUrl}`;
    
    // Add MDBList ratings to description if available
    if (mdblistRatings) {
      description += formatRatingsForDescription(mdblistRatings);
    }

    // Build meta object
    const meta = {
      id: movie.imdbId || `ml-${movie.id}`,
      type: 'movie',
      name: cinemataData?.name || movie.title,
      releaseInfo: cinemataData?.releaseInfo || movie.year,
      poster: rpdbApiKey && movie.imdbId 
        ? (getRPDBPosterUrl(movie.imdbId, rpdbApiKey) || cinemataData?.poster || movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Poster')
        : (cinemataData?.poster || movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Poster'),
      background: cinemataData?.background,
      logo: cinemataData?.logo,
      description: description,
      genres: cinemataData?.genres || [],
      director: cinemataData?.director,
      cast: cinemataData?.cast,
      imdbRating: cinemataData?.imdbRating,
      runtime: cinemataData?.runtime,
      links: [
        {
          name: 'Reddit Post',
          category: 'Social',
          url: movie.redditUrl
        }
      ]
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

  // Update cache
  catalogCache = metas;
  cacheTimestamp = now;

  console.log(`Catalog updated with ${metas.length} movies total`);
  
  // Return paginated slice
  const paginatedMetas = metas.slice(skip, skip + PAGE_SIZE);
  
  console.log(`Returning page: skip=${skip}, count=${paginatedMetas.length}, totalAvailable=${metas.length}`);
  
  return { metas: paginatedMetas };
});

/**
 * Meta handler - returns detailed info for a specific movie
 */
builder.defineMetaHandler(async ({ type, id, config }) => {
  const rpdbApiKey = config?.rpdb_api_key || '';
  const mdblistApiKey = config?.mdblist_api_key || '';
  
  console.log(`Meta request for ${id}, MDBList: ${mdblistApiKey ? 'YES' : 'NO'}, RPDB: ${rpdbApiKey ? 'YES' : 'NO'}`);
  
  if (type !== 'movie') {
    return { meta: null };
  }

  let meta = null;
  let mdblistRatings = null;

  // Try to find in cache first
  if (catalogCache) {
    const cached = catalogCache.find(m => m.id === id);
    if (cached) {
      // Make a deep copy to avoid mutating cache
      meta = JSON.parse(JSON.stringify(cached));
      console.log(`Found ${id} in cache`);
    }
  }

  // If not in cache and has IMDb ID, fetch from Cinemeta
  if (!meta && id.startsWith('tt')) {
    console.log(`Fetching ${id} from Cinemeta...`);
    const cinemataData = await getMovieByImdbId(id);
    if (cinemataData) {
      meta = {
        id,
        type: 'movie',
        name: cinemataData.name,
        poster: cinemataData.poster,
        background: cinemataData.background,
        logo: cinemataData.logo,
        description: cinemataData.description,
        genres: cinemataData.genres,
        director: cinemataData.director,
        cast: cinemataData.cast,
        imdbRating: cinemataData.imdbRating,
        runtime: cinemataData.runtime,
        releaseInfo: cinemataData.releaseInfo
      };
    }
  }

  // If we have meta and MDBList is configured, fetch ratings
  if (meta && mdblistApiKey && id.startsWith('tt')) {
    try {
      console.log(`Fetching MDBList ratings for ${id}...`);
      mdblistRatings = await getMDBListRatings(id, mdblistApiKey);
      if (mdblistRatings) {
        const ratingsText = formatRatingsForDescription(mdblistRatings);
        meta.description = (meta.description || '') + ratingsText;
        console.log(`Added MDBList ratings to ${id}`);
      } else {
        console.log(`No MDBList ratings for ${id}`);
      }
    } catch (error) {
      console.error(`MDBList error for ${id}:`, error.message);
    }
  }

  // Apply RPDB poster if configured
  if (meta && rpdbApiKey && id.startsWith('tt')) {
    const rpdbPoster = getRPDBPosterUrl(id, rpdbApiKey);
    if (rpdbPoster) {
      meta.poster = rpdbPoster;
      console.log(`Applied RPDB poster for ${id}`);
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
