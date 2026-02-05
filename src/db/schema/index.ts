import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, uniqueIndex, index, numeric } from "drizzle-orm/pg-core";

// Users table - synced from Clerk
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Source images - uploaded photos of handwritten notes/learning materials
export const sourceImages = pgTable("source_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processed: boolean("processed").default(false).notNull(),
  extractionRaw: jsonb("extraction_raw"), // Raw AI response for debugging
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
  nextReviewAt: timestamp("next_review_at"),
  intervalDays: integer("interval_days").default(1).notNull(),
  easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).default("2.50").notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
}, (table) => ({
  userCharacterIdx: uniqueIndex("kanji_user_character_idx").on(table.userId, table.character),
  userIdIdx: index("kanji_user_id_idx").on(table.userId),
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
  nextReviewAt: timestamp("next_review_at"),
  intervalDays: integer("interval_days").default(1).notNull(),
  easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).default("2.50").notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
}, (table) => ({
  userWordReadingIdx: uniqueIndex("vocabulary_user_word_reading_idx").on(table.userId, table.word, table.reading),
  userIdIdx: index("vocabulary_user_id_idx").on(table.userId),
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

// Type exports for use in application
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
