// @ts-nocheck
// Read-only report on the bingeability axis.
//   npx tsx scripts/bingeability-report.ts [--since <ISO>]
// Sections: user-scored shows (optionally only those touched since <ISO>),
// prediction accuracy where both axes exist, and aggregate stats.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { isNotNull } = require('drizzle-orm');

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}
function sd(xs) {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = xs.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
}

async function main() {
  const sinceIdx = process.argv.indexOf('--since');
  const since = sinceIdx > -1 ? process.argv[sinceIdx + 1] : null;

  const all = await db.select().from(shows).where(isNotNull(shows.bingeability));
  all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  console.log(`Total user-scored bingeability: ${all.length}`);

  const recent = since ? all.filter(s => String(s.updatedAt) > since) : all;
  if (since) console.log(`Scored rows with updatedAt > ${since}: ${recent.length}`);

  console.log('\n=== USER-SCORED SHOWS (newest updatedAt first) ===');
  for (const s of recent) {
    const pb = s.predictedBingeability;
    const d = pb != null ? s.bingeability - pb : null;
    console.log(`\n--- ${s.title} (${s.year}) tmdb=${s.tmdbId}`);
    console.log(`  binge=${s.bingeability}  predBinge=${pb ?? '-'}  dBinge=${d ?? '-'}`);
    console.log(`  rating=${s.rating ?? '-'}  predRating=${s.predictedRating ?? '-'}  pref=${s.watchPreference ?? '-'}/${s.recommendedWatchPreference ?? '-'}`);
    console.log(`  status=${s.status} dropped=${s.dropped} seasons=${s.numberOfSeasons} showStatus=${s.showStatus}`);
    console.log(`  genres=${JSON.stringify(s.genres)} origin=${s.origin ?? '-'} format=${s.format ?? '-'}`);
    console.log(`  imdb=${s.imdbRating ?? '-'} trakt=${s.traktRating ?? '-'} rt=${s.rtCriticsScore ?? '-'}/${s.rtAudienceScore ?? '-'}`);
    console.log(`  updatedAt=${s.updatedAt} ratedAt=${s.ratedAt ?? '-'}`);
    if (s.reviewNote) console.log(`  reviewNote: ${s.reviewNote}`);
    if (s.watchPreferenceNote) console.log(`  prefNote: ${s.watchPreferenceNote}`);
    if (s.predictedBingeabilityReason) console.log(`  predBingeReason: ${s.predictedBingeabilityReason}`);
  }

  // Aggregates over the whole scored set
  const withStar = all.filter(s => s.rating != null);
  const bs = withStar.map(s => s.bingeability);
  const rs = withStar.map(s => s.rating);
  console.log('\n=== AGGREGATES (all user-scored) ===');
  console.log(`n with both binge + star: ${withStar.length}`);
  console.log(`r(binge, star) = ${pearson(bs, rs).toFixed(3)}  (r2=${(pearson(bs, rs) ** 2).toFixed(3)})`);
  console.log(`binge sd = ${sd(bs).toFixed(3)}   star sd = ${sd(rs).toFixed(3)}`);

  const dist = {};
  for (const s of all) dist[s.bingeability] = (dist[s.bingeability] || 0) + 1;
  console.log('\nBingeability distribution:');
  Object.keys(dist).sort().forEach(k => console.log(`  binge ${k}: ${dist[k]}`));

  console.log('\nMean star rating by bingeability level:');
  for (const lvl of [1, 2, 3, 4, 5]) {
    const g = withStar.filter(s => s.bingeability === lvl);
    if (!g.length) continue;
    const m = g.reduce((s, v) => s + v.rating, 0) / g.length;
    console.log(`  binge ${lvl} -> ${m.toFixed(2)}star (n=${g.length})`);
  }

  console.log('\nStar >=4.5 shows and their bingeability:');
  for (const s of withStar.filter(s => s.rating >= 4.5).sort((a, b) => b.rating - a.rating)) {
    console.log(`  ${s.rating}star binge=${s.bingeability}  ${s.title}`);
  }

  // Prediction accuracy on the bingeability axis
  const both = all.filter(s => s.predictedBingeability != null);
  console.log('\n=== BINGEABILITY PREDICTION ACCURACY ===');
  if (both.length) {
    const ds = both.map(s => s.bingeability - s.predictedBingeability);
    const mae = ds.reduce((s, d) => s + Math.abs(d), 0) / ds.length;
    const bias = ds.reduce((s, d) => s + d, 0) / ds.length;
    console.log(`n=${both.length}  MAE=${mae.toFixed(2)}  bias=${bias.toFixed(2)} (positive = under-predicted)`);
    console.log(`exact=${ds.filter(d => d === 0).length}  within1=${ds.filter(d => Math.abs(d) <= 1).length}  miss>=2=${ds.filter(d => Math.abs(d) >= 2).length}`);
    console.log('\nMisses of >=2 (worst first):');
    both.filter(s => Math.abs(s.bingeability - s.predictedBingeability) >= 2)
      .sort((a, b) => Math.abs(b.bingeability - b.predictedBingeability) - Math.abs(a.bingeability - a.predictedBingeability))
      .forEach(s => console.log(`  ${s.title}: pred ${s.predictedBingeability} -> actual ${s.bingeability}`));
  } else {
    console.log('n=0 — no user-scored show also carries a predictedBingeability.');
  }

  // Live predictions with no user score (the rescan target set)
  const preds = await db.select().from(shows).where(isNotNull(shows.predictedBingeability));
  const unscored = preds.filter(s => s.bingeability == null);
  const pdist = {};
  for (const s of unscored) pdist[s.predictedBingeability] = (pdist[s.predictedBingeability] || 0) + 1;
  console.log('\n=== PREDICTED-ONLY (no user score) ===');
  console.log(`total predictedBingeability rows: ${preds.length}; of those unscored: ${unscored.length}`);
  console.log('Predicted distribution (unscored):');
  Object.keys(pdist).sort().forEach(k => console.log(`  pred ${k}: ${pdist[k]}`));

  console.log(`\nSUMMARY: scored=${all.length} recent=${recent.length} predOnly=${unscored.length} bingeMAE=${both.length ? (both.map(s => Math.abs(s.bingeability - s.predictedBingeability)).reduce((a, b) => a + b, 0) / both.length).toFixed(2) : 'n/a'}`);
}
main();
