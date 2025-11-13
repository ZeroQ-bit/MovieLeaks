# Ko-fi Email Template Setup

## How Ko-fi Sends Supporter Codes

When someone subscribes via Ko-fi, the webhook automatically generates a code and returns it. However, **Ko-fi doesn't currently support custom email templates with webhook data**.

## Workaround Options:

### Option 1: Manual Email (Recommended for Now)
1. When you receive a Ko-fi subscription, you'll see the webhook log in Vercel
2. The webhook generates and logs the code
3. **You manually send the code to the supporter via Ko-fi's messaging system or direct email**

To check webhook logs in Vercel:
```bash
# View recent function logs
vercel logs --follow
```

### Option 2: Set Up Your Own Email System
Add email sending to the webhook:

```javascript
// In api/webhook.js, after code generation:
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',  // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

await transporter.sendMail({
  from: 'your-email@gmail.com',
  to: kofiData.email,
  subject: '🎬 Your Movie Leaks Supporter Code',
  html: `
    <h2>Thank you for supporting Movie Leaks!</h2>
    <p>Hi ${kofiData.from_name},</p>
    <p>Your supporter code is: <strong>${supporter.code}</strong></p>
    <p>To install the addon:</p>
    <ol>
      <li>Open Stremio</li>
      <li>Go to: <a href="https://movie-leaks.vercel.app/manifest.json">Install Movie Leaks</a></li>
      <li>In the addon settings, paste your code: <code>${supporter.code}</code></li>
      <li>Enjoy 477+ leaked movies! 🍿</li>
    </ol>
    <p>Your code expires in 30 days and will auto-renew with your Ko-fi subscription.</p>
  `
});
```

### Option 3: Ko-fi Custom Thank You Page
1. Go to Ko-fi Settings → Payments → Thank You Page
2. Enable "Custom Thank You Page"
3. Set URL to: `https://your-domain.com/thank-you?email={email}`
4. Create a `/public/thank-you.html` page that:
   - Receives the email parameter
   - Calls your API to get the code
   - Displays it to the user

## Current Setup (Manual)

For now, when someone subscribes:

1. **You'll receive a Ko-fi notification email**
2. **Check Vercel logs to get their code:**
   ```bash
   vercel logs
   ```
   Look for: `✅ Generated code for email@example.com : ABC123XYZ`

3. **Send them the code manually:**
   - Via Ko-fi messaging
   - Or via direct email

## Ko-fi Message Template

```
🎬 Thank You for Supporting Movie Leaks! 🎬

Your Supporter Code: 0F4830A11F84161418DB0BE4CAC2B26F

How to Install:
1. Open Stremio
2. Click the puzzle piece icon (Add-ons)
3. Enter this URL: https://movie-leaks-c6dsjh1zm-zeroq26.vercel.app/manifest.json
4. In the settings, paste your code above
5. Enjoy 477+ movies! 🍿

Your code expires in 30 days and auto-renews with your subscription.

Questions? Message me anytime!
```

## Checking Recent Subscriptions

To see all generated codes:
```bash
cd /Users/zeroq/Stremio-Addons/MovieLeaks
cat supporters.json | jq '.codes[] | {email, code, status, expires_at}'
```

To check if a specific email has a code:
```bash
cat supporters.json | jq '.codes[] | select(.email == "user@example.com")'
```
