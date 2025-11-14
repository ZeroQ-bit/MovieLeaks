import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Fetches IMDB ID from a movie detail page
 */
async function fetchImdbId(movieUrl) {
  try {
    const response = await fetch(movieUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();
    const imdbMatch = html.match(/imdb\.com\/title\/(tt\d+)/);
    return imdbMatch ? imdbMatch[1] : null;
  } catch (error) {
    console.error(`Failed to fetch IMDB ID from ${movieUrl}:`, error.message);
    return null;
  }
}

/**
 * Fetches movies from rlsbb.to "Recommended movies" widget
 */
export async function fetchMovies(limit = 300) {
  console.log(`Fetching movies from rlsbb.to...`);
  
  const url = 'https://rlsbb.to/';
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    });

    if (!response.ok) {
      throw new Error(`rlsbb.to returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const movieLinks = [];
    
    // First pass: collect all movie links from widget
    $('#text-9 .textwidget a').each((i, el) => {
      const link = $(el).attr('href');
      
      if (link) {
        const urlMatch = link.match(/\/([^\/]+)\/?$/);
        if (!urlMatch) return;
        
        const slug = urlMatch[1];
        const titleMatch = slug.match(/^(.+?)-(\d{4})-/);
        
        if (titleMatch) {
          const rawTitle = titleMatch[1];
          const year = titleMatch[2];
          
          const title = rawTitle.split('-').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ');
          
          const id = rawTitle + '-' + year;
          
          movieLinks.push({
            id,
            title,
            year,
            url: link
          });
        }
      }
    });
    
    console.log(`Found ${movieLinks.length} movies from widget, fetching IMDB IDs...`);
    
    // Second pass: fetch IMDB IDs in parallel batches
    const limitedMovies = movieLinks.slice(0, limit);
    const batchSize = 10;
    const movies = [];
    
    for (let i = 0; i < limitedMovies.length; i += batchSize) {
      const batch = limitedMovies.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (movie) => {
          const imdbId = await fetchImdbId(movie.url);
          return {
            id: movie.id,
            title: movie.title,
            year: movie.year,
            imdbId: imdbId || undefined
          };
        })
      );
      movies.push(...results);
      console.log(`Fetched ${movies.length}/${limitedMovies.length} movies...`);
    }
    
    console.log(`Fetched ${movies.length} movies with IMDB IDs`);
    return movies;
    
  } catch (error) {
    console.error('rlsbb.to error:', error.message);
    return [];
  }
}
