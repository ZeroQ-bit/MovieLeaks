import fetch from 'node-fetch';

/**
 * Fetches posts from r/movieleaks using both JSON API and RSS as fallback
 * @param {number} limit - Maximum number of posts to fetch
 * @returns {Promise<Array>} Array of parsed movie data
 */
export async function fetchMovieLeaks(limit = 300) {
  let allPosts = [];
  
  // Try JSON API first
  try {
    allPosts = await fetchFromJsonApi(limit);
    if (allPosts.length > 0) {
      console.log(`Successfully fetched ${allPosts.length} posts from JSON API`);
    } else {
      throw new Error('No posts from JSON API, trying RSS');
    }
  } catch (error) {
    console.log(`JSON API failed: ${error.message}, falling back to RSS`);
    // Fallback to RSS
    try {
      allPosts = await fetchFromRSS();
      console.log(`Successfully fetched ${allPosts.length} posts from RSS`);
    } catch (rssError) {
      console.error('Both JSON API and RSS failed:', rssError.message);
      return [];
    }
  }
  
  // Parse and extract movie information
  const movies = allPosts
    .map(post => parseMoviePost(post))
    .filter(movie => movie !== null);

  console.log(`Successfully fetched ${movies.length} movies from ${allPosts.length} Reddit posts`);
  return movies;
}

/**
 * Fetch from Reddit JSON API with pagination
 */
async function fetchFromJsonApi(limit) {
  const allPosts = [];
  let after = null;
  const postsPerPage = 100;
  
  while (allPosts.length < limit) {
    const url = `https://www.reddit.com/r/movieleaks/new.json?limit=${postsPerPage}${after ? `&after=${after}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit JSON API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const posts = data.data.children.map(child => child.data);
    
    if (posts.length === 0) {
      break;
    }
    
    allPosts.push(...posts);
    after = data.data.after;
    
    console.log(`Fetched ${posts.length} posts, total so far: ${allPosts.length}, after: ${after}`);
    
    if (!after) {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return allPosts;
}

/**
 * Fetch from Reddit RSS feed (fallback)
 */
async function fetchFromRSS() {
  const url = `https://www.reddit.com/r/movieleaks/new/.rss?limit=100`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
  });

  if (!response.ok) {
    throw new Error(`Reddit RSS returned ${response.status}: ${response.statusText}`);
  }

  const xmlText = await response.text();
  return parseRSSFeed(xmlText);
}

/**
 * Parse RSS feed
 */
function parseRSSFeed(xmlText) {
  const posts = [];
  const entryPattern = /<entry>(.*?)<\/entry>/gs;
  const entries = xmlText.match(entryPattern) || [];
  
  for (const entry of entries) {
    const title = (entry.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
    const link = (entry.match(/<link href="(.*?)"/s) || [])[1] || '';
    const content = (entry.match(/<content type="html">(.*?)<\/content>/s) || [])[1] || '';
    const author = (entry.match(/<name>(.*?)<\/name>/s) || [])[1] || '';
    const updated = (entry.match(/<updated>(.*?)<\/updated>/s) || [])[1] || '';
    
    const decodedTitle = decodeHtmlEntities(title);
    const decodedContent = decodeHtmlEntities(content);
    
    posts.push({
      title: decodedTitle,
      url: link,
      selftext: stripHtmlTags(decodedContent),
      author: author.replace('/u/', ''),
      created_utc: new Date(updated).getTime() / 1000,
      score: 0,
      permalink: link.replace('https://www.reddit.com', ''),
      preview: extractImageFromContent(decodedContent),
      thumbnail: extractImageFromContent(decodedContent)
    });
  }
  
  return posts;
}

function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
  };
  return text.replace(/&[^;]+;/g, entity => entities[entity] || entity);
}

function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractImageFromContent(html) {
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

/**
 * Parses a Reddit post to extract movie information
 * @param {Object} post - Reddit post data
 * @returns {Object|null} Parsed movie data or null if not a valid movie post
 */
function parseMoviePost(post) {
  const title = post.title;
  
  // Try to extract movie title and year
  // Matches patterns like: "Movie Title (2025)", "Movie Title 2025", etc.
  const yearPattern = /(.+?)\s*[(\[]?\s*(\d{4})\s*[)\]]?/;
  const match = title.match(yearPattern);

  if (!match) {
    return null; // Skip posts without recognizable movie format
  }

  const movieTitle = match[1].trim();
  const year = match[2];

  // Extract IMDb ID from post content or URL
  const imdbPattern = /(?:imdb\.com\/title\/)?(tt\d+)/i;
  const imdbMatch = (post.selftext + ' ' + post.url).match(imdbPattern);
  const imdbId = imdbMatch ? imdbMatch[1] : null;

  // Generate a unique ID (prefer IMDb ID, fallback to slug)
  const id = imdbId || generateSlug(movieTitle, year);

  return {
    id,
    imdbId,
    title: movieTitle,
    year,
    poster: extractPoster(post),
    description: extractDescription(post),
    redditUrl: `https://www.reddit.com${post.permalink}`,
    author: post.author,
    score: post.score,
    created: post.created_utc,
    thumbnail: post.thumbnail !== 'self' && post.thumbnail !== 'default' ? post.thumbnail : null
  };
}

/**
 * Extracts poster URL from post
 */
function extractPoster(post) {
  // Check for preview images
  if (post.preview && post.preview.images && post.preview.images.length > 0) {
    const image = post.preview.images[0];
    if (image.source && image.source.url) {
      // Decode HTML entities in URL
      return image.source.url.replace(/&amp;/g, '&');
    }
  }

  // Check for direct image link
  if (post.url && (post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.jpeg'))) {
    return post.url;
  }

  return null;
}

/**
 * Extracts description from post content
 */
function extractDescription(post) {
  if (post.selftext && post.selftext.trim().length > 0) {
    // Remove markdown formatting and truncate
    const cleaned = post.selftext
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
      .replace(/[#*_~`]/g, '') // Remove markdown formatting
      .trim();
    
    return cleaned.length > 500 ? cleaned.substring(0, 500) + '...' : cleaned;
  }

  return null;
}

/**
 * Generates a URL-safe slug for a movie
 */
function generateSlug(title, year) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${year}`;
}
