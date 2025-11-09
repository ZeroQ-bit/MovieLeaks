import fetch from 'node-fetch';

/**
 * Fetches poster from RPDB (RatingPosterDB) with Rotten Tomatoes score overlay
 * @param {string} imdbId - IMDb ID (e.g., 'tt1234567')
 * @param {string} apiKey - RPDB API key
 * @returns {Promise<string|null>} RPDB poster URL or null if unavailable
 */
export async function getRPDBPoster(imdbId, apiKey) {
  if (!apiKey || !imdbId || !imdbId.startsWith('tt')) {
    return null;
  }

  try {
    // RPDB API endpoint format
    const rpdbUrl = `https://api.ratingposterdb.com/${apiKey}/imdb/poster-default/${imdbId}.jpg`;
    
    // Validate that the poster exists (optional, can just return URL directly)
    const response = await fetch(rpdbUrl, { method: 'HEAD' });
    
    if (response.ok) {
      console.log(`RPDB poster found for ${imdbId}`);
      return rpdbUrl;
    }
    
    console.log(`No RPDB poster for ${imdbId}`);
    return null;
  } catch (error) {
    console.error(`Error fetching RPDB poster for ${imdbId}:`, error.message);
    return null;
  }
}

/**
 * Gets RPDB poster URL without validation (faster, no API call)
 * Use this if you want to just construct the URL without checking availability
 */
export function getRPDBPosterUrl(imdbId, apiKey) {
  if (!apiKey || !imdbId || !imdbId.startsWith('tt')) {
    return null;
  }
  
  return `https://api.ratingposterdb.com/${apiKey}/imdb/poster-default/${imdbId}.jpg`;
}
