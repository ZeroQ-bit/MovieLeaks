import { addonBuilder } from 'stremio-addon-sdk';
import addonSDK from 'stremio-addon-sdk';
import { fetchMovies } from './rlsbb.js';
import { getMovieByImdbId } from './cinemeta.js';
import { getRPDBPosterUrl } from './rpdb.js';
import { validateCode } from './supporters.js';

const { serveHTTP } = addonSDK;

// Configuration
const PORT = process.env.PORT || 7000;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache - separate cache for each sort type
const catalogCache = {};
const cacheTimestamp = {};

// Addon manifest
const manifest = {
  id: 'community.movieleaks.v2',
  version: '1.4.0',
  name: 'Movie Leaks Catalog',
  description: 'Catalog of HD movie releases\n\n━━━━━━━━━━━━━━━━━━━\n🆓 FREE TIER: 70 movies\n💎 SUPPORTER TIER: All Movies\n🎨 RPDB: Optional (supporters bring their own key)\n━━━━━━━━━━━━━━━━━━━\n\n☕ Become a Supporter ($5/month):\n👉 https://ko-fi.com/zeroq/membership\n\nAfter subscribing, enter your code below to unlock!\n\nOptional: Add your RPDB key for enhanced posters\nGet free key at: ratingposterdb.com\n\n━━━━━━━━━━━━━━━━━━━\n🐛 Report bugs: https://github.com/Zerr0-C00L/MovieLeaks-Issues/issues',
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
  config: [
    {
      key: 'supporter_code',
      type: 'text',
      title: '💎 Supporter Code (Unlock all Movies)',
      required: false,
      default: ''
    },
    {
      key: 'rpdb_api_key',
      type: 'text',
      title: '🎨 RPDB API Key (Optional - Supporters only: Get posters with RT scores)',
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
 * Catalog handler - returns list of HD movies
 */
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  const skip = parseInt(extra?.skip || 0);
  const sort = extra?.sort || 'new'; // Default to 'new' if not specified
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
  
  console.log(`Catalog request: type=${type}, id=${id}, skip=${skip}, sort=${sort}, Supporter: ${isSupporter ? 'YES' : 'NO'}, RPDB: ${canUseRPDB ? 'Enabled' : 'Disabled'}`);
  
  if (type !== 'movie' || id !== 'movieleaks') {
    return { metas: [] };
  }

  // Check cache for this specific sort
  const now = Date.now();
  const cacheKey = sort;
  if (catalogCache[cacheKey] && cacheTimestamp[cacheKey] && (now - cacheTimestamp[cacheKey]) < CACHE_DURATION) {
    console.log(`Returning cached catalog for sort=${sort} (${catalogCache[cacheKey].length} total items, skip=${skip})`);
    
    // Apply tier limits
    const tierLimit = isSupporter ? catalogCache[cacheKey].length : FREE_TIER_LIMIT;
    const availableMetas = catalogCache[cacheKey].slice(0, tierLimit);
    
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
  
  // Fetch movies
  const neededPosts = 500;
  console.log(`Fetching up to ${neededPosts} posts`);
  
  const movies = await fetchMovies(neededPosts);
  
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
    let description = cinemataData?.description || movie.description || 'HD movie release';

    // Build meta object
    const meta = {
      id: movie.imdbId || `ml-${movie.id}`,
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
 * Meta handler - returns detailed info for a specific movie
 */
builder.defineMetaHandler(async ({ type, id, config }) => {
  const supporterCode = config?.supporter_code || '';
  const rpdbApiKey = config?.rpdb_api_key || '';
  
  // Validate supporter code
  const validation = await validateCode(supporterCode);
  const isSupporter = validation.valid;
  
  // RPDB only works for supporters
  const canUseRPDB = isSupporter && rpdbApiKey;
  
  console.log(`Meta request for ${id} (Supporter: ${isSupporter ? 'YES' : 'NO'}, RPDB: ${canUseRPDB ? 'Enabled' : 'Disabled'})`);
  
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
