import fetch from 'node-fetch';

/**
 * Fetches ratings from MDBList API
 * Provides IMDb, TMDb, Trakt, Metacritic, Rotten Tomatoes, and more
 * @param {string} imdbId - IMDb ID (e.g., 'tt1234567')
 * @param {string} apiKey - MDBList API key
 * @returns {Promise<Object|null>} Ratings data or null if unavailable
 */
export async function getMDBListRatings(imdbId, apiKey) {
  if (!apiKey || !imdbId || !imdbId.startsWith('tt')) {
    console.log(`MDBList: Skipping ${imdbId} - missing API key or invalid IMDb ID`);
    return null;
  }

  try {
    // MDBList API endpoint
    const url = `https://mdblist.com/api/?apikey=${apiKey}&i=${imdbId}`;
    
    console.log(`MDBList: Fetching ratings for ${imdbId}...`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`MDBList API error for ${imdbId}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    console.log(`MDBList: Response for ${imdbId}:`, JSON.stringify(data).substring(0, 200));
    
    if (data.response === 'False' || !data.ratings) {
      console.log(`No MDBList ratings data for ${imdbId}`);
      return null;
    }

    // Parse and structure the ratings
    const ratings = {
      imdb: data.ratings?.imdb || data.imdbrating || null,
      tmdb: data.ratings?.tmdb || data.tmdbrating || null,
      trakt: data.ratings?.trakt || data.traktrating || null,
      metacritic: data.ratings?.metacritic || data.metacriticrating || null,
      rottenTomatoes: data.ratings?.tomatoes || data.tomatoesrating || null,
      rottenTomatoesAudience: data.ratings?.tomatoesaudience || data.tomatoaudiencerating || null,
      letterboxd: data.ratings?.letterboxd || null,
      myanimelist: data.ratings?.myanimelist || data.myanimelistrating || null,
      
      // Additional metadata
      votes: {
        imdb: data.ratings?.imdbvotes || null,
        tmdb: data.ratings?.tmdbvotes || null,
        trakt: data.ratings?.traktvotes || null,
        letterboxd: data.ratings?.letterboxdvotes || null
      },
      
      // Certifications
      certification: data.certification || data.rated || null,
      
      // Release info
      released: data.released || data.year || null,
      runtime: data.runtime || null,
      
      // Additional info
      type: data.type || 'movie',
      title: data.title || null,
      year: data.year || null
    };

    console.log(`MDBList ratings fetched for ${imdbId}: RT=${ratings.rottenTomatoes}%, IMDb=${ratings.imdb}`);
    return ratings;
  } catch (error) {
    console.error(`Error fetching MDBList data for ${imdbId}:`, error.message);
    return null;
  }
}

/**
 * Formats ratings for display in description
 * @param {Object} ratings - Ratings object from getMDBListRatings
 * @returns {string} Formatted ratings text
 */
export function formatRatingsForDescription(ratings) {
  if (!ratings) return '';

  const parts = [];

  if (ratings.rottenTomatoes) {
    parts.push(`🍅 Rotten Tomatoes: ${ratings.rottenTomatoes}%`);
  }
  
  if (ratings.rottenTomatoesAudience) {
    parts.push(`🍿 RT Audience: ${ratings.rottenTomatoesAudience}%`);
  }

  if (ratings.imdb) {
    parts.push(`⭐ IMDb: ${ratings.imdb}/10`);
  }

  if (ratings.metacritic) {
    parts.push(`Ⓜ️ Metacritic: ${ratings.metacritic}/100`);
  }

  if (ratings.tmdb) {
    parts.push(`🎬 TMDb: ${ratings.tmdb}/10`);
  }

  if (ratings.trakt) {
    parts.push(`📺 Trakt: ${ratings.trakt}%`);
  }

  if (ratings.letterboxd) {
    parts.push(`📽️ Letterboxd: ${ratings.letterboxd}/5`);
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n') : '';
}

/**
 * Gets a simple rating badge string for catalog display
 * @param {Object} ratings - Ratings object from getMDBListRatings
 * @returns {string} Rating badge (e.g., "🍅 85%")
 */
export function getRatingBadge(ratings) {
  if (!ratings) return '';

  // Prioritize Rotten Tomatoes, then IMDb
  if (ratings.rottenTomatoes) {
    return `🍅 ${ratings.rottenTomatoes}%`;
  }
  
  if (ratings.imdb) {
    return `⭐ ${ratings.imdb}`;
  }

  return '';
}
