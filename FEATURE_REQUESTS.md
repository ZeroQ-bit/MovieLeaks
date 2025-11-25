# Feature Requests & Roadmap

## Suggested Features

### High Priority

**Implementation:**
- Add multi-select or text input field in config
- Modify reddit.js to accept subreddit parameter
- Aggregate results from multiple sources

---

#### 2. Stream Parsing from Post Titles
- Parse movie names directly from Reddit post titles
- Provide stream metadata without requiring IMDb links
- Allow other addons (Torrentio, Comet, etc.) to find streams

**Benefits:**
- Faster results (no need to wait for IMDb link parsing)
- Works with posts that don't include IMDb links
- Better integration with stream providers

**Implementation:**
- Extract clean movie title from post title
- Use title-based search instead of IMDb-only
- Fallback to IMDb when available for better accuracy

---

### Medium Priority

#### 3. Language Selection
- Add language filter in configuration
- Filter movies by language preference
- Use Cinemeta language metadata

**Implementation:**
- Add language dropdown in config (English, Spanish, French, etc.)
- Filter catalog results based on language field
- Show "All Languages" option by default

---

#### 4. Subreddit Order Management
- Allow users to prioritize certain subreddits
- Reorder sources to show preferred content first
- Merge and deduplicate results intelligently

**Implementation:**
- Drag-and-drop interface (if supported by Stremio config)
- Or numbered priority fields
- Sort catalog by priority order

---

### Low Priority / Under Consideration

#### 5. Enhanced Metadata
- Add release type tags (CAM, WEB-DL, BluRay, etc.)
- Show quality indicators from post titles
- Add release group information

---

#### 6. Content Filtering
- Filter by release year
- Filter by IMDb rating threshold
- Hide already-watched movies (if possible)

---

## Completed Features ✅

- **v1.0.0**: Initial release with r/movieleaks scraping
- **v1.1.0**: RPDB integration for posters with RT scores
- **v1.2.0**: Configuration screen for API keys
- **v1.3.0**: Removed MDBList (platform limitations)
- **v1.3.1**: Fixed cast/genres array compatibility issues

---

## Won't Implement ❌

- AI-powered cryptocurrency recommendations
- Adult content features
- Any features violating Stremio/Reddit ToS
- Features requiring hosting of copyrighted content

---

## Contributing

Have a feature request? Open an issue on GitHub or message on Reddit!

**Repository:** https://github.com/ZeroQ-Cool/MovieLeaks
