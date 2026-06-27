import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// Main shows table (replaces overlays.json)
export const shows = sqliteTable('shows', {
  // Primary key
  id: integer('id').primaryKey({ autoIncrement: true }),
  tmdbId: integer('tmdb_id').notNull().unique(),

  // Trakt data
  traktSlug: text('trakt_slug'), // Trakt slug for API calls
  status: text('status').$type<'watching' | 'completed' | 'watchlist'>(), // Synced from Trakt progress

  // Basic info (cached from TMDB/Trakt)
  title: text('title'),
  year: integer('year'),
  posterPath: text('poster_path'),
  overview: text('overview'),
  genres: text('genres', { mode: 'json' }).$type<string[]>(),
  numberOfSeasons: integer('number_of_seasons'),
  showStatus: text('show_status'), // "Ended", "Returning Series", "Canceled"

  // User preferences
  watchPreference: text('watch_preference').$type<'solo' | 'together'>(),
  watchPreferenceNote: text('watch_preference_note'),
  rating: real('rating'), // 0.5-5.0
  reviewNote: text('review_note'),
  notes: text('notes'),
  ratedAt: text('rated_at'), // ISO date

  // AI predictions
  predictedRating: real('predicted_rating'),
  predictedRatingReason: text('predicted_rating_reason'),
  recommendedWatchPreference: text('recommended_watch_preference').$type<'solo' | 'together'>(),
  predictionsUpdatedAt: text('predictions_updated_at'),

  // Visibility flags
  hidden: integer('hidden', { mode: 'boolean' }).default(false),
  dropped: integer('dropped', { mode: 'boolean' }).default(false),

  // External IDs
  imdbId: text('imdb_id'),

  // External ratings (cached)
  imdbRating: real('imdb_rating'),
  imdbVoteCount: integer('imdb_vote_count'),
  traktRating: real('trakt_rating'),
  traktVoteCount: integer('trakt_vote_count'),
  tmdbRating: real('tmdb_rating'),
  tmdbVoteCount: integer('tmdb_vote_count'),
  rtCriticsScore: integer('rt_critics_score'),
  rtAudienceScore: integer('rt_audience_score'),
  rtFetchedAt: text('rt_fetched_at'),

  // Streaming availability (cached)
  streamingServices: text('streaming_services', { mode: 'json' }).$type<string[]>(),
  streamingFetchedAt: text('streaming_fetched_at'),
  justWatchUrl: text('justwatch_url'),

  // Structured metadata for filtering
  origin: text('origin').$type<'australian' | 'british' | 'american' | 'korean' | 'japanese' | 'canadian' | 'other'>(),
  format: text('format').$type<'workplace' | 'procedural' | 'anthology' | 'limited-series' | 'sitcom' | 'mockumentary' | 'family-sitcom' | 'prestige-drama' | 'other'>(),
  contentFlags: text('content_flags', { mode: 'json' }).$type<string[]>(),

  // Timestamps
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_shows_watch_preference').on(table.watchPreference),
  index('idx_shows_rating').on(table.rating),
  index('idx_shows_rt_fetched_at').on(table.rtFetchedAt),
  index('idx_shows_streaming_fetched_at').on(table.streamingFetchedAt),
  index('idx_shows_predictions_updated_at').on(table.predictionsUpdatedAt),
  index('idx_shows_origin').on(table.origin),
  index('idx_shows_format').on(table.format),
]);

// Settings table (single row pattern)
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  traktUsername: text('trakt_username'),
  openaiApiKey: text('openai_api_key'),
  justWatchUsername: text('justwatch_username'),
  traktAccessToken: text('trakt_access_token'),
  traktRefreshToken: text('trakt_refresh_token'),
  traktExpiresAt: integer('trakt_expires_at'),
  traktCreatedAt: integer('trakt_created_at'),
});

// Streaming services subscriptions
export const streamingServices = sqliteTable('streaming_services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  isSubscribed: integer('is_subscribed', { mode: 'boolean' }).default(false),
});

// Deleted shows (prevent re-import from Trakt)
export const deletedShows = sqliteTable('deleted_shows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tmdbId: integer('tmdb_id'),
  title: text('title').notNull(),
  year: integer('year'),
  deletedAt: text('deleted_at').notNull(),
}, (table) => [
  index('idx_deleted_shows_tmdb_id').on(table.tmdbId),
]);

// Episodes table (for future episode tracking)
export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  showTmdbId: integer('show_tmdb_id').notNull(),
  seasonNumber: integer('season_number').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title'),
  watched: integer('watched', { mode: 'boolean' }).default(false),
  watchedAt: text('watched_at'),
}, (table) => [
  index('idx_episodes_show_tmdb_id').on(table.showTmdbId),
]);

// Tags table (for user-defined tags)
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// Junction table for show-tag many-to-many relationship
export const showTags = sqliteTable('show_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  showTmdbId: integer('show_tmdb_id').notNull(),
  tagId: integer('tag_id').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_show_tags_show').on(table.showTmdbId),
  index('idx_show_tags_tag').on(table.tagId),
]);

// Type exports for TypeScript
export type DbShow = typeof shows.$inferSelect;
export type NewDbShow = typeof shows.$inferInsert;
export type DbSettings = typeof settings.$inferSelect;
export type DbStreamingService = typeof streamingServices.$inferSelect;
export type DbDeletedShow = typeof deletedShows.$inferSelect;
export type DbEpisode = typeof episodes.$inferSelect;
export type DbTag = typeof tags.$inferSelect;
export type DbShowTag = typeof showTags.$inferSelect;
