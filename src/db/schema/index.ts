import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, uniqueIndex, index, numeric } from "drizzle-orm/pg-core";

// Users table - synced from Clerk
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Source images/text - uploaded photos or pasted text of learning materials
export const sourceImages = pgTable("source_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url"),
  sourceText: text("source_text"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processed: boolean("processed").default(false).notNull(),
  extractionRaw: jsonb("extraction_raw"),
  errorMessage: text("error_message"),
}, (table) => ({
  userIdIdx: index("source_images_user_id_idx").on(table.userId),
}));

// Kanji entries with SRS tracking
export const kanji = pgTable("kanji", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  character: text("character").notNull(),
  readingsOn: text("readings_on").array().notNull().default([]),
  readingsKun: text("readings_kun").array().notNull().default([]),
  meanings: text("meanings").array().notNull().default([]),
  strokeCount: integer("stroke_count"),
  jlptLevel: integer("jlpt_level"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  timesSeen: integer("times_seen").default(1).notNull(),
  sourceImageIds: uuid("source_image_ids").array().notNull().default([]),
  notes: text("notes"),
  // SRS fields
  nextReviewAt: timestamp("next_review_at"),
  intervalDays: integer("interval_days").default(1).notNull(),
  easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).default("2.50").notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
  timesCorrect: integer("times_correct").default(0).notNull(),
  lastReviewedAt: timestamp("last_reviewed_at"),
  confidenceLevel: text("confidence_level").default("new").notNull(), // 'new' | 'learning' | 'reviewing' | 'known'
}, (table) => ({
  userCharacterIdx: uniqueIndex("kanji_user_character_idx").on(table.userId, table.character),
  userIdIdx: index("kanji_user_id_idx").on(table.userId),
  nextReviewIdx: index("kanji_next_review_idx").on(table.userId, table.nextReviewAt),
}));

// Vocabulary entries with SRS tracking
export const vocabulary = pgTable("vocabulary", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  reading: text("reading").notNull(),
  meanings: text("meanings").array().notNull().default([]),
  partOfSpeech: text("part_of_speech"),
  jlptLevel: integer("jlpt_level"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  timesSeen: integer("times_seen").default(1).notNull(),
  sourceImageIds: uuid("source_image_ids").array().notNull().default([]),
  notes: text("notes"),
  // SRS fields
  nextReviewAt: timestamp("next_review_at"),
  intervalDays: integer("interval_days").default(1).notNull(),
  easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).default("2.50").notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
  timesCorrect: integer("times_correct").default(0).notNull(),
  lastReviewedAt: timestamp("last_reviewed_at"),
  confidenceLevel: text("confidence_level").default("new").notNull(),
}, (table) => ({
  userWordReadingIdx: uniqueIndex("vocabulary_user_word_reading_idx").on(table.userId, table.word, table.reading),
  userIdIdx: index("vocabulary_user_id_idx").on(table.userId),
  nextReviewIdx: index("vocabulary_next_review_idx").on(table.userId, table.nextReviewAt),
}));

// Sentences for reading practice
export const sentences = pgTable("sentences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  japanese: text("japanese").notNull(),
  english: text("english"),
  source: text("source").notNull(), // 'extracted', 'generated', or 'manual'
  sourceImageId: uuid("source_image_id").references(() => sourceImages.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("sentences_user_id_idx").on(table.userId),
}));

// Review sessions - tracks each review sitting
export const reviewSessions = pgTable("review_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  itemsReviewed: integer("items_reviewed").default(0).notNull(),
  itemsCorrect: integer("items_correct").default(0).notNull(),
  sessionType: text("session_type").notNull(), // 'kanji' | 'vocab' | 'mixed'
  xpEarned: integer("xp_earned").default(0).notNull(),
}, (table) => ({
  userIdIdx: index("review_sessions_user_id_idx").on(table.userId),
  startedAtIdx: index("review_sessions_started_at_idx").on(table.userId, table.startedAt),
}));

// Review history - individual item results
export const reviewHistory = pgTable("review_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => reviewSessions.id, { onDelete: "set null" }),
  itemType: text("item_type").notNull(), // 'kanji' | 'vocab'
  itemId: uuid("item_id").notNull(),
  questionType: text("question_type").notNull(), // 'meaning' | 'reading'
  wasCorrect: boolean("was_correct").notNull(),
  quality: integer("quality").notNull(), // SM-2 quality 1-5
  responseTimeMs: integer("response_time_ms"),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("review_history_user_id_idx").on(table.userId),
  sessionIdIdx: index("review_history_session_id_idx").on(table.sessionId),
  itemIdx: index("review_history_item_idx").on(table.itemType, table.itemId),
}));

// User stats - denormalized for fast dashboard rendering
export const userStats = pgTable("user_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastReviewDate: text("last_review_date"), // YYYY-MM-DD format for date comparison
  totalReviews: integer("total_reviews").default(0).notNull(),
  totalCorrect: integer("total_correct").default(0).notNull(),
  kanjiKnown: integer("kanji_known").default(0).notNull(),
  vocabKnown: integer("vocab_known").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  xp: integer("xp").default(0).notNull(),
  dailyGoal: integer("daily_goal").default(10).notNull(),
  dailyReviewsToday: integer("daily_reviews_today").default(0).notNull(),
  dailyReviewsDate: text("daily_reviews_date"), // YYYY-MM-DD, reset when date changes
}, (table) => ({
  userIdIdx: uniqueIndex("user_stats_user_id_idx").on(table.userId),
}));

// Generated sentences from "See It In The Wild" feature
export const generatedSentences = pgTable("generated_sentences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => reviewSessions.id, { onDelete: "set null" }),
  japanese: text("japanese").notNull(),
  english: text("english").notNull(),
  words: jsonb("words").notNull(), // Array of {text, reading?, isTarget, containsTarget?}
  difficultyRating: text("difficulty_rating"), // 'too_easy' | 'just_right' | 'too_hard' | null
  ratedAt: timestamp("rated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("generated_sentences_user_id_idx").on(table.userId),
  sessionIdIdx: index("generated_sentences_session_id_idx").on(table.sessionId),
  japaneseIdx: index("generated_sentences_japanese_idx").on(table.userId, table.japanese),
}));

// Junction: which kanji/vocab each generated sentence targets
export const generatedSentenceTargets = pgTable("generated_sentence_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  sentenceId: uuid("sentence_id").notNull().references(() => generatedSentences.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(), // 'kanji' | 'vocab'
  itemId: uuid("item_id").notNull(),
  itemText: text("item_text").notNull(), // the character or word, for display/filtering
}, (table) => ({
  sentenceIdIdx: index("gen_sentence_targets_sentence_id_idx").on(table.sentenceId),
  itemIdx: index("gen_sentence_targets_item_idx").on(table.itemType, table.itemId),
  itemTextIdx: index("gen_sentence_targets_item_text_idx").on(table.itemText),
}));

// Review tracks — per-question-type SRS state for each kanji/vocab item
// Each item has two tracks: "meaning" and "reading", scheduled independently.
export const reviewTracks = pgTable("review_tracks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull(),
  itemType: text("item_type").notNull(), // 'kanji' | 'vocab'
  questionType: text("question_type").notNull(), // 'meaning' | 'reading'
  nextReviewAt: timestamp("next_review_at"),
  intervalDays: integer("interval_days").default(1).notNull(),
  easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).default("2.50").notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
  timesCorrect: integer("times_correct").default(0).notNull(),
  lastReviewedAt: timestamp("last_reviewed_at"),
  confidenceLevel: text("confidence_level").default("new").notNull(), // 'new' | 'learning' | 'reviewing' | 'known'
}, (table) => ({
  uniqueTrack: uniqueIndex("review_tracks_unique_idx").on(table.itemId, table.itemType, table.questionType),
  userDueIdx: index("review_tracks_user_due_idx").on(table.userId, table.nextReviewAt),
  itemIdx: index("review_tracks_item_idx").on(table.itemId, table.itemType),
  userIdIdx: index("review_tracks_user_id_idx").on(table.userId),
  userItemTypeIdx: index("review_tracks_user_item_type_idx").on(table.userId, table.itemType, table.nextReviewAt),
}));

// Content items - future reading engine (created now, populated later)
export const contentItems = pgTable("content_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'nhk_easy' | 'generated' | 'user_imported'
  title: text("title").notNull(),
  contentText: text("content_text").notNull(),
  contentHtml: text("content_html"),
  difficultyLevel: integer("difficulty_level").notNull(), // 1-5
  url: text("url"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("content_items_user_id_idx").on(table.userId),
  difficultyIdx: index("content_items_difficulty_idx").on(table.difficultyLevel),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type SourceImage = typeof sourceImages.$inferSelect;
export type NewSourceImage = typeof sourceImages.$inferInsert;

export type Kanji = typeof kanji.$inferSelect;
export type NewKanji = typeof kanji.$inferInsert;

export type Vocabulary = typeof vocabulary.$inferSelect;
export type NewVocabulary = typeof vocabulary.$inferInsert;

export type Sentence = typeof sentences.$inferSelect;
export type NewSentence = typeof sentences.$inferInsert;

export type ReviewSession = typeof reviewSessions.$inferSelect;
export type NewReviewSession = typeof reviewSessions.$inferInsert;

export type ReviewHistory = typeof reviewHistory.$inferSelect;
export type NewReviewHistory = typeof reviewHistory.$inferInsert;

export type UserStats = typeof userStats.$inferSelect;
export type NewUserStats = typeof userStats.$inferInsert;

export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;

export type GeneratedSentence = typeof generatedSentences.$inferSelect;
export type NewGeneratedSentence = typeof generatedSentences.$inferInsert;

export type GeneratedSentenceTarget = typeof generatedSentenceTargets.$inferSelect;
export type NewGeneratedSentenceTarget = typeof generatedSentenceTargets.$inferInsert;

export type ReviewTrack = typeof reviewTracks.$inferSelect;
export type NewReviewTrack = typeof reviewTracks.$inferInsert;
