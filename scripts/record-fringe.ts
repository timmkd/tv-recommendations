// @ts-nocheck
/**
 * Record the user's Fringe history (tmdb=1705).
 *
 * Fringe was cited at 4★ in docs/taste-profile.md and docs/llm-review-prompt.md
 * for months but was absent from the shows table entirely, so it fed no stats.
 * scripts/add-show-by-tmdb.ts 1705 --status watching created the row; this writes
 * the user fields that only the user could supply.
 *
 * The shape (user's account, 2026-09-10): rated 4★, loved four seasons, the final
 * season petered out, never finished it, and it is now too long ago to restart just
 * to close it out.
 *
 * Deliberate choices, so a later pass doesn't "tidy" them:
 *   status = 'watching'  — a genuine partial watch. NOT 'completed' (S5 unfinished).
 *   dropped = false      — two reasons. (1) `dropped` hides a show from every view,
 *                          and the point of adding Fringe was to make the record
 *                          visible. (2) The dropped cohort is load-bearing for the
 *                          solo/together variance model (28 shows, together avg
 *                          2.56★ = Helen-fit failures). Fringe is an *abandonment
 *                          after a successful run*, not a failure, and counting it
 *                          as a 4★ together "drop" would corrupt that signal.
 *   bingeability = null  — user-entered field. Not fabricating one; needs entering
 *                          in the app.
 *   no prediction fields — the show is rated; predictions are for unrated shows.
 *
 * No Trakt push: the app registration is gone (see the Trakt warning in CLAUDE.md),
 * so syncRatingToTrakt would fail 403. Ratings are a two-way sync field, so this
 * rating will need pushing once Trakt is re-registered.
 *
 * Run: npx tsx scripts/record-fringe.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

const FRINGE = 1705;

const REVIEW_NOTE = [
  'Rated 4★. Really enjoyed the whole thing up until the last season, when it petered',
  'out — never finished S5, and by now it is long enough ago that starting again just',
  'to finish the final season is not worth it. The 4★ is a verdict on four strong',
  'seasons; the fizzled, unfinished fifth is what keeps it off 4.5★.',
].join(' ');

const WATCH_PREF_NOTE = [
  'Together. Helen enjoys procedurals and case-of-the-week formats, which is what made',
  'this a shared watch — the same reason The Rookie 4.5★ works together. Notable that it',
  'held as a together watch even as the parallel-universe mythology deepened, which is a',
  'partial counterexample to the procedural→mythology-pivot-means-solo rule.',
].join(' ');

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const [before] = await db.select().from(shows).where(eq(shows.tmdbId, FRINGE));
  if (!before) {
    console.error(`RESULT: FAIL — tmdb=${FRINGE} not in the shows table. Run: npx tsx scripts/add-show-by-tmdb.ts 1705 --status watching`);
    process.exit(1);
  }

  console.log('=== BEFORE ===');
  console.log(`${before.title} (${before.year})  status=${before.status}  rating=${before.rating}`);
  console.log(`watchPreference=${before.watchPreference}  bingeability=${before.bingeability}  dropped=${before.dropped}`);

  if (before.rating != null && before.rating !== 4) {
    console.error(`RESULT: FAIL — refusing to overwrite an existing rating of ${before.rating}★`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const patch = {
    rating: 4,
    ratedAt: now,
    reviewNote: REVIEW_NOTE,
    watchPreference: 'together',
    watchPreferenceNote: WATCH_PREF_NOTE,
    status: 'watching',
    dropped: false,
    updatedAt: now,
  };

  console.log('\n=== PATCH ===');
  for (const [k, v] of Object.entries(patch)) console.log(`  ${k} = ${JSON.stringify(v)}`);

  if (dryRun) {
    console.log('\nRESULT: DRY-RUN OK (0 written)');
    process.exit(0);
  }

  await db.update(shows).set(patch).where(eq(shows.tmdbId, FRINGE));

  const [after] = await db.select().from(shows).where(eq(shows.tmdbId, FRINGE));
  console.log('\n=== AFTER ===');
  console.log(`${after.title} (${after.year})  status=${after.status}  rating=${after.rating}★  watchPreference=${after.watchPreference}  dropped=${after.dropped}`);
  console.log(`bingeability=${after.bingeability} (still needs entering in the app)`);
  console.log('\nRESULT: OK (1 written)');
}

main();
