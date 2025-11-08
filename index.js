import { addonBuilder } from 'stremio-addon-sdk';
import addonSDK from 'stremio-addon-sdk';
import { fetchMovieLeaks } from './reddit.js';
import { getMovieByImdbId } from './cinemeta.js';

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
  description: 'Catalog of leaked and upcoming movies from r/movieleaks subreddit',
  logo: 'https://styles.redditmedia.com/t5_2z0gz/styles/communityIcon_xqq9r4hqnl6b1.png',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  catalogs: [
    {
      type: 'movie',
      id: 'movieleaks',
      name: 'Movie Leaks',
      extra: [
        {
          name: 'skip',
          isRequired: false
        }
      ]
    }
  ],
  idPrefixes: ['tt', 'ml']
};

const builder = new addonBuilder(manifest);

/**
 * Catalog handler - returns list of movies from r/movieleaks
 */
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const skip = parseInt(extra?.skip || 0);
  console.log(`Catalog request: type=${type}, id=${id}, skip=${skip}`);
  
  if (type !== 'movie' || id !== 'movieleaks') {
    return { metas: [] };
  }

  // Check cache
  const now = Date.now();
  if (catalogCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log(`Returning cached catalog (${catalogCache.length} total items, skip=${skip})`);
    // Return paginated slice from cache
    const paginatedMetas = catalogCache.slice(skip, skip + 50);
    console.log(`Returning ${paginatedMetas.length} items from position ${skip}`);
    return { metas: paginatedMetas };
  }

  console.log('Fetching fresh data from Reddit...');
  
  // Fetch movies from Reddit (get as many as possible for pagination)
  const movies = await fetchMovieLeaks(200);
  
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

    // Build meta object
    const meta = {
      id: movie.imdbId || `ml-${movie.id}`,
      type: 'movie',
      name: cinemataData?.name || movie.title,
      releaseInfo: cinemataData?.releaseInfo || movie.year,
      poster: cinemataData?.poster || movie.poster || movie.thumbnail || 'https://via.placeholder.com/300x450/1a1a1a/666666?text=No+Poster',
      background: cinemataData?.background,
      logo: cinemataData?.logo,
      description: cinemataData?.description || movie.description || `Leaked movie from r/movieleaks\n\nPosted by u/${movie.author} on Reddit.\n\n${movie.redditUrl}`,
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
  const paginatedMetas = metas.slice(skip, skip + 50);
  console.log(`Returning page: skip=${skip}, count=${paginatedMetas.length}, hasMore=${skip + 50 < metas.length}`);
  return { metas: paginatedMetas };
});

/**
 * Meta handler - returns detailed info for a specific movie
 */
builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== 'movie') {
    return { meta: null };
  }

  // Try to find in cache first
  if (catalogCache) {
    const cached = catalogCache.find(m => m.id === id);
    if (cached) {
      return { meta: cached };
    }
  }

  // If not in cache, try to fetch from Cinemeta
  if (id.startsWith('tt')) {
    const cinemataData = await getMovieByImdbId(id);
    if (cinemataData) {
      return {
        meta: {
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
        }
      };
    }
  }

  return { meta: null };
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
