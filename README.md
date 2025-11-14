# Movie Leaks - Stremio Addon

A Stremio addon that catalogs HD movie releases from rlsbb.to. Automatically fetches the latest movies, retrieves IMDB IDs, and presents them as a browsable catalog in Stremio.

## 🆓 Free Tier vs 💎 Supporter Tier

| Feature | Free Tier | Supporter Tier ($5/month) |
|---------|-----------|---------------------------|
| Movies | 70 latest HD releases | All Movies (~70+) |
| Posters | Standard Cinemeta | RPDB with RT scores |
| Updates | ✅ Daily | ⚡ Priority |
| Support | Community | ⚡ Priority |

**[Become a Supporter →](https://ko-fi.com/zeroq/membership)**

## Features

- 📺 **HD Movie Catalog**: Fetches latest HD releases from rlsbb.to (1080p, 720p, 4K)
- 🎬 **IMDB Integration**: Automatically extracts titles, years, and IMDB IDs
- 🖼️ **Rich Metadata**: Uses Cinemeta for high-quality posters, genres, descriptions, cast, and ratings
- 💎 **Supporter Benefits**: Unlock all movies + RPDB posters with Rotten Tomatoes scores
- ⚡ **Fast Loading**: Parallel IMDB fetching in batches of 10
- 🔄 **Smart Caching**: 5-minute cache to improve performance
- 🔗 **Direct Links**: Links to release pages and IMDb

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
   - Browse the "Movie Leaks" catalog in the Discover section (Free: 100 movies)

## 💎 Unlock Full Access (Supporter Tier)

### Why Support?

Running this addon costs real money:
- ☁️ Server hosting fees
- 💾 Storage and bandwidth
- ⏰ Development and maintenance time
- 🐛 Bug fixes and new features

**Your support keeps this project alive!**

### How to Become a Supporter

1. **Subscribe on Ko-fi**: Visit [ko-fi.com/zeroq/membership](https://ko-fi.com/zeroq/membership)
2. **Choose "Movie Leaks Supporter" tier**: $5/month
3. **Receive Your Code**: You'll get a unique supporter code via email
4. **Enter Code in Stremio**:
   - Open Stremio → Addons → Movie Leaks Catalog
   - Click the ⚙️ settings icon
   - Enter your supporter code in "Supporter Code" field
   - Reinstall the addon

### What You Get

✨ **All movie releases** (no limits)  
🎨 **RPDB posters** with Rotten Tomatoes scores  
⚡ **Priority updates** and support  
🚀 **Future premium features** as they're added  
❤️ **Support indie development**

## Configuration

### For Developers: RPDB Setup

If you're self-hosting and want RPDB posters for supporters:

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

**Note**: Without an RPDB key, the addon still works great using regular posters from Cinemeta.

### Environment Variables

Create a `.env` file in the project root (optional):

```env
# Server port (default: 7000)
PORT=7000
```

### How It Works

1. **rlsbb.to Scraping**: The addon scrapes the "Recommended movies" widget from rlsbb.to homepage
2. **IMDB Extraction**: Fetches IMDB IDs from each movie's detail page (in parallel batches of 10)
3. **Cinemeta Lookup**: Uses Stremio's Cinemeta to fetch full metadata (plot, cast, posters, etc.) using IMDB IDs
4. **RPDB Enhancement** (optional): Fetches high-quality posters from RatingPosterDB if configured
5. **Caching**: Results are cached for 5 minutes to reduce load on rlsbb.to and Cinemeta APIs
6. **Serving**: Presents data through Stremio's addon protocol

## Project Structure

```
MovieLeaks/
├── index.js          # Main addon server and handlers
├── rlsbb.js          # rlsbb.to scraper and IMDB fetcher
├── cinemeta.js       # Cinemeta API integration
├── rpdb.js           # RatingPosterDB integration
├── package.json      # Dependencies and scripts
├── .env.example      # Environment template
└── README.md         # This file
```

## API Endpoints

Once running, the addon exposes these endpoints:

- `GET /manifest.json` - Addon manifest (used by Stremio to install)
- `GET /catalog/movie/movieleaks.json` - List of movies from rlsbb.to
- `GET /meta/movie/:id.json` - Detailed metadata for a specific movie

## Deployment

### 🌐 Public Deployment (Vercel - Recommended)

Deploy your addon so others can use it:

```bash
# Install Vercel CLI
npm install -g vercel

# Login and deploy
vercel login
vercel

# For production deployment
vercel --prod
```

Your addon will be available at: `https://your-project.vercel.app/manifest.json`

**📖 Full deployment guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Zerr0-C00L/Movie-Leaks)

### 📢 Publishing to Stremio Community Addons

After deployment, you can submit your addon to the community:

1. Visit: **https://beta.stremio-addons.net**
2. Submit your manifest URL: `https://your-project.vercel.app/manifest.json`

**Note:** Not all community addons appear in Stremio's internal catalog. Users can always install your addon directly by pasting your manifest URL in Stremio!

**Share your addon URL:**
```
https://your-project.vercel.app/manifest.json
```
Users can install it via: Stremio → Addons → Install from URL

### 🏠 Local Network Access

To access from other devices on your network:
1. Find your local IP address (e.g., `192.168.1.100`)
2. Use `http://192.168.1.100:7000/manifest.json` in Stremio

### 🔧 Other Platforms

The addon can also run on:
- **Heroku**: Add a `Procfile` with `web: node index.js`
- **Railway**: Works out of the box
- **Beamup**: Stremio's recommended platform
- **Glitch**: Import from GitHub and set secrets
- **DigitalOcean App Platform**: Deploy as a web service

## Legal Notice

This addon is a catalog aggregator that displays publicly available information from rlsbb.to. It does not host, link to, or provide any copyrighted content or streams. Users are responsible for complying with their local laws regarding content access.

The addon:
- ✅ Displays metadata (titles, descriptions, posters) from public sources
- ✅ Links to release info pages and IMDb
- ❌ Does NOT provide streams or downloads
- ❌ Does NOT host any copyrighted content

## Troubleshooting

### "Cannot find module" errors
Make sure you've run `npm install` and are using Node.js 18+

### No movies showing up
- Check if rlsbb.to is accessible from your network
- Try running manually: `node index.js` and look for errors
- First load takes ~10 seconds to fetch all IMDB IDs
- Check console logs for scraping errors

### Movies without metadata
- All movies should have IMDB IDs from rlsbb.to
- If metadata is missing, Cinemeta might be down
- Check if IMDB ID was extracted correctly in logs

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

This addon is catalog-only. For streams, install other Stremio addons like:
- Torrentio
- MediaFusion
- Comet

The catalog will appear in your Stremio library, and your stream addons will provide links automatically.

## Bug Reports & Feature Requests

Found a bug or have a feature idea? Please report it!

### How to Report Issues

1. **Check Existing Issues**: Visit our [Issues page](https://github.com/Zerr0-C00L/MovieLeaks-Issues/issues) to see if it's already been reported
2. **Create a New Issue**: Click "New Issue" and choose the appropriate template:
   - 🐛 **Bug Report** - For bugs and problems
   - ✨ **Feature Request** - For new features or enhancements
3. **Provide Details**: Fill out the template with as much information as possible

### What to Include

- **For Bugs**: Steps to reproduce, screenshots, Stremio version, platform (Windows/Mac/Android/etc.)
- **For Features**: Clear description of what you want and why it would be useful

### Alternative Support

- **Community**: Join the [Stremio Discord](https://discord.gg/zNRf6YF) for quick help
- **Email**: Contact directly for private issues
- **Support Development**: [Ko-fi donations](https://ko-fi.com/zeroq) help keep this project alive!

## Credits

- Built with [Stremio Addon SDK](https://github.com/Stremio/stremio-addon-sdk)
- Movie releases from [rlsbb.to](https://rlsbb.to/)
- Metadata from [Cinemeta](https://github.com/Stremio/stremio-addon-sdk) (Stremio's official metadata addon)
- Posters from [RatingPosterDB](https://ratingposterdb.com/) (optional)

## License

MIT License - feel free to use and modify as needed.
