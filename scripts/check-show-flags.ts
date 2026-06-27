// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq, inArray } = require('drizzle-orm');

async function main() {
  const rows = await db.select().from(shows).where(inArray(shows.tmdbId, [1405, 132128]));
  for (const r of rows) {
    console.log(`${r.title}: pred=${r.predictedRating} rating=${r.rating} dropped=${r.dropped} hidden=${r.hidden} status=${r.status}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
