/**
 * Compare shows currently on Trakt against what's stored in the local DB.
 * Reports any Trakt shows missing locally (potential new additions).
 *
 * Run with: npx tsx scripts/check-new-trakt-shows.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { db, shows } = require('../src/lib/db');
const { getUserShows } = require('../src/lib/trakt');
const { getSettings, getDeletedTmdbIds } = require('../src/lib/db/queries');

async function main() {
  const settings = await getSettings();
  if (!settings?.traktUsername) {
    console.error('No traktUsername set in settings');
    process.exit(1);
  }

  console.log(`Fetching Trakt shows for ${settings.traktUsername}...`);
  const traktShows = await getUserShows(settings.traktUsername);
  console.log(`Got ${traktShows.length} shows from Trakt`);

  const dbRows = await db.select({ tmdbId: shows.tmdbId, title: shows.title }).from(shows);
  const dbIds = new Set(dbRows.map((r: any) => r.tmdbId));
  console.log(`Local DB has ${dbRows.length} shows`);

  const deleted = await getDeletedTmdbIds();
  console.log(`${deleted.size} TMDB IDs are marked deleted (will skip)`);

  const missing = traktShows.filter((s: any) => !dbIds.has(s.tmdbId) && !deleted.has(s.tmdbId));

  console.log(`\n=== ${missing.length} shows on Trakt but not in local DB ===\n`);
  for (const s of missing) {
    console.log(
      `tmdb=${s.tmdbId}  slug=${s.slug}  status=${s.status ?? '?'}  ${s.title} (${s.year ?? '?'})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
