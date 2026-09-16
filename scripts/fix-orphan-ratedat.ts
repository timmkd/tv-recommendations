// @ts-nocheck
/**
 * Clear `ratedAt` on rows that carry a timestamp but NO rating.
 *
 * A `ratedAt` with `rating = null` is self-contradictory — nothing was rated at
 * that time — and it has a real cost: `scripts/latest-ratings.ts` selects on
 * `ratedAt > since`, so an orphan timestamp is reported as a NEW RATING with a
 * `null★` value. /review-ratings branches on that count and would mis-route.
 *
 * Cause: `PUT /api/trakt/shows` computes
 *   ratingChanged = updates.rating !== undefined && updates.rating !== existing?.rating
 * Saving a never-rated show sends `rating: null` while the stored overlay has no
 * `rating` key at all, so `null !== undefined` is true and a ratedAt is stamped.
 * Fixed at the source in the same commit; this script repairs existing rows.
 *
 * `ratedAt` is a USER field. This only ever sets it to null, and only where there
 * is no rating for it to belong to — it can never discard a real rating date.
 *
 * Run: npx tsx scripts/fix-orphan-ratedat.ts            (dry run, default)
 *      npx tsx scripts/fix-orphan-ratedat.ts --confirm  (writes)
 *      ... [--tmdb a,b]                                 (restrict to these shows)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

async function main() {
  const confirm = process.argv.includes('--confirm');
  const idx = process.argv.indexOf('--tmdb');
  const scope = idx > -1 && process.argv[idx + 1]
    ? new Set(process.argv[idx + 1].split(',').map((x) => Number(x.trim())).filter(Boolean))
    : null;

  const all = await db.select().from(shows);
  const orphans = all.filter(
    (r) => r.ratedAt != null && r.rating == null && (!scope || scope.has(r.tmdbId))
  );

  if (orphans.length === 0) {
    console.log('No orphan ratedAt rows found.');
    console.log('\nSUMMARY: orphans=0 cleared=0');
    console.log('RESULT: OK');
    return;
  }

  for (const r of orphans) {
    console.log(
      `  ${confirm ? 'CLEAR' : 'WOULD CLEAR'} ${r.title} (tmdb=${r.tmdbId}) ` +
        `ratedAt=${r.ratedAt} rating=${r.rating} status=${r.status ?? 'null'}`
    );
    if (confirm) {
      // updatedAt is deliberately NOT touched: this is a data repair, not a
      // user-meaningful edit, and bumping it would reorder "Recently Updated".
      await db.update(shows).set({ ratedAt: null }).where(eq(shows.tmdbId, r.tmdbId));
    }
  }

  console.log(`\nSUMMARY: orphans=${orphans.length} cleared=${confirm ? orphans.length : 0} dryRun=${!confirm}`);
  console.log(`RESULT: ${confirm ? 'OK' : 'DRY-RUN OK (pass --confirm to write)'}`);
}

main().catch((e) => {
  console.error(`RESULT: FAIL — ${e.message}`);
  process.exit(1);
});
