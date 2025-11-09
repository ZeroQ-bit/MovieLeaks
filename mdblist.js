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
    
    console.log(`MDBList: Full response for ${imdbId}:`, JSON.stringify(data));
    
    if (data.response === 'False') {
      console.log(`MDBList returned false for ${imdbId}`);
      return null;
    }

    // Parse and structure the ratings - MDBList can have ratings as nested object or at root level
    const ratingsObj = data.ratings || data;
    
    const ratings = {
      imdb: ratingsObj.imdb || data.imdbrating || null,
      tmdb: ratingsObj.tmdb || data.tmdbrating || null,
      trakt: ratingsObj.trakt || data.traktrating || null,
      metacritic: ratingsObj.metacritic || data.metacriticrating || null,
      rottenTomatoes: ratingsObj.tomatoes || ratingsObj.tomatoesrating || data.tomatoes || data.tomatoesrating || null,
      rottenTomatoesAudience: ratingsObj.tomatoesaudience || ratingsObj.tomatoaudiencerating || data.tomatoesaudience || null,
      letterboxd: ratingsObj.letterboxd || data.letterboxdrating || null,
      myanimelist: ratingsObj.myanimelist || data.myanimelistrating || null,
      
      // Additional metadata
      votes: {
        imdb: ratingsObj.imdbvotes || data.imdbvotes || null,
        tmdb: ratingsObj.tmdbvotes || data.tmdbvotes || null,
        trakt: ratingsObj.traktvotes || data.traktvotes || null,
        letterboxd: ratingsObj.letterboxdvotes || data.letterboxdvotes || null
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

    console.log(`MDBList ratings fetched for ${imdbId}: RT=${ratings.rottenTomatoes}%, IMDb=${ratings.imdb}, TMDb=${ratings.tmdb}, Metacritic=${ratings.metacritic}`);
    
    // Check if we got any actual ratings
    const hasAnyRating = ratings.imdb || ratings.tmdb || ratings.trakt || 
                         ratings.metacritic || ratings.rottenTomatoes || 
                         ratings.rottenTomatoesAudience || ratings.letterboxd;
    
    if (!hasAnyRating) {
      console.log(`No actual ratings available for ${imdbId}`);
      return null;
    }
    
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
