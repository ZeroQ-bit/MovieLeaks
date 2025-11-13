# GitHub Actions Auto-Add Supporter Codes

## How It Works

When someone subscribes on Ko-fi:
1. Ko-fi webhook sends payment data to `/api/webhook`
2. Webhook generates a unique code
3. Webhook sends email to subscriber
4. Webhook triggers GitHub Actions via repository dispatch
5. GitHub Actions automatically adds code to `supporters.json`
6. Code is committed and pushed to the repo
7. Vercel auto-deploys with updated supporters list

## Setup Instructions

### Step 1: Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `Movie-Leaks Webhook`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token** (starts with `ghp_...`)

### Step 2: Add Token to Vercel

```bash
# Add to all environments
echo "YOUR_GITHUB_TOKEN_HERE" | vercel env add GITHUB_TOKEN production
echo "YOUR_GITHUB_TOKEN_HERE" | vercel env add GITHUB_TOKEN preview
echo "YOUR_GITHUB_TOKEN_HERE" | vercel env add GITHUB_TOKEN development
```

Or via Vercel Dashboard:
1. Go to: https://vercel.com/zeroq26/movie-leaks/settings/environment-variables
2. Add new variable:
   - **Name**: `GITHUB_TOKEN`
   - **Value**: Your token (ghp_...)
   - **Environments**: Production, Preview, Development
3. Click **Save**

### Step 3: Deploy Updated Code

```bash
git add -A
git commit -m "Add GitHub Actions for auto-adding supporter codes"
git push origin main
vercel --prod --yes
```

### Step 4: Test the Workflow

Test with curl:
```bash
curl -X POST https://movie-leaks.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "verification_token": "bbb4df16-3e28-445b-9178-720b23e155a7",
    "type": "Subscription",
    "from_name": "Test User",
    "email": "test@example.com",
    "amount": "5.00",
    "message_id": "test-123"
  }'
```

Check:
1. Email sent to subscriber
2. GitHub Actions ran: https://github.com/Zerr0-C00L/Movie-Leaks/actions
3. Code added to `supporters.json`
4. Commit appeared in repo

## Monitoring

### Check GitHub Actions
https://github.com/Zerr0-C00L/Movie-Leaks/actions

### Check Vercel Logs
```bash
vercel logs --follow
```

### View Recent Supporters
```bash
./check-supporters.sh
# or
cat supporters.json | jq '.codes[-5:]'  # Last 5 codes
```

## Troubleshooting

### GitHub Actions Not Triggering
- Check Vercel logs for "GitHub Actions triggered successfully"
- Verify GITHUB_TOKEN is set in Vercel
- Check token has `repo` scope

### Code Not Added to supporters.json
- Check GitHub Actions logs
- Verify workflow file syntax
- Ensure bot has write permissions

### Email Not Sent
- Check EMAIL_USER and EMAIL_PASSWORD in Vercel
- Verify Gmail app password is correct
- Check Vercel logs for email errors

## Manual Fallback

If automation fails, generate code manually:

```bash
node generate-code-for-subscriber.js
```

Then copy the message and send via Ko-fi messaging.

## Flow Diagram

```
Ko-fi Payment
    ↓
Ko-fi Webhook → https://movie-leaks.vercel.app/api/webhook
    ↓
Generate Code
    ↓
├── Send Email (Gmail) → Subscriber gets code instantly
    ↓
└── Trigger GitHub Actions → https://api.github.com/repos/.../dispatches
        ↓
    GitHub Actions Workflow
        ↓
    ├── Checkout repo
    ├── Add code to supporters.json
    └── Commit & Push
            ↓
        Vercel Auto-Deploy
            ↓
        Code is now active!
```

## Security Notes

- ✅ Ko-fi verification token validates webhook source
- ✅ GitHub token only has repo access (not org-wide)
- ✅ Supporters.json is gitignored (but tracked in private repo)
- ✅ Email credentials stored securely in Vercel
- ✅ All communication over HTTPS

## Cost

- GitHub Actions: Free (2,000 minutes/month)
- Vercel Functions: Free tier sufficient
- Gmail: Free
- Ko-fi: Takes 5% + payment processing

## Benefits

✅ **Fully automated** - No manual work needed
✅ **Instant delivery** - Email sent immediately
✅ **Auto-sync** - supporters.json always up to date
✅ **Audit trail** - Git commits show all additions
✅ **Reliable** - If one part fails, others still work
