# Environment Variables Setup Guide

## Required Credentials

You need to set up 4 services to run KanjiKatch. Follow these steps to get all your credentials.

---

## 1. Neon PostgreSQL Database

### Get your connection string:

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Sign up or log in
3. Create a new project (or use existing)
4. Click "Connection Details" or "Connect"
5. Copy the connection string that looks like:
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

### Add to `.env`:
```env
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

---

## 2. Clerk Authentication

### Get your keys:

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Sign up or log in
3. Create a new application (or use existing)
4. Go to "API Keys" in the sidebar
5. Copy both keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

### Add to `.env`:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
CLERK_SECRET_KEY=your_clerk_secret_key_here
```

### Configure Clerk URLs:

1. In Clerk Dashboard, go to "Paths"
2. Set these paths:
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in: `/dashboard`
   - After sign-up: `/dashboard`

(These are already set in your `.env` file)

---

## 3. Uploadthing (Image Uploads)

### Get your token:

1. Go to [https://uploadthing.com](https://uploadthing.com)
2. Sign up or log in (can use GitHub)
3. Create a new app or use existing
4. Go to "API Keys" or "Settings"
5. Copy your token (starts with `sk_live_` or similar)

### Add to `.env`:
```env
UPLOADTHING_TOKEN=your_uploadthing_token_here
```

---

## 4. Anthropic Claude API (AI Extraction)

### Get your API key:

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to "API Keys"
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### Add to `.env`:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**Note:** Claude API usage is paid, but you get some free credits to start. Monitor your usage at the console.

---

## 5. Optional: Clerk Webhook (User Sync)

This is optional but recommended for production. It syncs user data from Clerk to your database.

### Set up webhook:

1. In Clerk Dashboard, go to "Webhooks"
2. Click "Add Endpoint"
3. Enter your webhook URL:
   - Development: Use ngrok or similar: `https://your-ngrok-url.ngrok.io/api/webhooks/clerk`
   - Production: `https://your-domain.com/api/webhooks/clerk`
4. Subscribe to these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the "Signing Secret" (starts with `whsec_`)

### Add to `.env`:
```env
CLERK_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## Verification Checklist

After setting up all credentials, your `.env` file should have:

- [ ] `DATABASE_URL` - Neon PostgreSQL connection string
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Starts with `pk_test_`
- [ ] `CLERK_SECRET_KEY` - Starts with `sk_test_`
- [ ] `UPLOADTHING_TOKEN` - Uploadthing API token
- [ ] `ANTHROPIC_API_KEY` - Starts with `sk-ant-`
- [ ] `CLERK_WEBHOOK_SECRET` (optional) - Starts with `whsec_`

---

## Test Your Setup

1. **Push database schema:**
   ```bash
   npm run db:push
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Visit:** [http://localhost:3000](http://localhost:3000)

4. **Test signup:**
   - Click "Get Started"
   - Create an account with Clerk
   - You should be redirected to `/dashboard`

5. **Test image upload:**
   - Go to "Capture" page
   - Upload a test image with Japanese text
   - Check if extraction works

---

## Cost Estimates

### Free Tiers:
- **Neon**: Free tier with 0.5 GB storage, 1 project
- **Clerk**: Free up to 10,000 monthly active users
- **Uploadthing**: Free tier with 2GB storage, 100 uploads/month

### Paid:
- **Anthropic Claude**: Pay-as-you-go
  - Claude Sonnet 4: ~$3 per million input tokens, ~$15 per million output tokens
  - Typical image extraction: ~$0.01-0.05 per image

---

## Troubleshooting

### "Invalid connection string"
- Make sure you copied the entire DATABASE_URL
- Check there are no extra spaces
- Ensure it includes `?sslmode=require` at the end

### "Clerk: Invalid publishable key"
- Make sure you're using the key from the correct environment (test vs production)
- Check the key starts with `pk_test_` or `pk_live_`
- No extra quotes around the value

### "Uploadthing: Unauthorized"
- Verify you copied the full token
- Make sure you're using the secret token, not public key

### "Anthropic: Authentication failed"
- Confirm your API key is active
- Check you have credits/billing enabled
- Key should start with `sk-ant-`

---

## Security Notes

⚠️ **Never commit your `.env` file to git!**

The `.env` file is already in `.gitignore`, but double-check:
```bash
git status
```

Your `.env` file should NOT appear in the list.
