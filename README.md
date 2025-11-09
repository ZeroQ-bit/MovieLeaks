# Movie Leaks - Stremio Addon

A Stremio addon that catalogs leaked and upcoming movies from the r/movieleaks subreddit. This addon automatically fetches the latest posts from the subreddit, parses movie information, and presents them as a browsable catalog in Stremio.

## Features

- 📺 **Automatic Catalog**: Fetches latest movie posts from r/movieleaks
- 🎬 **Movie Parsing**: Extracts movie titles, years, IMDb links, and posters from Reddit posts
- 🖼️ **Rich Metadata**: Uses Cinemeta (Stremio's official metadata addon) for high-quality posters, genres, descriptions, cast, and IMDb ratings
- ⭐ **RPDB Integration**: Optional support for RatingPosterDB - get posters with Rotten Tomatoes scores overlaid!
- 🍅 **MDBList Integration**: Optional comprehensive ratings from Rotten Tomatoes, IMDb, Metacritic, TMDb, Trakt, Letterboxd & more!
- ⚡ **Caching**: 30-minute cache to reduce API calls and improve performance
- 🔗 **Links**: Direct links to Reddit posts and IMDb pages for each movie
- 🔑 **No API Keys Required**: Works out of the box, RPDB and MDBList are optional

## Installation

### Prerequisites

- Node.js 18+ (for ES modules support)
- npm or yarn

### Quick Start

1. **Clone or download this project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the addon server**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Install in Stremio**
   - Open Stremio
   - Go to Addons (puzzle icon in top right)
   - Paste this URL in the search box: `http://localhost:7000/manifest.json`
   - Click Install
   - **Optional**: Configure RPDB API key for posters with Rotten Tomatoes scores (see Configuration below)
   - Browse the "Movie Leaks" catalog in the Discover section

## Configuration

### RPDB (RatingPosterDB) - Optional

Want posters with Rotten Tomatoes scores overlaid? Follow these steps:

1. **Get an RPDB API Key**:
   - Visit [RatingPosterDB](https://ratingposterdb.com/)
   - Sign up for a free account
   - Get your API key from your account settings

2. **Configure in Stremio**:
   - When installing the addon, you'll see a configuration screen
   - Enter your RPDB API key in the "RPDB API Key" field
   - Click "Install"
   - Your posters will now show Rotten Tomatoes scores!

3. **Reconfigure Later**:
   - Go to Stremio's addon settings
   - Find "Movie Leaks Catalog"
   - Click the gear icon to update your RPDB API key

**Note**: Without an RPDB key, the addon still works great using regular posters from Cinemeta and Reddit.

### MDBList - Optional

Want comprehensive ratings from multiple sources displayed in movie descriptions?

1. **Get an MDBList API Key**:
   - Visit [MDBList](https://mdblist.com/)
   - Sign up for a free account
   - Navigate to your [API settings](https://mdblist.com/preferences/) to get your API key

2. **Configure in Stremio**:
   - When installing the addon, enter your MDBList API key in the "MDBList API Key" field
   - Click "Install"
   - Movie descriptions will now include ratings from:
     - 🍅 Rotten Tomatoes (Critics & Audience)
     - ⭐ IMDb
     - Ⓜ️ Metacritic
     - 🎬 TMDb
     - 📺 Trakt
     - 📽️ Letterboxd
     - And more!

3. **What You Get**:
   - All ratings displayed in the movie detail page description
   - Easy comparison across multiple rating platforms
   - More informed viewing decisions

**Note**: MDBList is completely optional. The addon works perfectly without it using Cinemeta's IMDb ratings.

### Environment Variables

Create a `.env` file in the project root (optional):

```env
# Server port (default: 7000)
PORT=7000
```

### How It Works

1. **Reddit Scraping**: The addon uses Reddit's public JSON API (`https://www.reddit.com/r/movieleaks/new.json`) to fetch the latest posts
2. **Parsing**: Extracts movie titles, years, IMDb IDs, and available images from post titles and content
3. **Enrichment**: For movies with IMDb IDs, fetches complete metadata from Cinemeta (Stremio's official metadata service) including:
   - High-quality posters and backgrounds
   - Full descriptions and plot summaries
   - Genres, director, and cast information
   - IMDb ratings and awards
   - Runtime and release information
4. **Caching**: Results are cached for 30 minutes to reduce load on Reddit and Cinemeta APIs
5. **Serving**: Presents data through Stremio's addon protocol

## Project Structure

```
MovieLeaks/
├── index.js          # Main addon server and handlers
├── reddit.js         # Reddit API client and parser
├── cinemeta.js       # Cinemeta API integration
├── rpdb.js           # RatingPosterDB integration
├── mdblist.js        # MDBList ratings integration
├── package.json      # Dependencies and scripts
├── .env.example      # Environment template
└── README.md         # This file
```

## API Endpoints

Once running, the addon exposes these endpoints:

- `GET /manifest.json` - Addon manifest (used by Stremio to install)
- `GET /catalog/movie/movieleaks.json` - List of movies from r/movieleaks
- `GET /meta/movie/:id.json` - Detailed metadata for a specific movie

## Deployment

### Local Network Access

To access from other devices on your network:
1. Find your local IP address (e.g., `192.168.1.100`)
2. Use `http://192.168.1.100:7000/manifest.json` in Stremio

### Cloud Deployment (Vercel)

This addon can be deployed to Vercel for free:

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Add `TMDB_API_KEY` if you want enhanced metadata

4. Use the Vercel URL in Stremio: `https://your-project.vercel.app/manifest.json`

### Other Platforms

The addon can also run on:
- **Heroku**: Add a `Procfile` with `web: node index.js`
- **Railway**: Works out of the box
- **Glitch**: Import from GitHub and set secrets
- **DigitalOcean App Platform**: Deploy as a web service

## Legal Notice

This addon is a catalog aggregator that displays publicly available information from Reddit. It does not host, link to, or provide any copyrighted content or streams. Users are responsible for complying with their local laws regarding content access.

The addon:
- ✅ Displays metadata (titles, descriptions, posters) from public sources
- ✅ Links to Reddit posts and IMDb pages
- ❌ Does NOT provide streams or downloads
- ❌ Does NOT host any copyrighted content

## Troubleshooting

### "Cannot find module" errors
Make sure you've run `npm install` and are using Node.js 18+

### No movies showing up
- Check if Reddit is accessible from your network
- Try running manually: `node index.js` and look for errors
- Verify the addon is cached by checking console logs

### Movies without metadata
- Only movies with IMDb IDs get full metadata from Cinemeta
- Reddit posts should include IMDb links for best results
- Movies without IMDb IDs will show basic info from Reddit

### Addon not installing in Stremio
- Make sure the server is running (`npm start`)
- Check the URL is exactly: `http://localhost:7000/manifest.json`
- Try accessing the URL in a browser first to verify it works

## Development

To modify the addon:

1. Edit the source files
2. Restart the server (or use `npm run dev` for auto-reload)
3. The changes will be reflected immediately in Stremio

### Adding Stream Support

If you want to add actual streaming capability:

1. Add `"stream"` to the `resources` array in `manifest` (index.js)
2. Implement a `defineStreamHandler` that returns torrent/stream links
3. Parse magnet links or streaming URLs from Reddit posts/comments

## Credits

- Built with [Stremio Addon SDK](https://github.com/Stremio/stremio-addon-sdk)
- Data from [r/movieleaks](https://www.reddit.com/r/movieleaks/)
- Metadata from [Cinemeta](https://github.com/Stremio/stremio-addon-sdk) (Stremio's official metadata addon)

## License

MIT License - feel free to use and modify as needed.
