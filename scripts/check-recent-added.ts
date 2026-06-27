// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { desc } = require('drizzle-orm');

async function main() {
  const rows = await db.select({
    tmdbId: shows.tmdbId,
    title: shows.title,
    year: shows.year,
    status: shows.status,
    predictedRating: shows.predictedRating,
    predictionsUpdatedAt: shows.predictionsUpdatedAt,
    rating: shows.rating,
    createdAt: shows.createdAt,
  }).from(shows).orderBy(desc(shows.createdAt)).limit(30);

  console.log('30 most recently added shows:\n');
  for (const s of rows) {
    console.log(`${s.createdAt?.slice(0,10)}  tmdb=${s.tmdbId}  ${s.status ?? '?'}  pred=${s.predictedRating ?? '-'}★  rated=${s.rating ?? '-'}★  ${s.title} (${s.year ?? '?'})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
