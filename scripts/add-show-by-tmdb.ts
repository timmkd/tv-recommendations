// @ts-nocheck
/**
 * Add a show to the library by TMDB id, without touching Trakt.
 *
 * Use when the Trakt credential/authorization is broken (the normal path,
 * POST /api/trakt/sync, needs a working Trakt app) but you still want a show
 * in the library. Metadata comes from TMDB; no rating, no prediction.
 *
 * Idempotent: an existing row is enriched in place, never overwritten with
 * nulls, and user fields (rating/ratedAt/reviewNote/watchPreference/
 * bingeability) are never touched.
 *
 * Run: npx tsx scripts/add-show-by-tmdb.ts <tmdbId> [--status watchlist|watching|completed]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { enrichShowWithTMDB, getShowDetails } = require('../src/lib/tmdb');

async function main() {
  const tmdbId = Number(process.argv[2]);
  const statusIdx = process.argv.indexOf('--status');
  const status = statusIdx > -1 ? process.argv[statusIdx + 1] : 'watchlist';

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    console.error('RESULT: FAIL — usage: npx tsx scripts/add-show-by-tmdb.ts <tmdbId> [--status watchlist]');
    process.exit(1);
  }
  if (!['watchlist', 'watching', 'completed'].includes(status)) {
    console.error(`RESULT: FAIL — --status must be watchlist|watching|completed, got "${status}"`);
    process.exit(1);
  }

  // enrichShowWithTMDB swallows errors and omits the title, so get details first:
  // this is what surfaces a bad/movie id as a real failure rather than a silent stub.
  let details, tmdbData;
  try {
    details = await getShowDetails(tmdbId);
    tmdbData = await enrichShowWithTMDB(tmdbId);
  } catch (e) {
    console.error(`RESULT: FAIL — TMDB lookup failed for ${tmdbId}: ${e.message}`);
    console.error('  (a movie id will 404 here — this script only handles TV ids)');
    process.exit(1);
  }
  if (!details?.name) {
    console.error(`RESULT: FAIL — TMDB returned no name for ${tmdbId}; is that a TV id?`);
    process.exit(1);
  }
  tmdbData.title = details.name;

  const now = new Date().toISOString();
  const existing = await db.select().from(shows).where(eq(shows.tmdbId, tmdbId));

  // Only write fields TMDB actually returned — never null out existing data.
  const row = { updatedAt: now };
  for (const f of ['title', 'year', 'posterPath', 'overview', 'genres',
                   'numberOfSeasons', 'showStatus', 'tmdbRating', 'tmdbVoteCount']) {
    if (tmdbData[f] !== undefined && tmdbData[f] !== null) row[f] = tmdbData[f];
  }

  if (existing.length) {
    await db.update(shows).set(row).where(eq(shows.tmdbId, tmdbId));
    console.log(`Updated existing row: ${row.title} (${row.year ?? '?'}) tmdb=${tmdbId}`);
    console.log(`  status left as "${existing[0].status ?? 'null'}" (not overwritten)`);
  } else {
    await db.insert(shows).values({ ...row, tmdbId, status, createdAt: now });
    console.log(`Added: ${row.title} (${row.year ?? '?'}) tmdb=${tmdbId} status=${status}`);
  }

  console.log(`  genres=${JSON.stringify(row.genres ?? null)} seasons=${row.numberOfSeasons ?? '?'} showStatus=${row.showStatus ?? '?'} tmdbRating=${row.tmdbRating ?? '-'}`);
  console.log('  NOTE: no Trakt slug, no prediction. Run /predict-new-shows to predict it.');
  console.log(`RESULT: OK (${existing.length ? 'updated' : 'inserted'} tmdb=${tmdbId})`);
}
main().catch((e) => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
