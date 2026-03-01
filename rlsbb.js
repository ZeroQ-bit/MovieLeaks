import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// In-memory cache for IMDB IDs (survives across requests)
const imdbIdCache = new Map();

/**
 * Fetches IMDB ID from a movie detail page with timeout
 */
async function fetchImdbId(movieUrl) {
  // Check cache first
  if (imdbIdCache.has(movieUrl)) {
    return imdbIdCache.get(movieUrl);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout per URL
    
    const response = await fetch(movieUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      imdbIdCache.set(movieUrl, null);
      return null;
    }

    const html = await response.text();
    const imdbMatch = html.match(/imdb\.com\/title\/(tt\d+)/);
    const imdbId = imdbMatch ? imdbMatch[1] : null;
    
    imdbIdCache.set(movieUrl, imdbId);
    return imdbId;
  } catch (error) {
    console.error(`Failed to fetch IMDB ID from ${movieUrl}:`, error.message);
    imdbIdCache.set(movieUrl, null);
    return null;
  }
}

/**
 * Fetches movies from rlsbb.to "Recommended movies" widget
 */
export async function fetchMovies(limit = 300) {
  console.log(`Fetching movies from rlsbb.to...`);
  
  const movieLinks = [];
  const seenSlugs = new Set();
  
  try {
    // First, fetch from homepage widget for latest movies
    const homeResponse = await fetch('https://rlsbb.to/', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    });

    if (homeResponse.ok) {
      const homeHtml = await homeResponse.text();
      const $home = cheerio.load(homeHtml);
      
      $home('#text-9 .textwidget a').each((i, el) => {
        const link = $home(el).attr('href');
        
        if (link) {
          const urlMatch = link.match(/\/([^\/]+)\/?$/);
          if (!urlMatch) return;
          
          const slug = urlMatch[1];
          
          // Skip if we've seen this slug
          if (seenSlugs.has(slug)) return;
          seenSlugs.add(slug);
          
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
    }
    
    console.log(`Found ${movieLinks.length} movies from homepage widget`);
    
    // Now fetch from category pages for more movies
    const maxPages = Math.min(Math.ceil((limit - movieLinks.length) / 20), 5); // ~20 movies per page, max 5 pages
    
    for (let page = 1; page <= maxPages && movieLinks.length < limit; page++) {
      const url = page === 1 
        ? 'https://rlsbb.to/category/movies/' 
        : `https://rlsbb.to/category/movies/page/${page}/`;
      
      console.log(`Fetching category page ${page}...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'text/html'
        }
      });

      if (!response.ok) {
        console.error(`Category page ${page} returned ${response.status}`);
        break;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract movie links from post titles
      $('h2.entry-title a, h1.entry-title a').each((i, el) => {
        const link = $(el).attr('href');
        
        if (link) {
          const urlMatch = link.match(/\/([^\/]+)\/?$/);
          if (!urlMatch) return;
          
          const slug = urlMatch[1];
          
          // Skip if we've seen this slug
          if (seenSlugs.has(slug)) return;
          seenSlugs.add(slug);
          
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
      
      // Stop if we have enough movies
      if (movieLinks.length >= limit) break;
    }
    
    console.log(`Found ${movieLinks.length} total movies, fetching IMDB IDs...`);
    
    // Second pass: fetch IMDB IDs in parallel batches (larger batches for faster processing)
    const limitedMovies = movieLinks.slice(0, limit);
    const batchSize = 30; // Increased from 10 to 30 for faster parallel processing
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
      
      // Log progress less frequently to reduce overhead
      if ((i / batchSize) % 2 === 0) {
        console.log(`Fetched ${movies.length}/${limitedMovies.length} movies...`);
      }
    }
    
    // Filter out movies without IMDB IDs early to reduce downstream processing
    const moviesWithIds = movies.filter(m => m.imdbId);
    console.log(`Fetched ${moviesWithIds.length}/${movies.length} movies with IMDB IDs`);
    return moviesWithIds;
    
  } catch (error) {
    console.error('rlsbb.to error:', error.message);
    return [];
  }
}

/**
 * Fetches TV series from rlsbb.to
 * Groups episodes by series and returns unique series with their IMDb IDs
 */
export async function fetchSeries(limit = 300) {
  console.log(`Fetching TV series from rlsbb.to...`);
  
  try {
    const seriesMap = new Map();
    const maxPages = 15; // Fetch first 15 pages to find more S01 premieres
    
    // Fetch multiple pages from TV shows category
    for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 
      ? 'https://rlsbb.to/category/tv-shows/' 
      : `https://rlsbb.to/category/tv-shows/page/${page}/`;
    
    console.log(`Fetching page ${page}...`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'text/html'
        }
      });

      if (!response.ok) {
        console.log(`Page ${page} returned ${response.status}, stopping`);
        break;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Collect all series episode links from this page
      $('.entry-title a').each((i, el) => {
        const link = $(el).attr('href');
        
        if (link) {
          const urlMatch = link.match(/\/([^\/]+)\/?$/);
          if (!urlMatch) return;
          
          const slug = urlMatch[1];
          
          // Match TV series patterns: 
          // - show-name-year-s01e01- (with year)
          // - show-name-s01e01- (without year)
          // Examples: tracker-2024-s03e05-, heartland-ca-s19e07-
          const seriesMatch = slug.match(/^(.+?)-(?:(\d{4})-)?s(\d+)(?:e(\d+))?-/i);
          
          if (seriesMatch) {
            const rawTitle = seriesMatch[1];
            const year = seriesMatch[2] || new Date().getFullYear().toString();
            const season = parseInt(seriesMatch[3]);
            const episode = seriesMatch[4] ? parseInt(seriesMatch[4]) : null;
            
            // Clean up title
            const title = rawTitle.split('-').map(w => 
              w.charAt(0).toUpperCase() + w.slice(1)
            ).join(' ');
            
            // Use base title + season as unique series ID
            const seriesId = `${rawTitle}-s${season.toString().padStart(2, '0')}`;
            
            // Store episode info
            if (!seriesMap.has(seriesId)) {
              seriesMap.set(seriesId, {
                id: seriesId,
                title: title,
                year: year,
                url: link,
                episodes: [],
                season: season
              });
            }
            
            // Add episode info
            if (episode) {
              seriesMap.get(seriesId).episodes.push({
                season: season,
                episode: episode,
                url: link
              });
            }
          }
        }
      });
      
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message);
      break;
    }
  }
  
    // Convert map to array
    const uniqueSeries = Array.from(seriesMap.values());
    console.log(`Found ${uniqueSeries.length} unique TV series, fetching IMDB IDs...`);
    
    // Second pass: fetch IMDB IDs in parallel batches
    const limitedSeries = uniqueSeries.slice(0, limit);
    const batchSize = 10;
    const series = [];
    
    for (let i = 0; i < limitedSeries.length; i += batchSize) {
      const batch = limitedSeries.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (show) => {
          const imdbId = await fetchImdbId(show.url);
          return {
            id: show.id,
            title: show.title,
            year: show.year,
            imdbId: imdbId || undefined,
            episodeCount: show.episodes.length
          };
        })
      );
      series.push(...results);
      console.log(`Fetched ${series.length}/${limitedSeries.length} series...`);
    }
    
    console.log(`Fetched ${series.length} TV series with IMDB IDs`);
    return series;
    
  } catch (error) {
    console.error('rlsbb.to series error:', error.message);
    return [];
  }
}