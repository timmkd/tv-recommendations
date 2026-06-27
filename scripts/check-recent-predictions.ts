// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { desc, isNull, isNotNull, and, sql } = require('drizzle-orm');

async function main() {
  // Most recent shows from Trakt (any status), regardless of prediction
  const rows = await db.select({
    tmdbId: shows.tmdbId,
    title: shows.title,
    year: shows.year,
    status: shows.status,
    predictedRating: shows.predictedRating,
    predictedRatingReason: shows.predictedRatingReason,
    predictionsUpdatedAt: shows.predictionsUpdatedAt,
    rating: shows.rating,
    hidden: shows.hidden,
    dropped: shows.dropped,
    createdAt: shows.createdAt,
  }).from(shows).orderBy(desc(shows.createdAt)).limit(15);

  console.log('15 most recently created (any flag):\n');
  for (const s of rows) {
    const reasonLen = s.predictedRatingReason ? s.predictedRatingReason.length : 0;
    console.log(`created=${s.createdAt?.slice(0,10)} predUpd=${s.predictionsUpdatedAt?.slice(0,10) ?? '-'}  ${s.status ?? '?'}${s.hidden ? '/HIDDEN':''}${s.dropped ? '/DROP':''}  pred=${s.predictedRating ?? '-'}★ (reason=${reasonLen}ch)  rated=${s.rating ?? '-'}★  ${s.title} (${s.year ?? '?'})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
