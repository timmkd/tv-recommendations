// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');

async function main() {
  const all = await db.select().from(shows);
  // Watchlist/unrated shows with a prediction >= 3 (the review set)
  const set = all.filter(s =>
    s.rating == null && !s.dropped && s.title &&
    s.predictedRating != null && s.predictedRating >= 3
  );
  console.log(`Unrated, not-dropped, predicted >= 3★: ${set.length}\n`);

  const SHORT = 250; // chars — below this the reason needs expanding to 400-600
  const short = set.filter(s => !s.predictedRatingReason || s.predictedRatingReason.length < SHORT);
  const ok = set.filter(s => s.predictedRatingReason && s.predictedRatingReason.length >= SHORT);
  console.log(`Reason adequate (>=${SHORT} chars): ${ok.length}`);
  console.log(`Reason SHORT (<${SHORT} chars) -> needs expansion: ${short.length}\n`);

  console.log('==== SHORT-REASON SHOWS (need a proper reason) ====');
  short.sort((a,b)=>b.predictedRating-a.predictedRating);
  for (const s of short) {
    console.log(`  ${s.predictedRating}★/${(s.recommendedWatchPreference||'?').padEnd(8)} ${(s.title||'').padEnd(34)} len=${(s.predictedRatingReason||'').length}  reason="${(s.predictedRatingReason||'').replace(/\s+/g,' ')}"`);
  }

  console.log(`\n==== ADEQUATE-REASON SHOWS (verify prediction only) (${ok.length}) ====`);
  ok.sort((a,b)=>b.predictedRating-a.predictedRating);
  console.log(ok.map(s=>`${s.title}(${s.predictedRating}★/${s.recommendedWatchPreference||'?'})`).join(', '));
}
main().catch(e => { console.error(e); process.exit(1); });
