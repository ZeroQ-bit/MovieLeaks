# Automated Email Delivery Setup

## Why You Need This
Ko-fi's webhook doesn't automatically send your generated codes to subscribers. You need to set up email automation.

## Option 1: Using Gmail (Free, Easiest)

### Step 1: Enable Gmail App Password
1. Go to https://myaccount.google.com/apppasswords
2. Create a new App Password named "Movie Leaks Addon"
3. Copy the 16-character password

### Step 2: Install Email Package
```bash
npm install nodemailer
```

### Step 3: Add to Environment Variables
In Vercel and `.env`:
```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

### Step 4: Update Webhook
The webhook code is already prepared. Just uncomment the email section in `api/webhook.js`

## Option 2: Using SendGrid (More Professional)

### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com (Free tier: 100 emails/day)
2. Create an API key

### Step 2: Install SendGrid
```bash
npm install @sendgrid/mail
```

### Step 3: Add API Key
```bash
SENDGRID_API_KEY=your-api-key-here
```

## Option 3: Use Ko-fi Custom Thank You Page

### Create a Thank You Page That Fetches the Code

1. Create `public/thank-you.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Thank You - Movie Leaks Supporter</title>
    <style>
        body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
        .code { background: #f0f0f0; padding: 15px; font-size: 24px; 
                font-family: monospace; margin: 20px 0; text-align: center; 
                border: 2px solid #333; }
        .success { color: green; }
    </style>
</head>
<body>
    <h1>🎉 Thank You for Supporting Movie Leaks!</h1>
    <div id="loading">⏳ Generating your supporter code...</div>
    <div id="content" style="display:none;">
        <p class="success">✅ Your supporter code has been generated!</p>
        <div class="code" id="code"></div>
        <h2>How to Install:</h2>
        <ol>
            <li>Open Stremio on your device</li>
            <li>Click the puzzle piece icon (Add-ons)</li>
            <li>Paste this URL and click Install</li>
            <li>In the addon settings, paste your code above</li>
            <li>Enjoy 477+ leaked movies! 🍿</li>
        </ol>
        <p><strong>Important:</strong> Save your code! It expires in 30 days and auto-renews with your subscription.</p>
        <p>Need help? Email: <a href="mailto:your-email@gmail.com">your-email@gmail.com</a></p>
    </div>
    <script>
        // Get email from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');
        
        if (!email) {
            document.getElementById('loading').innerHTML = 
                '❌ Error: No email provided. Please contact support.';
        } else {
            // Fetch the code from your API
            fetch(`/api/get-code?email=${encodeURIComponent(email)}`)
                .then(r => r.json())
                .then(data => {
                    if (data.code) {
                        document.getElementById('code').textContent = data.code;
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('content').style.display = 'block';
                    } else {
                        throw new Error(data.error || 'Code not found');
                    }
                })
                .catch(err => {
                    document.getElementById('loading').innerHTML = 
                        '❌ Error loading code. Please check your email or contact support.';
                });
        }
    </script>
</body>
</html>
```

2. Create `api/get-code.js`:
```javascript
import { readFile } from 'fs/promises';

export default async function handler(req, res) {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  try {
    const data = JSON.parse(await readFile('./supporters.json', 'utf8'));
    const supporter = data.codes.find(c => c.email === email && c.status === 'active');
    
    if (supporter) {
      return res.json({ 
        code: supporter.code,
        expires_at: supporter.expires_at 
      });
    }
    
    return res.status(404).json({ error: 'Code not found' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
```

3. In Ko-fi Settings:
   - Go to **Payments** → **Thank You Page**
   - Enable "Custom Thank You Page"
   - Set URL: `https://your-addon.vercel.app/thank-you.html?email={email}`

## Testing Email Delivery

Test the email system:
```bash
node -e "
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

await transporter.sendMail({
  from: 'your-email@gmail.com',
  to: 'your-email@gmail.com',
  subject: '🎬 Test: Your Movie Leaks Supporter Code',
  html: '<h2>Your code: TEST123</h2><p>This is a test email.</p>'
});

console.log('✅ Test email sent!');
"
```

## Which Option Should You Choose?

- **Manual (Option 0)**: Start here, easiest, but requires you to manually send codes
- **Gmail (Option 1)**: Best for small scale, free, quick setup
- **SendGrid (Option 2)**: More professional, better deliverability, free tier sufficient
- **Thank You Page (Option 3)**: Best user experience, instant code delivery

## Current Setup Status
✅ Webhook generates codes automatically  
❌ Email delivery not yet configured  

**Recommendation**: Start with manual delivery, then add Gmail automation once you have a few subscribers.
