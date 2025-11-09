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

    // Parse and structure the ratings - MDBList returns ratings as an array of objects
    const ratingsArray = data.ratings || [];
    
    // Helper function to find rating by source
    const getRating = (source) => {
      const rating = ratingsArray.find(r => r.source === source);
      return rating?.value || null;
    };
    
    const ratings = {
      imdb: getRating('imdb'),
      tmdb: getRating('tmdb'),
      trakt: getRating('trakt'),
      metacritic: getRating('metacritic'),
      rottenTomatoes: getRating('tomatoes'),
      rottenTomatoesAudience: getRating('tomatoesaudience'),
      letterboxd: getRating('letterboxd'),
      myanimelist: getRating('myanimelist'),
      
      // Additional metadata
      votes: {
        imdb: ratingsArray.find(r => r.source === 'imdb')?.votes || null,
        tmdb: ratingsArray.find(r => r.source === 'tmdb')?.votes || null,
        trakt: ratingsArray.find(r => r.source === 'trakt')?.votes || null,
        letterboxd: ratingsArray.find(r => r.source === 'letterboxd')?.votes || null
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

  if (ratings.imdb) {
    parts.push(`⭐ ${ratings.imdb}`);
  }

  if (ratings.rottenTomatoes) {
    parts.push(`� ${ratings.rottenTomatoes}%`);
  }

  if (ratings.metacritic) {
    parts.push(`Ⓜ️ ${ratings.metacritic}`);
  }

  if (ratings.tmdb) {
    parts.push(`🎬 ${ratings.tmdb}`);
  }

  if (ratings.rottenTomatoesAudience) {
    parts.push(`� ${ratings.rottenTomatoesAudience}%`);
  }

  if (ratings.trakt) {
    parts.push(`📺 ${ratings.trakt}%`);
  }

  if (ratings.letterboxd) {
    parts.push(`📽️ ${ratings.letterboxd}`);
  }

  return parts.length > 0 ? '\n\n' + parts.join('  ') : '';
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
