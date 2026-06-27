// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { isNotNull, and, eq, sql } = require('drizzle-orm');

async function main() {
  // All solo-rated shows
  const rows = await db.select({
    title: shows.title,
    year: shows.year,
    rating: shows.rating,
    watchPreference: shows.watchPreference,
    genres: shows.genres,
    reviewNote: shows.reviewNote,
    dropped: shows.dropped,
    numberOfSeasons: shows.numberOfSeasons,
  }).from(shows).where(and(isNotNull(shows.rating), eq(shows.watchPreference, 'solo')));

  console.log(`Total solo-rated: ${rows.length}\n`);

  // Heuristics for "slow burn / cerebral / dark":
  // - Drama-only or Drama + Mystery without Comedy/Adventure
  // - Or review note mentioning slow/cerebral/intense/contemplative
  const candidates = rows.filter(r => {
    const g = (r.genres || []).map(x => x.toLowerCase());
    const note = (r.reviewNote || '').toLowerCase();
    const dramaOnly = g.includes('drama') && !g.includes('comedy') && !g.includes('action & adventure');
    const cerebralKeywords = /slow|cerebral|intense|psycholog|contemplat|burn|atmospheric|brood|prestige/.test(note);
    return dramaOnly || cerebralKeywords;
  });

  console.log('Slow-burn / cerebral / dark solo candidates:\n');
  candidates.sort((a,b) => (b.rating||0) - (a.rating||0));
  for (const r of candidates) {
    const g = (r.genres || []).slice(0, 3).join('/');
    const note = r.reviewNote ? ` — ${r.reviewNote.slice(0, 120)}` : '';
    console.log(`  ${r.rating}★${r.dropped ? ' [DROP]' : ''}  ${r.title} (${r.year})  [${g}]${note}`);
  }

  console.log('\n\nAll dark/intense/prison/serial-killer-adjacent solo titles (broad title sweep):');
  const broadHits = rows.filter(r => /black bird|mindhunter|chernobyl|pachinko|fleabag|dopesick|unbelievable|andor|severance|adolescence|small light|bad sisters|boy swallows|baby reindeer|blackbird|deadloch|broadchurch/i.test(r.title || ''));
  for (const r of broadHits) {
    console.log(`  ${r.rating}★${r.dropped ? ' [DROP]' : ''}  ${r.title} (${r.year})  pref=${r.watchPreference}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
