/**
 * Migration script: JSON files → SQLite (Turso)
 *
 * Run with: npx tsx scripts/migrate-to-sqlite.ts
 *
 * Requires environment variables:
 *   TURSO_DATABASE_URL
 *   TURSO_AUTH_TOKEN
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { shows, settings, streamingServices, deletedShows } from '../src/lib/db/schema';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

if (!process.env.TURSO_DATABASE_URL) {
  console.error('Error: TURSO_DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

interface OverlayJson {
  tmdbId: number;
  title?: string;
  year?: number;
  posterPath?: string;
  overview?: string;
  genres?: string[];
  numberOfSeasons?: number;
  showStatus?: string;
  watchPreference?: 'solo' | 'together';
  watchPreferenceNote?: string;
  rating?: number;
  reviewNote?: string;
  notes?: string;
  ratedAt?: string;
  predictedRating?: number;
  predictedRatingReason?: string;
  recommendedWatchPreference?: 'solo' | 'together';
  predictionsUpdatedAt?: string;
  hidden?: boolean;
  dropped?: boolean;
  imdbId?: string;
  imdbRating?: number;
  imdbVoteCount?: number;
  traktRating?: number;
  traktVoteCount?: number;
  tmdbRating?: number;
  tmdbVoteCount?: number;
  rtCriticsScore?: number;
  rtAudienceScore?: number;
  rtFetchedAt?: string;
  streamingServices?: string[];
  streamingFetchedAt?: string;
  justWatchUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SettingsJson {
  traktUsername?: string;
  openaiApiKey?: string;
  justWatchUsername?: string;
  traktAuth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    createdAt: number;
  };
  streamingServices: Array<{
    slug: string;
    name: string;
    isSubscribed: boolean;
  }>;
  deletedShows?: Array<{
    tmdbId?: number;
    title: string;
    year?: number;
    deletedAt: string;
  }>;
}

async function migrate() {
  console.log('Starting migration from JSON to SQLite...\n');

  // 1. Migrate overlays.json
  const overlaysPath = join(process.cwd(), 'data', 'overlays.json');
  let overlaysData: { overlays: OverlayJson[] };

  try {
    overlaysData = JSON.parse(readFileSync(overlaysPath, 'utf-8'));
  } catch (e) {
    console.error('Failed to read overlays.json:', e);
    process.exit(1);
  }

  console.log(`Found ${overlaysData.overlays.length} shows to migrate...`);

  let showsInserted = 0;
  let showsSkipped = 0;

  for (const overlay of overlaysData.overlays) {
    try {
      await db.insert(shows).values({
        tmdbId: overlay.tmdbId,
        title: overlay.title ?? null,
        year: overlay.year ?? null,
        posterPath: overlay.posterPath ?? null,
        overview: overlay.overview ?? null,
        genres: overlay.genres ?? null,
        numberOfSeasons: overlay.numberOfSeasons ?? null,
        showStatus: overlay.showStatus ?? null,
        watchPreference: overlay.watchPreference ?? null,
        watchPreferenceNote: overlay.watchPreferenceNote ?? null,
        rating: overlay.rating ?? null,
        reviewNote: overlay.reviewNote ?? null,
        notes: overlay.notes ?? null,
        ratedAt: overlay.ratedAt ?? null,
        predictedRating: overlay.predictedRating ?? null,
        predictedRatingReason: overlay.predictedRatingReason ?? null,
        recommendedWatchPreference: overlay.recommendedWatchPreference ?? null,
        predictionsUpdatedAt: overlay.predictionsUpdatedAt ?? null,
        hidden: overlay.hidden ?? false,
        dropped: overlay.dropped ?? false,
        imdbId: overlay.imdbId ?? null,
        imdbRating: overlay.imdbRating ?? null,
        imdbVoteCount: overlay.imdbVoteCount ?? null,
        traktRating: overlay.traktRating ?? null,
        traktVoteCount: overlay.traktVoteCount ?? null,
        tmdbRating: overlay.tmdbRating ?? null,
        tmdbVoteCount: overlay.tmdbVoteCount ?? null,
        rtCriticsScore: overlay.rtCriticsScore ?? null,
        rtAudienceScore: overlay.rtAudienceScore ?? null,
        rtFetchedAt: overlay.rtFetchedAt ?? null,
        streamingServices: overlay.streamingServices ?? null,
        streamingFetchedAt: overlay.streamingFetchedAt ?? null,
        justWatchUrl: overlay.justWatchUrl ?? null,
        createdAt: overlay.createdAt ?? new Date().toISOString(),
        updatedAt: overlay.updatedAt ?? new Date().toISOString(),
      });
      showsInserted++;
    } catch (e: unknown) {
      // Skip duplicates (UNIQUE constraint on tmdbId)
      if ((e as Error).message?.includes('UNIQUE constraint')) {
        showsSkipped++;
      } else {
        console.error(`Failed to insert show ${overlay.title}:`, e);
      }
    }
  }

  console.log(`Shows: ${showsInserted} inserted, ${showsSkipped} skipped (duplicates)\n`);

  // 2. Migrate settings.json
  const settingsPath = join(process.cwd(), 'data', 'settings.json');
  let settingsData: SettingsJson;

  try {
    settingsData = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch (e) {
    console.error('Failed to read settings.json:', e);
    process.exit(1);
  }

  console.log('Migrating settings...');

  try {
    await db.insert(settings).values({
      id: 1,
      traktUsername: settingsData.traktUsername ?? null,
      openaiApiKey: settingsData.openaiApiKey ?? null,
      justWatchUsername: settingsData.justWatchUsername ?? null,
      traktAccessToken: settingsData.traktAuth?.accessToken ?? null,
      traktRefreshToken: settingsData.traktAuth?.refreshToken ?? null,
      traktExpiresAt: settingsData.traktAuth?.expiresAt ?? null,
      traktCreatedAt: settingsData.traktAuth?.createdAt ?? null,
    });
    console.log('Settings migrated successfully\n');
  } catch (e: unknown) {
    if ((e as Error).message?.includes('UNIQUE constraint')) {
      console.log('Settings already exist, skipping\n');
    } else {
      console.error('Failed to insert settings:', e);
    }
  }

  // 3. Migrate streaming services
  console.log(`Migrating ${settingsData.streamingServices.length} streaming services...`);

  let servicesInserted = 0;
  let servicesSkipped = 0;

  for (const service of settingsData.streamingServices) {
    try {
      await db.insert(streamingServices).values({
        slug: service.slug,
        name: service.name,
        isSubscribed: service.isSubscribed,
      });
      servicesInserted++;
    } catch (e: unknown) {
      if ((e as Error).message?.includes('UNIQUE constraint')) {
        servicesSkipped++;
      } else {
        console.error(`Failed to insert service ${service.name}:`, e);
      }
    }
  }

  console.log(`Services: ${servicesInserted} inserted, ${servicesSkipped} skipped (duplicates)\n`);

  // 4. Migrate deleted shows
  const deletedShowsList = settingsData.deletedShows || [];
  console.log(`Migrating ${deletedShowsList.length} deleted shows...`);

  let deletedInserted = 0;

  for (const deleted of deletedShowsList) {
    try {
      await db.insert(deletedShows).values({
        tmdbId: deleted.tmdbId ?? null,
        title: deleted.title,
        year: deleted.year ?? null,
        deletedAt: deleted.deletedAt || new Date().toISOString(),
      });
      deletedInserted++;
    } catch (e) {
      console.error(`Failed to insert deleted show ${deleted.title}:`, e);
    }
  }

  console.log(`Deleted shows: ${deletedInserted} inserted\n`);

  // Summary
  console.log('='.repeat(50));
  console.log('Migration complete!');
  console.log('='.repeat(50));
  console.log(`Shows:             ${showsInserted}`);
  console.log(`Streaming Services: ${servicesInserted}`);
  console.log(`Deleted Shows:     ${deletedInserted}`);
  console.log(`Settings:          1`);
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
