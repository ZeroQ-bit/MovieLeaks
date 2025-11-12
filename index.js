import { addonBuilder } from 'stremio-addon-sdk';
import addonSDK from 'stremio-addon-sdk';
import { fetchMovieLeaks } from './reddit.js';
import { getMovieByImdbId } from './cinemeta.js';
import { getRPDBPosterUrl } from './rpdb.js';

const { serveHTTP } = addonSDK;

// Configuration
const PORT = process.env.PORT || 7000;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache - separate cache for each sort type
const catalogCache = {};
const cacheTimestamp = {};

// Addon manifest
const manifest = {
  id: 'community.movieleaks',
  version: '1.3.2',
  name: 'Movie Leaks Catalog',
  description: 'Catalog of leaked and upcoming movies from r/movieleaks subreddit with RPDB poster support\n\n☕ Support: https://ko-fi.com/zeroq\n🐛 Report bugs: https://github.com/Zerr0-C00L/MovieLeaks-Issues/issues',
  logo: 'https://i.imgur.com/hovSkIN.png',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  catalogs: [
    {
      type: 'movie',
      id: 'movieleaks',
      name: 'Latest Leaks',
      posterShape: 'poster',
      extra: [
        {
          name: 'sort',
          isRequired: false,
          options: ['new', 'hot', 'top', 'rising'],
          optionsLimit: 1
        },
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
      title: 'RPDB API Key (optional - for poster overlays)',
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
  const sort = extra?.sort || 'new'; // Default to 'new' if not specified
  const PAGE_SIZE = 100; // Stremio's default catalog page size
  const rpdbApiKey = config?.rpdb_api_key || '';
  console.log(`Catalog request: type=${type}, id=${id}, skip=${skip}, sort=${sort}, RPDB API: ${rpdbApiKey ? 'configured' : 'not configured'}`);
  
  if (type !== 'movie' || id !== 'movieleaks') {
    return { metas: [] };
  }

  // Check cache for this specific sort
  const now = Date.now();
  const cacheKey = sort;
  if (catalogCache[cacheKey] && cacheTimestamp[cacheKey] && (now - cacheTimestamp[cacheKey]) < CACHE_DURATION) {
    console.log(`Returning cached catalog for sort=${sort} (${catalogCache[cacheKey].length} total items, skip=${skip})`);
    // Return paginated slice from cache, but apply RPDB posters if configured
    let paginatedMetas = catalogCache[cacheKey].slice(skip, skip + PAGE_SIZE);
    
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

  console.log(`Fetching fresh data from Reddit with sort=${sort}...`);
  
  // Fetch movies from Reddit (JSON API supports pagination)
  // Calculate how many posts we need based on skip value
  // Reddit has ~300-500 recent posts, so fetch enough to cover pagination
  const neededPosts = Math.max(500, skip + PAGE_SIZE + 200);
  console.log(`Fetching ${neededPosts} posts to cover skip=${skip}`);
  
  const movies = await fetchMovieLeaks(neededPosts, sort);
  
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

    // Try to fetch from Cinemeta if we have an IMDb ID
    if (movie.imdbId) {
      try {
        cinemataData = await getMovieByImdbId(movie.imdbId);
      } catch (error) {
        console.error(`Failed to fetch Cinemeta data for ${movie.imdbId}:`, error.message);
      }
    }

    // Skip movies without IMDb ID and without poster
    if (!movie.imdbId && !movie.poster && !movie.thumbnail) {
      console.log(`Skipping movie without IMDb ID or poster: ${movie.title}`);
      return null;
    }

    // Build description
    let description = cinemataData?.description || movie.description || `Leaked movie from r/movieleaks\n\nPosted by u/${movie.author} on Reddit.\n\n${movie.redditUrl}`;

    // Build meta object
    const meta = {
      id: movie.imdbId || `ml-${movie.id}`,
      type: 'movie',
      name: cinemataData?.name || movie.title,
      releaseInfo: cinemataData?.releaseInfo || movie.year,
      poster: rpdbApiKey && movie.imdbId 
        ? (getRPDBPosterUrl(movie.imdbId, rpdbApiKey) || cinemataData?.poster || movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Poster')
        : (cinemataData?.poster || movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Poster'),
      posterShape: 'poster',
      background: cinemataData?.background,
      logo: cinemataData?.logo,
      description: description,
      genres: Array.isArray(cinemataData?.genres) ? cinemataData.genres : [],
      director: cinemataData?.director,
      cast: Array.isArray(cinemataData?.cast) ? cinemataData.cast : [],
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

  // Update cache for this sort type
  catalogCache[cacheKey] = metas;
  cacheTimestamp[cacheKey] = now;

  console.log(`Catalog updated with ${metas.length} movies total`);
  
  // Return paginated slice
  const paginatedMetas = metas.slice(skip, skip + PAGE_SIZE);
  
  console.log(`Returning page: skip=${skip}, count=${paginatedMetas.length}, totalAvailable=${metas.length}`);
  
  // If we have no more items to return, return empty array
  // Otherwise Stremio will keep requesting
  if (paginatedMetas.length === 0) {
    console.log('No more items available');
  }
  
  return { metas: paginatedMetas };
});

/**
 * Meta handler - returns detailed info for a specific movie
 */
builder.defineMetaHandler(async ({ type, id, config }) => {
  const rpdbApiKey = config?.rpdb_api_key || '';
  
  console.log(`Meta request for ${id}`);
  console.log(`RPDB key: ${rpdbApiKey ? 'YES' : 'NO'}`);
  
  if (type !== 'movie') {
    return { meta: null };
  }

  let meta = null;

  // Try to find in cache first - search all sort caches
  let cached = null;
  for (const sortKey in catalogCache) {
    if (catalogCache[sortKey]) {
      cached = catalogCache[sortKey].find(m => m.id === id);
      if (cached) break;
    }
  }
  
  if (cached) {
    // Make a deep copy to avoid mutating cache
    meta = JSON.parse(JSON.stringify(cached));
    console.log(`Found ${id} in cache`);
  } else {
    // Not in our catalog - don't provide metadata
    // Let Cinemeta handle it to avoid conflicts
    console.log(`${id} not in our catalog, skipping`);
    return { meta: null };
  }

  // Apply RPDB poster if configured
  if (meta && rpdbApiKey && id.startsWith('tt')) {
    const rpdbPoster = getRPDBPosterUrl(id, rpdbApiKey);
    if (rpdbPoster) {
      meta.poster = rpdbPoster;
      console.log(`Applied RPDB poster for ${id}`);
    }
  }

  // Update catalogCache with enriched metadata (RPDB poster) - update in all caches
  if (meta && id.startsWith('tt') && rpdbApiKey) {
    for (const sortKey in catalogCache) {
      if (catalogCache[sortKey]) {
        const cacheIndex = catalogCache[sortKey].findIndex(m => m.id === id);
        if (cacheIndex !== -1) {
          catalogCache[sortKey][cacheIndex] = meta;
          console.log(`Updated cache for ${id} with RPDB poster in sort=${sortKey}`);
        }
      }
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
