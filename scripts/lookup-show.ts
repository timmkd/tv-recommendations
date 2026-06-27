// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { like, or } = require('drizzle-orm');

async function main() {
  const q = process.argv[2] || 'baby reindeer';
  const rows = await db.select().from(shows).where(like(shows.title, `%${q}%`));
  for (const r of rows) {
    console.log(`\n${r.title} (${r.year})  tmdb=${r.tmdbId}`);
    console.log(`  rating=${r.rating}★ watchPref=${r.watchPreference}  status=${r.status}  dropped=${r.dropped}`);
    console.log(`  pred=${r.predictedRating}★/${r.recommendedWatchPreference}`);
    if (r.reviewNote) console.log(`  reviewNote: ${r.reviewNote}`);
    if (r.watchPreferenceNote) console.log(`  watchPrefNote: ${r.watchPreferenceNote}`);
    if (r.notes) console.log(`  notes: ${r.notes}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
