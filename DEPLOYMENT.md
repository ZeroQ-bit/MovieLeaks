# Deployment & Publishing Guide

## 🚀 Step 1: Deploy to Vercel (Free)

### Quick Deploy

1. **Install Vercel CLI** (if you haven't already):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy your addon**:
   ```bash
   cd /Users/zeroq/Stremio-Addons/MovieLeaks
   vercel
   ```

4. Follow the prompts:
   - "Set up and deploy?" → **Yes**
   - "Which scope?" → Select your account
   - "Link to existing project?" → **No**
   - "What's your project's name?" → `movieleaks-stremio` (or any name)
   - "In which directory is your code located?" → **.**

5. **Your addon URL** will be something like:
   ```
   https://movieleaks-stremio.vercel.app
   ```

6. **Set up production domain** (optional):
   ```bash
   vercel --prod
   ```

### Configure Environment Variables (if needed)

If you want to add environment variables in Vercel:
```bash
vercel env add PORT
# or through Vercel dashboard: Settings → Environment Variables
```

---

## 📢 Step 2: Publish to Stremio Community Addons

After your addon is deployed and accessible, you have **two ways** to publish:

### Option A: Using the SDK (in your code)

Add this to your `index.js` after `serveHTTP`:

```javascript
const { publishToCentral } = require('stremio-addon-sdk');

// After deployment, uncomment and run once:
// publishToCentral('https://your-deployment-url.vercel.app/manifest.json')
//   .then(() => console.log('✅ Published to Stremio Central!'))
//   .catch(err => console.error('❌ Publishing failed:', err));
```

### Option B: New Community Addon Portal

**⚠️ Important:** The old addon submission site is deprecated.

1. Visit the **new site**: **https://beta.stremio-addons.net**

2. Submit your addon manifest URL:
   ```
   https://your-deployment-url.vercel.app/manifest.json
   ```

3. **Note**: Not all community addons appear in Stremio's internal catalog immediately

4. Users can still install your addon directly by pasting your manifest URL in Stremio!

---

## ✅ Step 3: Test Your Addon

Before publishing, test it in Stremio:

1. Open **Stremio**
2. Go to **Addons** (puzzle icon)
3. Paste your manifest URL:
   ```
   https://your-deployment-url.vercel.app/manifest.json
   ```
4. Click **Install**

---

## 🔧 Troubleshooting

### HTTPS Required
- Stremio requires HTTPS for remote addons
- Vercel provides HTTPS automatically
- Local testing uses `http://localhost:7000` which is allowed

### CORS Already Handled
- The Stremio SDK handles CORS automatically
- No additional configuration needed

### Manifest Size Limit
- Keep your manifest under 8KB
- Your current manifest is well within limits

---

## 📝 Important Notes

1. **Update Your README** - Add your deployment URL to the installation section
2. **Monitor Issues** - Users will report bugs at: https://github.com/Zerr0-C00L/MovieLeaks-Issues
3. **Update Version** - When making changes, update the version in your manifest

---

## 🎉 Alternative: Quick Deploy Button

Add this to your README for one-click deploys:

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Zerr0-C00L/Movie-Leaks)
```

---

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Stremio Discord**: https://discord.gg/zNRf6YF
- **Report Issues**: https://github.com/Zerr0-C00L/MovieLeaks-Issues
