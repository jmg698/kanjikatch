# KanjiKatch - Japanese Learning App

A mobile-friendly web app for Japanese learners. Photograph handwritten notes or printed learning material, AI extracts kanji/vocabulary/sentences, stores in personal knowledge base, and generates review exercises.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Neon PostgreSQL + Drizzle ORM
- **Authentication**: Clerk
- **File Uploads**: Uploadthing
- **AI**: Claude API (Anthropic)
- **Styling**: Tailwind CSS + shadcn/ui

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `UPLOADTHING_TOKEN` - Uploadthing API token
- `ANTHROPIC_API_KEY` - Claude API key

Optional (for Clerk webhooks):
- `CLERK_WEBHOOK_SECRET` - For syncing users to database

### 3. Set Up Database

Push the schema to your Neon database:

```bash
npm run db:push
```

Or generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth routes (sign-in, sign-up)
│   ├── (dashboard)/      # Protected dashboard routes
│   │   ├── dashboard/    # Main dashboard
│   │   ├── capture/      # Image upload & extraction
│   │   ├── library/      # Browse kanji, vocab, grammar, sentences
│   │   ├── guides/       # Study guide list & viewer
│   │   └── review/       # Spaced repetition review
│   ├── api/
│   │   ├── extract/      # AI extraction endpoint
│   │   ├── guides/       # Study guide generation & CRUD
│   │   ├── uploadthing/  # File upload handler
│   │   └── webhooks/     # Clerk webhooks
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx          # Landing page
├── components/
│   └── ui/               # shadcn/ui components
├── db/
│   ├── schema/           # Drizzle schema definitions
│   └── index.ts          # Database client
├── hooks/
│   └── use-toast.ts      # Toast notifications hook
├── lib/
│   ├── ai.ts             # Claude AI integration
│   ├── auth.ts           # Auth helpers
│   ├── uploadthing.ts    # Uploadthing client
│   ├── utils.ts          # Utility functions
│   └── validations.ts    # Zod schemas
└── middleware.ts         # Clerk auth middleware
```

## Database Schema

- **users** - User accounts (synced from Clerk)
- **sourceImages** - Uploaded images / pasted text captures
- **kanji** - Individual kanji characters
- **vocabulary** - Words and compounds
- **grammarPatterns** - Grammar points extracted from captures (structure, nuance, examples)
- **sentences** - Complete sentences
- **studyGuides** - Generated study guides (markdown) built from captures
- **reviewTracks** - Spaced repetition tracking (per question type)

## Features

- 📷 **Capture**: Upload photos of handwritten notes or textbooks
- 🤖 **AI Extraction**: Claude automatically extracts kanji, vocabulary, sentences, and grammar patterns
- 📚 **Library**: Browse your personal collection of kanji, vocabulary, grammar, and sentences
- 🧠 **Review**: Spaced repetition system for effective memorization
- 📖 **Study Guides**: Turn any capture (or several) into a full lesson handout — vocabulary tables, grammar explanations with examples, kanji by JLPT level, and practice exercises with an answer key

## Development

### Adding shadcn/ui Components

```bash
npx shadcn@latest add [component-name]
```

### Database Studio

View and edit your database:

```bash
npm run db:studio
```

## Deployment

This app is designed for deployment on Vercel. Make sure to:

1. Set all environment variables in Vercel dashboard
2. Set up Clerk webhook endpoint: `https://your-domain.com/api/webhooks/clerk`
