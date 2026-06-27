// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');

const has = (arr, ...names) => (arr||[]).some(g => names.includes(g));

async function main() {
  const all = await db.select().from(shows);
  // Unrated shows that carry a prediction (these are the live "calls" never reality-checked)
  const unratedPred = all.filter(s => s.rating == null && !s.dropped && s.recommendedWatchPreference && s.predictedRating != null && s.title);

  const tog = unratedPred.filter(s => s.recommendedWatchPreference === 'together');
  const solo = unratedPred.filter(s => s.recommendedWatchPreference === 'solo');
  console.log(`Unrated shows with a prediction: ${unratedPred.length}  (together=${tog.length}, solo=${solo.length})\n`);

  // A) Rosehaven-risk: together + Comedy genre + NO crime/mystery backbone
  const rosehavenRisk = tog.filter(s => has(s.genres, 'Comedy') && !has(s.genres, 'Crime', 'Mystery'));
  console.log(`==== A) ROSEHAVEN-RISK: together + comedy, no crime/mystery backbone (${rosehavenRisk.length}) ====`);
  for (const s of rosehavenRisk) console.log(`  ${s.predictedRating}★  ${(s.title||'').padEnd(34)} ${(s.genres||[]).join(',')}`);

  // B) Over-prediction screen: together predictions >= 4 (the lane where we over-predict)
  const togHigh = tog.filter(s => s.predictedRating >= 4).sort((a,b)=>b.predictedRating-a.predictedRating);
  console.log(`\n==== B) TOGETHER predictions >= 4★ (drop-risk re-screen) (${togHigh.length}) ====`);
  for (const s of togHigh) console.log(`  ${s.predictedRating}★  ${(s.title||'').padEnd(34)} ${(s.genres||[]).join(',')}`);
}
main().catch(e => { console.error(e); process.exit(1); });
