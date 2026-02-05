# Schema Update Summary

## Overview
Updated the database schema to implement frequency tracking with array fields and embedded SRS (Spaced Repetition System) data.

## Key Changes

### 1. Table Rename: `uploads` → `sourceImages`
- Renamed for clarity
- Added `extractionRaw` (jsonb) - stores raw AI response for debugging
- Added `errorMessage` (text) - tracks extraction errors
- Renamed `createdAt` → `uploadedAt`
- Removed `fileName` field

### 2. Kanji Table - Complete Rebuild
**Architecture Change:**
- Moved from single foreign key to array-based tracking
- Embedded SRS fields directly in the table
- Implements frequency tracking with `timesSeen` counter

**New Structure:**
- `readingsOn` - text[] (was single `onyomi` text)
- `readingsKun` - text[] (was single `kunyomi` text)
- `meanings` - text[] (was single `meaning` text)
- `sourceImageIds` - uuid[] (replaces single `uploadId` FK)
- `firstSeenAt`, `lastSeenAt` - timestamp tracking
- `timesSeen` - integer counter (increments on duplicate)
- `notes` - optional notes field
- **SRS Fields:**
  - `nextReviewAt` - timestamp
  - `intervalDays` - integer (default 1)
  - `easeFactor` - numeric(3,2) (default 2.50)
  - `reviewCount` - integer (default 0)

**Constraints:**
- UNIQUE index on `(userId, character)` - prevents true duplicates
- Regular index on `userId` for query performance

### 3. Vocabulary Table - Complete Rebuild
**Same pattern as kanji:**
- `meanings` - text[] (was single `meaning` text)
- `sourceImageIds` - uuid[] (replaces single `uploadId` FK)
- `firstSeenAt`, `lastSeenAt`, `timesSeen` - frequency tracking
- `notes`, `nextReviewAt`, `intervalDays`, `easeFactor`, `reviewCount` - SRS fields
- Removed `exampleSentence` and `exampleTranslation` fields

**Constraints:**
- UNIQUE index on `(userId, word, reading)` - prevents duplicates
- Regular index on `userId`

### 4. Sentences Table - Simplified
**Changes:**
- Removed `reading` field (hiragana reading)
- Removed `notes` field
- Renamed `translation` → `english`
- Added `source` field (required) - tracks origin: 'extracted', 'generated', or 'manual'
- Renamed `uploadId` → `sourceImageId` (still single FK, not array)

**Constraints:**
- Regular index on `userId`

### 5. Deleted `reviewItems` Table
- No longer needed - SRS data is embedded in kanji/vocabulary tables

## Frequency Tracking Implementation

The extract API now uses **upsert logic** with the UNIQUE constraints:

```typescript
// On duplicate (userId, character) - increment counter
.onConflictDoUpdate({
  target: [kanji.userId, kanji.character],
  set: {
    lastSeenAt: new Date(),
    timesSeen: sql`${kanji.timesSeen} + 1`,
    sourceImageIds: sql`array_append(${kanji.sourceImageIds}, ${sourceImage.id}::uuid)`,
  },
})
```

**Behavior:**
- First encounter: Creates new entry with `timesSeen = 1`
- Duplicate: Increments `timesSeen`, appends to `sourceImageIds` array
- Allows tracking: "How many times have I seen this kanji?"

## Files Updated

### Schema Files
- `src/db/schema/index.ts` - Complete rebuild of all tables
- `src/db/index.ts` - No changes needed (exports work the same)

### API Routes
- `src/app/api/extract/route.ts` - Complete rewrite
  - Uses `sourceImages` table
  - Implements upsert logic for frequency tracking
  - Stores `extractionRaw` for debugging
  - Handles errors with `errorMessage` field

### Validation
- `src/lib/validations.ts` - Updated schemas
  - Changed to array types for meanings/readings
  - Removed fields that no longer exist
  - Simplified sentence schema

### AI Integration
- `src/lib/ai.ts` - Updated prompt
  - Returns arrays for meanings and readings
  - Removed unnecessary fields
  - Added example JSON format

### UI Pages
- `src/app/(dashboard)/library/page.tsx` - Updated displays
  - Shows array values with `.join(", ")`
  - Displays `timesSeen` counter
  - Uses `lastSeenAt` for sorting

## Migration Notes

**To apply this schema:**

1. Drop existing database (if you have test data):
   ```bash
   # In your Neon SQL editor or via drizzle-kit
   DROP TABLE IF EXISTS review_items CASCADE;
   DROP TABLE IF EXISTS sentences CASCADE;
   DROP TABLE IF EXISTS vocabulary CASCADE;
   DROP TABLE IF EXISTS kanji CASCADE;
   DROP TABLE IF EXISTS uploads CASCADE;
   ```

2. Push new schema:
   ```bash
   npm run db:push
   ```

3. Or generate migration:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

## TypeScript Compilation

✅ All files compile successfully with no errors
✅ Type safety maintained throughout
✅ Proper array type handling in Drizzle ORM

## Testing Checklist

- [ ] Upload an image with kanji
- [ ] Upload the same image again (test frequency tracking)
- [ ] Verify `timesSeen` increments
- [ ] Verify `sourceImageIds` array contains both IDs
- [ ] Check vocabulary deduplication
- [ ] Verify sentences are created (not deduplicated)
- [ ] Check library page displays correctly
- [ ] Test error handling (invalid image)
- [ ] Verify `extractionRaw` is stored
