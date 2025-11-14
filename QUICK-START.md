# 🎬 Movie Leaks Addon - Quick Reference

## 📌 Current Status

✅ Issue tracker set up: https://github.com/Zerr0-C00L/MovieLeaks-Issues
✅ Addon code ready for deployment
✅ Vercel configuration complete
⏳ **Next Step:** Deploy and publish to Stremio

---

## 🚀 To Deploy Right Now

```bash
# 1. Install Vercel (if not installed)
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy
cd /Users/zeroq/Stremio-Addons/MovieLeaks
vercel

# 4. Deploy to production (after testing)
vercel --prod
```

You'll get a URL like: `https://movieleaks-stremio.vercel.app`

---

## 📢 To Publish to Stremio

### Method 1: Web Portal
1. Go to: **https://beta.stremio-addons.net**
2. Submit your manifest: `https://your-vercel-url.vercel.app/manifest.json`
3. Done! ✨

**Note:** Not all community addons appear in Stremio's internal catalog. Users can always install directly via your manifest URL!

### Method 2: Via Code
Run this once after deployment:

```javascript
const { publishToCentral } = require('stremio-addon-sdk');

publishToCentral('https://your-vercel-url.vercel.app/manifest.json')
  .then(() => console.log('Published!'))
  .catch(err => console.error(err));
```

### Method 3: Direct User Installation (Always Works!)
Share your manifest URL with users:
```
https://your-vercel-url.vercel.app/manifest.json
```

Users paste it in Stremio → Addons → Install from URL

---

## 🧪 To Test Before Publishing

1. Start local server:
   ```bash
   npm start
   ```

2. In Stremio:
   - Open Addons (puzzle icon)
   - Paste: `http://localhost:7000/manifest.json`
   - Click Install

---

## 📁 Important Files

- `index.js` - Main addon server
- `manifest` (in index.js) - Addon configuration
- `vercel.json` - Vercel deployment config
- `DEPLOYMENT.md` - Full deployment guide
- `README.md` - User documentation

---

## 🐛 User Support

- **Issues**: https://github.com/Zerr0-C00L/MovieLeaks-Issues/issues
- **Ko-fi**: https://ko-fi.com/zeroq
- **Stremio Discord**: https://discord.gg/zNRf6YF

---

## 🔄 To Update Your Addon

1. Make changes to your code
2. Update version in `index.js` manifest:
   ```javascript
   version: '1.3.2', // increment this
   ```
3. Deploy again:
   ```bash
   vercel --prod
   ```
4. Changes are live immediately! (no need to republish)

---

## 📊 Your Addon Features

✅ rlsbb.to catalog integration
✅ Cinemeta metadata enrichment
✅ RPDB poster support (optional)
✅ 5-minute caching
✅ Issue tracking system
✅ User configuration support
✅ Mobile-friendly (iOS/Android)

---

## 🎯 What Happens After Publishing

1. Your addon appears in **Community Addons** (within 24h)
2. Users can install it with one click
3. They can report issues at your GitHub Issues page
4. They can support you via Ko-fi
5. Your addon gets updates automatically when you redeploy

---

## 💡 Pro Tips

- **HTTPS is required** for public addons (Vercel provides this)
- **Test locally first** before deploying
- **Monitor your Issues repo** for user feedback
- **Update regularly** based on user requests
- **Keep manifest under 8KB** (you're well within limits)

---

## 📞 Need Help?

Check `DEPLOYMENT.md` for detailed instructions or reach out on Stremio Discord!
