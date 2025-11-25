import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

/**
 * Fetches series from MDBList RSS feed
 * MDBList provides curated lists with IMDb IDs
 * Note: RSS feeds are typically limited to 200-250 items
 */
export async function fetchSeriesFromMDBList(feedUrl = 'https://mdblist.com/lists/zeroq/new-releases?rss=9u557z3sb9yiro2r6tqdtdc0n&limit=1000') {
  console.log('Fetching series from MDBList RSS feed...');
  
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`MDBList RSS fetch error: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const result = await parseStringPromise(xmlText);
    
    if (!result.rss || !result.rss.channel || !result.rss.channel[0].item) {
      console.error('Invalid RSS structure');
      return [];
    }

    const items = result.rss.channel[0].item;
    const series = [];
    
    for (const item of items) {
      try {
        // Extract basic info
        const title = item.title?.[0] || '';
        const link = item.link?.[0] || '';
        const description = item.description?.[0] || '';
        
        // Only process TV shows (not movies)
        if (!link.includes('/show/')) continue;
        
        // Extract year from title (e.g., "Title (2025)")
        const yearMatch = title.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
        
        // Clean title (remove year)
        const cleanTitle = title.replace(/\s*\(\d{4}\)/, '').trim();
        
        // Extract IMDb ID from description
        const imdbMatch = description.match(/imdb\.com\/title\/(tt\d+)/);
        if (!imdbMatch) continue; // Skip if no IMDb ID
        
        const imdbId = imdbMatch[1];
        
        // Extract MDBList ID from link
        const mdbIdMatch = link.match(/show\/(tt\d+)/);
        const mdbId = mdbIdMatch ? mdbIdMatch[1] : imdbId;
        
        series.push({
          id: `mdblist-${mdbId}`,
          title: cleanTitle,
          year: year,
          imdbId: imdbId,
          source: 'mdblist'
        });
        
      } catch (error) {
        console.error('Error parsing MDBList item:', error.message);
      }
    }
    
    console.log(`Found ${series.length} TV shows from MDBList`);
    return series;
    
  } catch (error) {
    console.error('MDBList fetch error:', error.message);
    return [];
  }
}

/**
 * Fetches movies from MDBList RSS feed
 * MDBList provides curated lists with IMDb IDs
 * Note: RSS feeds are typically limited to 200-250 items
 */
export async function fetchMoviesFromMDBList(feedUrl = 'https://mdblist.com/lists/zeroq/new-releases?rss=9u557z3sb9yiro2r6tqdtdc0n&limit=1000') {
  console.log('Fetching movies from MDBList RSS feed...');
  
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`MDBList RSS fetch error: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const result = await parseStringPromise(xmlText);
    
    if (!result.rss || !result.rss.channel || !result.rss.channel[0].item) {
      console.error('Invalid RSS structure');
      return [];
    }

    const items = result.rss.channel[0].item;
    const movies = [];
    
    for (const item of items) {
      try {
        // Extract basic info
        const title = item.title?.[0] || '';
        const link = item.link?.[0] || '';
        const description = item.description?.[0] || '';
        
        // Only process movies (not TV shows)
        if (!link.includes('/movie/')) continue;
        
        // Extract year from title (e.g., "Title (2025)")
        const yearMatch = title.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
        
        // Clean title (remove year)
        const cleanTitle = title.replace(/\s*\(\d{4}\)/, '').trim();
        
        // Extract IMDb ID from description
        const imdbMatch = description.match(/imdb\.com\/title\/(tt\d+)/);
        if (!imdbMatch) continue; // Skip if no IMDb ID
        
        const imdbId = imdbMatch[1];
        
        // Extract MDBList ID from link
        const mdbIdMatch = link.match(/movie\/(tt\d+)/);
        const mdbId = mdbIdMatch ? mdbIdMatch[1] : imdbId;
        
        movies.push({
          id: `mdblist-${mdbId}`,
          title: cleanTitle,
          year: year,
          imdbId: imdbId,
          source: 'mdblist'
        });
        
      } catch (error) {
        console.error('Error parsing MDBList item:', error.message);
      }
    }
    
    console.log(`Found ${movies.length} movies from MDBList`);
    return movies;
    
  } catch (error) {
    console.error('MDBList fetch error:', error.message);
    return [];
  }
}

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
