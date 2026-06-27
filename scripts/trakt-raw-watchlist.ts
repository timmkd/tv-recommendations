// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { getUserShows } = require('../src/lib/trakt');
const { getSettings } = require('../src/lib/db/queries');
const { db, shows } = require('../src/lib/db');

async function main() {
  const settings = await getSettings();
  const username = settings.traktUsername;
  console.log(`Trakt user: ${username}`);

  const traktShows = await getUserShows(username);
  console.log(`Trakt returned ${traktShows.length} shows`);

  // Sort by listed_at desc, fallback lastWatchedAt
  traktShows.sort((a, b) => {
    const ax = a.listedAt || a.lastWatchedAt || '';
    const bx = b.listedAt || b.lastWatchedAt || '';
    return bx.localeCompare(ax);
  });

  console.log('\n30 most recent Trakt entries (by listed_at/lastWatchedAt):');
  for (const s of traktShows.slice(0, 30)) {
    const when = s.listedAt || s.lastWatchedAt || '?';
    console.log(`${when.slice(0,10)}  tmdb=${s.tmdbId}  ${s.status}  ${s.title} (${s.year})`);
  }

  console.log('\n"scarpetta" matches on Trakt:');
  for (const s of traktShows.filter(x => (x.title || '').toLowerCase().includes('scarpetta'))) {
    console.log(`  tmdb=${s.tmdbId}  ${s.status}  ${s.title} (${s.year})  listed_at=${s.listedAt}`);
  }

  // Cross-check DB
  const dbRows = await db.select({ tmdbId: shows.tmdbId, title: shows.title, status: shows.status, hidden: shows.hidden, dropped: shows.dropped }).from(shows);
  const dbIds = new Set(dbRows.map(r => r.tmdbId));
  const traktIds = new Set(traktShows.map(s => s.tmdbId));
  const missing = traktShows.filter(s => !dbIds.has(s.tmdbId));
  console.log(`\nTrakt: ${traktIds.size} | DB: ${dbRows.length} | Missing in DB: ${missing.length}`);
  for (const s of missing.slice(0, 30)) {
    console.log(`  MISSING tmdb=${s.tmdbId}  ${s.status}  ${s.title} (${s.year})  listed_at=${s.listedAt}`);
  }

  const scarpDb = dbRows.filter(r => (r.title || '').toLowerCase().includes('scarpetta'));
  console.log(`\n"scarpetta" in DB: ${scarpDb.length}`);
  for (const s of scarpDb) console.log(`  tmdb=${s.tmdbId} status=${s.status} hidden=${s.hidden} dropped=${s.dropped}  ${s.title}`);
}
main().catch(e => { console.error(e); process.exit(1); });
