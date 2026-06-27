// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq, isNotNull, and } = require('drizzle-orm');
const { getShowStreaming } = require('../src/lib/trakt');
const { getStreamingAvailability } = require('../src/lib/justwatch');

async function main() {
  // Sample: 15 non-dropped shows with a slug + title
  const all = await db.select().from(shows);
  const sample = all.filter(s => s.traktSlug && s.title && !s.dropped).slice(0, 15);

  console.log('TITLE | stored | TRAKT | JUSTWATCH');
  for (const s of sample) {
    let trakt = [], jw = [];
    try { trakt = await getShowStreaming(s.traktSlug, 'au'); } catch (e) { trakt = ['ERR']; }
    try { const r = await getStreamingAvailability(s.tmdbId, s.title, s.year); jw = r.services; } catch (e) { jw = ['ERR']; }
    const stored = s.streamingServices || [];
    console.log(`\n${s.title} (${s.year})`);
    console.log(`  stored: [${stored.join(', ')}]`);
    console.log(`  trakt:  [${trakt.join(', ')}]`);
    console.log(`  jwatch: [${jw.join(', ')}]`);
    await new Promise(r => setTimeout(r, 120));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
