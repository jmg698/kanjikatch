import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, uniqueIndex, index, numeric } from "drizzle-orm/pg-core";

// Subscription tier values. Stored as text (not a pg enum) so values can be
// added without a schema migration. Validate at application boundaries.
//   - free:        default, hits free-tier limits
//   - pro:         paid subscriber
//   - pro_comped:  internal-only tier with Pro features but no billing.
//                  Manually granted via scripts/grant-comped-pro.ts.
//                  Never surface in user-facing copy. See PRO_TIER_PLAN.md.
export type SubscriptionTier = "free" | "pro" | "pro_comped";
export const SUBSCRIPTION_TIER_VALUES: readonly SubscriptionTier[] = ["free", "pro", "pro_comped"] as const;

// Users table - synced from Clerk
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  subscriptionTier: text("subscription_tier").default("free").notNull(),
  // Comped-tier audit metadata. Only populated when subscriptionTier = 'pro_comped'.
  compedBy: text("comped_by"),
  compedReason: text("comped_reason"),
  compedAt: timestamp("comped_at"),
  // Stripe billing state — populated and maintained by the Stripe webhook.
  // null until the user starts checkout for the first time.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  // Mirrors Stripe Subscription.status: active | trialing | past_due | canceled
  // | incomplete | incomplete_expired | unpaid | paused. null = never subscribed.
  subscriptionStatus: text("subscription_status"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  // Free-tier extraction accounting. See src/lib/plan-limits.ts for the
  // read/reset semantics. extractionsPeriodStart is the first-of-month UTC
  // for the period the counter belongs to; when the calendar month advances,
  // the next read resets used→0 and advances the start.
  extractionsUsedThisPeriod: integer("extractions_used_this_period").default(0).notNull(),
  extractionsPeriodStart: timestamp("extractions_period_start").defaultNow().notNull(),
  starterExtractionsUsed: integer("starter_extractions_used").default(0).notNull(),
  // Onboarding tour state. 'pending' for new signups; the /dashboard server
  // gate redirects pending users to /welcome. Flips to 'in_progress' when the
  // user lands on /welcome, then 'completed' or 'skipped' on exit. See
  // ONBOARDING_PLAN.md.
  onboardingTourStatus: text("onboarding_tour_status").default("pending").notNull(),
  // Set when the user first hits /welcome. Drives the 7-minute time-guardrail
  // fallback that offers a sample if a real-photo path is dragging.
  welcomeStartedAt: timestamp("welcome_started_at"),
}, (table) => ({
  stripeCustomerIdx: uniqueIndex("users_stripe_customer_id_idx").on(table.stripeCustomerId),
}));

// Source images/text - uploaded photos or pasted text of learning materials
export const sourceImages = pgTable("source_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Optional user-provided label for the material (e.g. "Yotsubato Vol 3").
  // When null, callers fall back to a date-based default.
  name: text("name"),
  imageUrl: text("image_url"),
  sourceText: text("source_text"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processed: boolean("processed").default(false).notNull(),
  extractionRaw: jsonb("extraction_raw"),
  errorMessage: text("error_message"),
  // True when the source was loaded from a pre-extracted onboarding sample
  // (see ONBOARDING_PLAN.md). Library renders a "guided sample" pill on
  // these and settings offers a one-tap removal action.
  isOnboardingSample: boolean("is_onboarding_sample").default(false).notNull(),
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
  // Enrichment tracking — set when a row was added with incomplete data
  // (e.g. quick-add from a reading where the AI didn't provide a meaning)
  // and a background enrichment pass should fill in the missing fields.
  needsEnrichment: boolean("needs_enrichment").default(false).notNull(),
  enrichmentAttempts: integer("enrichment_attempts").default(0).notNull(),
  lastEnrichmentAttemptAt: timestamp("last_enrichment_attempt_at"),
  enrichmentSourceSentence: text("enrichment_source_sentence"),
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
  needsEnrichmentIdx: index("vocabulary_needs_enrichment_idx").on(table.needsEnrichment, table.lastEnrichmentAttemptAt),
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

// User-submitted reports / feedback. Filed from the "Report this issue"
// button on the capture error screen. source_image_id is nullable because
// some failures happen before the source_images row is created (upload
// errors, validation errors); the report is still useful without it.
export const userReports = pgTable("user_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceImageId: uuid("source_image_id").references(() => sourceImages.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  note: text("note"),
  userAgent: text("user_agent"),
  errorMessageSnapshot: text("error_message_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_reports_user_id_idx").on(table.userId),
  createdAtIdx: index("user_reports_created_at_idx").on(table.createdAt),
}));

// API usage events — one row per Anthropic call. Powers the cost protection
// guards (global circuit breaker, per-user token cap, per-IP throttle).
// userId is nullable so we can still record IP-throttle events from
// unauthenticated paths (extract-text etc. are auth-gated today, but
// recording the IP regardless leaves the door open for future endpoints).
export const apiUsageEvents = pgTable("api_usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  ipHash: text("ip_hash"), // sha256(ip + IP_HASH_SALT), never the raw IP
  endpoint: text("endpoint").notNull(), // 'extract' | 'extract_text' | 'sentence_generate' | 'enrich'
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("api_usage_created_at_idx").on(table.createdAt),
  userCreatedIdx: index("api_usage_user_created_idx").on(table.userId, table.createdAt),
  ipCreatedIdx: index("api_usage_ip_created_idx").on(table.ipHash, table.createdAt),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiUsageEvent = typeof apiUsageEvents.$inferSelect;
export type NewApiUsageEvent = typeof apiUsageEvents.$inferInsert;

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

export type UserReport = typeof userReports.$inferSelect;
export type NewUserReport = typeof userReports.$inferInsert;
