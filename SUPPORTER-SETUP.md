# Supporter Tier Setup Guide

This guide will walk you through setting up the automated supporter tier system with Ko-fi memberships and webhook integration.

## 📋 Overview

**System Architecture:**
- Free Tier: 100 movies with basic posters
- Supporter Tier: All 477+ movies + RPDB poster overlays
- Ko-fi handles payments ($5/month membership)
- Webhook auto-generates codes
- Codes stored in `supporters.json`
- Addon validates codes on each request

---

## Step 1: Set Up Ko-fi Membership

### 1.1 Enable Memberships on Ko-fi

1. Go to your Ko-fi dashboard: https://ko-fi.com/manage/memberships
2. Click **"Enable Memberships"**
3. Create a membership tier:
   - **Name**: "Movie Leaks Supporter"
   - **Price**: $5/month
   - **Description**: 
     ```
     Unlock full access to Movie Leaks Catalog addon:
     ✨ All 477+ movies (vs 100 free)
     🎨 RPDB poster overlays with Rotten Tomatoes scores
     ⚡ Priority updates and support
     🚀 Future premium features
     
     After subscribing, you'll receive your unique supporter code.
     Enter it in the addon settings to unlock full access!
     ```

### 1.2 Get Your Ko-fi Verification Token

1. Go to: https://ko-fi.com/manage/webhooks
2. Scroll down to **"Advanced"**
3. Copy your **Verification Token**
4. Save it - you'll need it in Step 3

---

## Step 2: Set Up RPDB Account

### 2.1 Get RPDB API Key

1. Go to: https://ratingposterdb.com/
2. Create a free account
3. Go to **Profile → API Key**
4. Copy your API key
5. Save it - you'll need it in Step 3

**Note:** RPDB provides enhanced movie posters with Rotten Tomatoes scores overlaid on them.

---

## Step 3: Configure Environment Variables

### 3.1 Create .env file

In your project root, create a `.env` file (if not exists):

```bash
# Server configuration
PORT=7000

# RPDB API Key for supporters
RPDB_API_KEY=your_actual_rpdb_api_key_here

# Ko-fi webhook verification token
KOFI_VERIFICATION_TOKEN=your_actual_verification_token_here
```

### 3.2 Add to Vercel Environment Variables

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project: **movie-leaks**
3. Go to **Settings → Environment Variables**
4. Add these variables:
   - **Key**: `RPDB_API_KEY`  
     **Value**: Your RPDB API key  
     **Environments**: Production, Preview, Development
   
   - **Key**: `KOFI_VERIFICATION_TOKEN`  
     **Value**: Your Ko-fi verification token  
     **Environments**: Production, Preview, Development

5. Click **"Save"** for each

---

## Step 4: Deploy to Vercel

### 4.1 Push Code to GitHub

```bash
git add .
git commit -m "v1.4.0: Add supporter tier with Ko-fi integration"
git push origin main
```

### 4.2 Deploy to Production

```bash
vercel --prod
```

Wait for deployment to complete. Note your production URL, e.g.:
`https://movie-leaks-xxx.vercel.app`

---

## Step 5: Set Up Ko-fi Webhook

### 5.1 Configure Webhook URL

1. Go to: https://ko-fi.com/manage/webhooks
2. Click **"Add Webhook"**
3. Enter your webhook URL:
   ```
   https://your-vercel-url.vercel.app/api/webhook
   ```
   Replace `your-vercel-url` with your actual Vercel URL

4. **Advanced Settings:**
   - Enable **"Subscriptions"**
   - Enable **"Donations"** (optional, for one-time codes)

5. Click **"Save"**

### 5.2 Test the Webhook

Ko-fi provides a "Test Webhook" button:

1. Click **"Test Webhook"** on the Ko-fi webhooks page
2. Check your Vercel logs to see if it received the request:
   ```bash
   vercel logs
   ```

You should see: `Ko-fi webhook received: ...`

---

## Step 6: Customize Ko-fi Thank You Message

### 6.1 Add Supporter Code to Confirmation

1. Go to: https://ko-fi.com/manage/memberships
2. Click on your membership tier
3. Scroll to **"Thank You Message"**
4. Add this message:
   ```
   🎉 Welcome to Movie Leaks Supporter Tier!
   
   Your supporter code is: {data.code}
   
   HOW TO ACTIVATE:
   1. Open Stremio
   2. Go to Addons → Movie Leaks Catalog
   3. Click the ⚙️ settings icon
   4. Enter your code in "Supporter Code" field
   5. Reinstall the addon
   
   You now have access to:
   ✨ All 477+ movies (unlimited)
   🎨 RPDB poster overlays
   ⚡ Priority updates
   
   Need help? Contact me on Ko-fi or open an issue:
   https://github.com/Zerr0-C00L/MovieLeaks-Issues/issues
   
   Thank you for your support! ☕
   ```

**Note:** `{data.code}` is automatically replaced with the generated supporter code from the webhook.

---

## Step 7: Test the Complete Flow

### 7.1 Make a Test Subscription

1. Visit your Ko-fi membership page: `https://ko-fi.com/zeroq/membership`
2. Subscribe to your own tier (Ko-fi allows this for testing)
3. Check if you receive the email with your supporter code

### 7.2 Validate the Code in Addon

1. Open Stremio
2. Uninstall Movie Leaks addon (if already installed)
3. Reinstall from your Vercel URL:
   ```
   https://your-vercel-url.vercel.app/manifest.json
   ```
4. Click ⚙️ settings icon
5. Enter your supporter code
6. Click "Install"

### 7.3 Verify Features

- **Catalog Size**: You should see all 477+ movies (not just 100)
- **RPDB Posters**: Posters should have Rotten Tomatoes score overlays
- **Console Logs**: Check Vercel logs to confirm:
  ```
  Supporter: YES
  Applying RPDB posters for supporter
  ```

---

## Step 8: Monitor and Maintain

### 8.1 Check Supporter Codes

View active supporter codes in `supporters.json`:

```bash
cat supporters.json
```

**Do NOT commit this file to Git** - it's already in `.gitignore`

### 8.2 Manual Code Generation (if needed)

If webhook fails or you need to manually generate a code:

```bash
# SSH into your server or run locally
node -e "
import('file:///path/to/supporters.js').then(({ addCode }) => {
  addCode('user@example.com', { from_name: 'Manual', message_id: 'manual' })
    .then(supporter => console.log('Code:', supporter.code));
});
"
```

### 8.3 Monitor Webhook Activity

Check Vercel logs regularly:

```bash
vercel logs --follow
```

Look for:
- ✅ `Generated code for user@example.com`
- ✅ `Subscription renewed for user@example.com`
- ❌ `Invalid verification token` (if Ko-fi token is wrong)

---

## Troubleshooting

### Webhook Not Receiving Data

1. Check Vercel logs: `vercel logs`
2. Verify webhook URL in Ko-fi settings
3. Test webhook from Ko-fi dashboard
4. Ensure environment variables are set in Vercel

### Code Not Validating

1. Check `supporters.json` exists and is readable
2. Verify code format (32-character hex)
3. Check expiry date hasn't passed
4. Ensure file permissions allow reading

### RPDB Posters Not Showing

1. Verify `RPDB_API_KEY` is set in Vercel environment
2. Check RPDB API key is valid at https://ratingposterdb.com/
3. Look for errors in Vercel logs
4. Some movies may not have RPDB posters (fallback to regular)

### Ko-fi Verification Token Invalid

1. Re-copy token from Ko-fi webhooks page
2. Update `KOFI_VERIFICATION_TOKEN` in Vercel
3. Redeploy: `vercel --prod`

---

## Security Best Practices

1. **Never commit secrets**: `.env` and `supporters.json` are in `.gitignore`
2. **Use verification token**: Always set `KOFI_VERIFICATION_TOKEN`
3. **Monitor logs**: Check for suspicious webhook activity
4. **Rotate keys**: Change RPDB key and Ko-fi token periodically
5. **Backup codes**: Keep a backup of `supporters.json`

---

## Scaling Considerations

### If you get many supporters (100+):

1. **Upgrade to database**: Replace `supporters.json` with:
   - Vercel Postgres (free tier: 256MB)
   - Vercel KV (Redis) (free tier: 256MB)
   
2. **Add caching**: Cache code validation results for 1 hour

3. **Rate limiting**: Add rate limits to webhook endpoint

4. **Email automation**: Use SendGrid to send codes automatically

---

## Success Checklist

- [ ] Ko-fi membership tier created ($5/month)
- [ ] Ko-fi webhook configured with Vercel URL
- [ ] RPDB account created and API key obtained
- [ ] Environment variables set in Vercel
- [ ] Code deployed to production
- [ ] Test subscription completed successfully
- [ ] Supporter code validated in addon
- [ ] All 477+ movies visible to supporters
- [ ] RPDB posters showing for supporters
- [ ] Ko-fi thank you message includes code
- [ ] Webhook logs showing successful transactions

---

## Need Help?

- **Ko-fi Support**: https://help.ko-fi.com/
- **Vercel Docs**: https://vercel.com/docs
- **RPDB Docs**: https://ratingposterdb.com/api-docs
- **Report Issues**: https://github.com/Zerr0-C00L/MovieLeaks-Issues/issues

---

**🎉 Congratulations!** Your automated supporter tier system is now live!

Users can subscribe on Ko-fi, receive codes automatically, and unlock the full catalog with RPDB posters. The system runs completely hands-free once configured.
