import fetch from 'node-fetch';

const CINEMETA_BASE_URL = 'https://v3-cinemeta.strem.io';

/**
 * Fetches movie metadata from Cinemeta by IMDb ID
 * @param {string} imdbId - IMDb ID (e.g., tt1234567)
 * @returns {Promise<Object|null>} Movie metadata or null
 */
export async function getMovieByImdbId(imdbId) {
  if (!imdbId || !imdbId.startsWith('tt')) {
    return null;
  }

  try {
    const url = `${CINEMETA_BASE_URL}/meta/movie/${imdbId}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const meta = data.meta;

    if (!meta) {
      return null;
    }

    return {
      name: meta.name,
      poster: meta.poster,
      background: meta.background,
      logo: meta.logo,
      description: meta.description,
      releaseInfo: meta.releaseInfo,
      year: meta.year,
      genres: meta.genres || [],
      director: meta.director ? meta.director.join(', ') : null,
      cast: meta.cast ? meta.cast.slice(0, 5).join(', ') : null,
      imdbRating: meta.imdbRating,
      runtime: meta.runtime,
      country: meta.country,
      awards: meta.awards
    };
  } catch (error) {
    console.error('Error fetching from Cinemeta:', error);
    return null;
  }
}

/**
 * Fetches series metadata from Cinemeta by IMDb ID
 * @param {string} imdbId - IMDb ID (e.g., tt1234567)
 * @returns {Promise<Object|null>} Series metadata or null
 */
export async function getSeriesByImdbId(imdbId) {
  if (!imdbId || !imdbId.startsWith('tt')) {
    return null;
  }

  try {
    const url = `${CINEMETA_BASE_URL}/meta/series/${imdbId}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const meta = data.meta;

    if (!meta) {
      return null;
    }

    // Process videos (episodes) to get season information
    const videos = meta.videos || [];
    const seasons = [];
    const seasonMap = new Map();

    videos.forEach(video => {
      if (video.season && !seasonMap.has(video.season)) {
        seasonMap.set(video.season, {
          season: video.season,
          episodeCount: videos.filter(v => v.season === video.season).length
        });
      }
    });

    seasonMap.forEach(value => seasons.push(value));

    return {
      name: meta.name,
      poster: meta.poster,
      background: meta.background,
      logo: meta.logo,
      description: meta.description,
      releaseInfo: meta.releaseInfo,
      year: meta.year,
      genres: meta.genres || [],
      director: meta.director ? meta.director.join(', ') : null,
      cast: meta.cast ? meta.cast.slice(0, 5).join(', ') : null,
      imdbRating: meta.imdbRating,
      runtime: meta.runtime,
      country: meta.country,
      awards: meta.awards,
      status: meta.status,
      videos: videos,
      seasons: seasons
    };
  } catch (error) {
    console.error('Error fetching series from Cinemeta:', error);
    return null;
  }
}

/**
 * Searches Cinemeta for a movie by title and year
 * @param {string} title - Movie title
 * @param {string} year - Release year
 * @returns {Promise<Object|null>} Movie metadata or null
 */
export async function searchMovie(title, year) {
  try {
    // Cinemeta doesn't have a direct search endpoint, so we try common patterns
    // This is a fallback when we don't have an IMDb ID
    const query = encodeURIComponent(`${title} ${year}`);
    
    // Use a search service or return null (Cinemeta requires IMDb ID)
    // For now, we'll return null as Cinemeta works best with IMDb IDs
    return null;
  } catch (error) {
    console.error('Error searching Cinemeta:', error);
    return null;
  }
}
