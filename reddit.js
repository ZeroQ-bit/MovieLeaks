import fetch from 'node-fetch';

/**
 * Fetches IMDB ID from a Reddit post by checking comments and text
 */
async function fetchImdbIdFromPost(postUrl) {
  try {
    // Add .json to get JSON response
    const jsonUrl = postUrl.endsWith('/') ? `${postUrl}.json` : `${postUrl}.json`;
    
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    
    // Check post selftext and title
    const post = data[0]?.data?.children[0]?.data;
    if (!post) return null;
    
    const textToSearch = `${post.title} ${post.selftext || ''} ${post.url || ''}`;
    
    // Look for IMDb links or IDs
    const imdbMatch = textToSearch.match(/(?:imdb\.com\/title\/|tt)(\d{7,8})/i);
    if (imdbMatch) {
      return imdbMatch[1].startsWith('tt') ? imdbMatch[1] : `tt${imdbMatch[1]}`;
    }
    
    // Check comments for IMDb links
    const comments = data[1]?.data?.children || [];
    for (const comment of comments) {
      const commentBody = comment.data?.body || '';
      const commentImdb = commentBody.match(/(?:imdb\.com\/title\/|tt)(\d{7,8})/i);
      if (commentImdb) {
        return commentImdb[1].startsWith('tt') ? commentImdb[1] : `tt${commentImdb[1]}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to fetch IMDb from Reddit post ${postUrl}:`, error.message);
    return null;
  }
}

/**
 * Fetches movies from r/movieleaks
 */
export async function fetchMoviesFromReddit(limit = 100) {
  console.log(`Fetching movies from r/movieleaks...`);
  
  try {
    const url = 'https://www.reddit.com/r/movieleaks.json?limit=100';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit returned ${response.status}`);
    }

    const data = await response.json();
    const posts = data.data?.children || [];
    
    console.log(`Found ${posts.length} posts from r/movieleaks`);
    
    const movieLinks = [];
    
    // First pass: collect movie info from posts
    for (const post of posts) {
      const postData = post.data;
      
      // Extract title and year from post title
      // Common formats: "Movie Title (2024)", "Movie Title 2024", etc.
      const titleText = postData.title;
      const yearMatch = titleText.match(/\((\d{4})\)|\s(\d{4})$/);
      const year = yearMatch ? (yearMatch[1] || yearMatch[2]) : new Date().getFullYear().toString();
      
      // Clean title (remove year)
      let cleanTitle = titleText
        .replace(/\(\d{4}\)/, '')
        .replace(/\s\d{4}$/, '')
        .trim();
      
      // Skip if it looks like a discussion post
      if (cleanTitle.toLowerCase().includes('discussion') || 
          cleanTitle.toLowerCase().includes('request') ||
          cleanTitle.toLowerCase().includes('looking for')) {
        continue;
      }
      
      const id = `reddit-${postData.id}`;
      
      movieLinks.push({
        id,
        title: cleanTitle,
        year,
        postUrl: `https://www.reddit.com${postData.permalink}`,
        created: postData.created_utc
      });
      
      if (movieLinks.length >= limit) break;
    }
    
    console.log(`Collected ${movieLinks.length} movie posts, fetching IMDb IDs...`);
    
    // Second pass: fetch IMDb IDs in parallel batches
    const batchSize = 5; // Smaller batches to avoid rate limiting
    const movies = [];
    
    for (let i = 0; i < movieLinks.length; i += batchSize) {
      const batch = movieLinks.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (movie) => {
          const imdbId = await fetchImdbIdFromPost(movie.postUrl);
          return {
            id: movie.id,
            title: movie.title,
            year: movie.year,
            imdbId: imdbId || undefined,
            source: 'reddit'
          };
        })
      );
      movies.push(...results);
      console.log(`Fetched ${movies.length}/${movieLinks.length} Reddit movies...`);
      
      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < movieLinks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Fetched ${movies.length} movies from r/movieleaks`);
    return movies;
    
  } catch (error) {
    console.error('r/movieleaks error:', error.message);
    return [];
  }
}

/**
 * Fetches TV series from r/movieleaks (if any are posted there)
 */
export async function fetchSeriesFromReddit(limit = 50) {
  console.log(`Checking r/movieleaks for TV series posts...`);
  
  try {
    const url = 'https://www.reddit.com/r/movieleaks.json?limit=100';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit returned ${response.status}`);
    }

    const data = await response.json();
    const posts = data.data?.children || [];
    
    const seriesLinks = [];
    
    // Look for posts that mention seasons/episodes
    for (const post of posts) {
      const postData = post.data;
      const titleText = postData.title;
      
      // Check if it's a series (has S01, Season, etc.)
      const seriesMatch = titleText.match(/S(\d+)|Season\s*(\d+)/i);
      if (!seriesMatch) continue;
      
      const yearMatch = titleText.match(/\((\d{4})\)|\s(\d{4})$/);
      const year = yearMatch ? (yearMatch[1] || yearMatch[2]) : new Date().getFullYear().toString();
      
      let cleanTitle = titleText
        .replace(/\(\d{4}\)/, '')
        .replace(/\s\d{4}$/, '')
        .replace(/S\d+E?\d*/gi, '')
        .replace(/Season\s*\d+/gi, '')
        .trim();
      
      const id = `reddit-series-${postData.id}`;
      
      seriesLinks.push({
        id,
        title: cleanTitle,
        year,
        postUrl: `https://www.reddit.com${postData.permalink}`,
        created: postData.created_utc
      });
      
      if (seriesLinks.length >= limit) break;
    }
    
    if (seriesLinks.length === 0) {
      console.log('No TV series found in r/movieleaks');
      return [];
    }
    
    console.log(`Found ${seriesLinks.length} TV series posts, fetching IMDb IDs...`);
    
    // Fetch IMDb IDs
    const batchSize = 5;
    const series = [];
    
    for (let i = 0; i < seriesLinks.length; i += batchSize) {
      const batch = seriesLinks.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (show) => {
          const imdbId = await fetchImdbIdFromPost(show.postUrl);
          return {
            id: show.id,
            title: show.title,
            year: show.year,
            imdbId: imdbId || undefined,
            source: 'reddit'
          };
        })
      );
      series.push(...results);
      console.log(`Fetched ${series.length}/${seriesLinks.length} Reddit series...`);
      
      if (i + batchSize < seriesLinks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Fetched ${series.length} TV series from r/movieleaks`);
    return series;
    
  } catch (error) {
    console.error('r/movieleaks series error:', error.message);
    return [];
  }
}
