// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { isNotNull, sql, and } = require('drizzle-orm');

async function main() {
  const all = await db.select({
    rating: shows.rating,
    watchPreference: shows.watchPreference,
    predictedRating: shows.predictedRating,
  }).from(shows).where(isNotNull(shows.rating));

  console.log(`Total rated: ${all.length}`);

  // Rating distribution
  const buckets = {};
  for (const r of all) {
    buckets[r.rating] = (buckets[r.rating] || 0) + 1;
  }
  console.log('\nRating distribution:');
  Object.keys(buckets).sort((a,b) => b-a).forEach(k => {
    console.log(`  ${k}★: ${buckets[k]}`);
  });

  // Solo vs together averages
  const solo = all.filter(r => r.watchPreference === 'solo');
  const together = all.filter(r => r.watchPreference === 'together');
  const soloAvg = solo.reduce((s,r) => s+r.rating, 0) / solo.length;
  const togetherAvg = together.reduce((s,r) => s+r.rating, 0) / together.length;
  console.log(`\nSolo (n=${solo.length}) avg: ${soloAvg.toFixed(2)}★`);
  console.log(`Together (n=${together.length}) avg: ${togetherAvg.toFixed(2)}★`);

  // Prediction accuracy (where both rating and predictedRating exist)
  const withPred = all.filter(r => r.predictedRating != null);
  console.log(`\nShows with both rating and prediction: ${withPred.length}`);
  const deltas = withPred.map(r => r.rating - r.predictedRating);
  const mae = deltas.reduce((s,d) => s + Math.abs(d), 0) / deltas.length;
  const bias = deltas.reduce((s,d) => s+d, 0) / deltas.length;
  const within05 = deltas.filter(d => Math.abs(d) <= 0.5).length;
  console.log(`  MAE: ${mae.toFixed(2)}★`);
  console.log(`  Bias: ${bias > 0 ? '+' : ''}${bias.toFixed(2)}★ (positive = under-predicted)`);
  console.log(`  Within 0.5★: ${within05}/${deltas.length} (${((within05/deltas.length)*100).toFixed(0)}%)`);

  // Recent prediction misses
  const recent = withPred.filter(r => Math.abs(r.rating - r.predictedRating) >= 1.0);
  console.log(`\nBig misses (|Δ| ≥ 1.0★): ${recent.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
