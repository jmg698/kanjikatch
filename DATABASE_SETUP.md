# Database Setup Guide

## Quick Start

### 1. Set up environment variables

Create a `.env` file in the project root:

```env
# Required - Get from https://console.neon.tech
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Uploadthing
UPLOADTHING_TOKEN=...

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Optional - for webhooks
CLERK_WEBHOOK_SECRET=whsec_...
```

### 2. Push the schema to your database

```bash
npm run db:push
```

This will create all tables with the correct structure.

### 3. Verify the schema

You can open Drizzle Studio to view your database:

```bash
npm run db:studio
```

This opens a web interface at http://localhost:4983

## Database Schema Reference

### sourceImages
Stores uploaded photos of Japanese learning materials.

```typescript
{
  id: uuid (PK)
  userId: text (FK → users.id)
  imageUrl: text
  uploadedAt: timestamp
  processed: boolean
  extractionRaw: jsonb  // Full AI response
  errorMessage: text    // Error if extraction failed
}
```

### kanji
Individual kanji with SRS tracking and frequency counting.

```typescript
{
  id: uuid (PK)
  userId: text (FK → users.id)
  character: text                  // Single kanji
  readingsOn: text[]               // [ガク, ガッ]
  readingsKun: text[]              // [まな.ぶ]
  meanings: text[]                 // [study, learning]
  strokeCount: integer
  jlptLevel: integer               // 1-5 (N1-N5)
  firstSeenAt: timestamp
  lastSeenAt: timestamp
  timesSeen: integer               // Increments on duplicate
  sourceImageIds: uuid[]           // Which images contained this
  notes: text
  // SRS fields
  nextReviewAt: timestamp
  intervalDays: integer            // Default 1
  easeFactor: numeric(3,2)         // Default 2.50
  reviewCount: integer             // Default 0
}
UNIQUE(userId, character)
```

### vocabulary  
Words and phrases with SRS tracking.

```typescript
{
  id: uuid (PK)
  userId: text (FK → users.id)
  word: text                       // 学生
  reading: text                    // がくせい
  meanings: text[]                 // [student, pupil]
  partOfSpeech: text               // noun, verb, etc.
  jlptLevel: integer
  firstSeenAt: timestamp
  lastSeenAt: timestamp
  timesSeen: integer
  sourceImageIds: uuid[]
  notes: text
  // SRS fields (same as kanji)
  nextReviewAt: timestamp
  intervalDays: integer
  easeFactor: numeric(3,2)
  reviewCount: integer
}
UNIQUE(userId, word, reading)
```

### sentences
Complete sentences for reading practice.

```typescript
{
  id: uuid (PK)
  userId: text (FK → users.id)
  japanese: text                   // 学生です。
  english: text                    // I am a student.
  source: text                     // 'extracted' | 'generated' | 'manual'
  sourceImageId: uuid (FK → sourceImages.id)
  createdAt: timestamp
}
```

## Frequency Tracking Logic

When the same kanji/vocabulary appears in multiple images:

1. **First time**: New entry created
   - `timesSeen = 1`
   - `sourceImageIds = [imageId]`

2. **Subsequent times**: Existing entry updated
   - `timesSeen` incremented
   - `imageId` appended to `sourceImageIds` array
   - `lastSeenAt` updated

This allows queries like:
- "Show me kanji I've seen 5+ times"
- "Which images contained this kanji?"
- "What did I learn from this specific image?"

## Useful Queries

### Find frequently seen kanji
```typescript
const frequent = await db
  .select()
  .from(kanji)
  .where(
    and(
      eq(kanji.userId, userId),
      gte(kanji.timesSeen, 5)
    )
  );
```

### Items due for review
```typescript
const due = await db
  .select()
  .from(kanji)
  .where(
    and(
      eq(kanji.userId, userId),
      lte(kanji.nextReviewAt, new Date())
    )
  );
```

### All content from a specific image
```typescript
const fromImage = await db
  .select()
  .from(kanji)
  .where(
    sql`${sourceImageId}::uuid = ANY(${kanji.sourceImageIds})`
  );
```

## Next Steps

After setting up the database:

1. Run the dev server: `npm run dev`
2. Sign up for an account
3. Upload a test image with Japanese text
4. Check the library to see extracted content
5. Upload the same image again to test frequency tracking
6. Use Drizzle Studio to inspect the database

## Troubleshooting

**Connection errors:**
- Verify DATABASE_URL is correct
- Check Neon database is running
- Ensure IP is allowed (Neon allows all by default)

**Schema errors:**
- Drop all tables and re-run `db:push`
- Check for SQL syntax errors in console

**Array field errors:**
- Ensure using PostgreSQL (arrays are PG-specific)
- Update drizzle-orm to latest version
