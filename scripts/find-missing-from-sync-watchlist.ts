// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { getSettings, getDeletedTmdbIds } = require('../src/lib/db/queries');
const { db, shows } = require('../src/lib/db');

const TRAKT_API_URL = 'https://api.trakt.tv';

async function main() {
  const settings = await getSettings();
  const username = settings.traktUsername;
  const token = settings.traktAuth?.accessToken;

  const headers = {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': process.env.TRAKT_CLIENT_ID,
    'User-Agent': 'tv-recommendations/1.0',
    Authorization: `Bearer ${token}`,
  };

  // Full sync watchlist
  const r = await fetch(`${TRAKT_API_URL}/sync/watchlist/shows`, { headers, cache: 'no-store' });
  const wl = await r.json();
  console.log(`/sync/watchlist/shows: ${wl.length} shows`);

  const dbRows = await db.select({ tmdbId: shows.tmdbId, title: shows.title }).from(shows);
  const dbIds = new Set(dbRows.map(r => r.tmdbId));
  const deleted = await getDeletedTmdbIds();

  const missing = wl.filter(item => {
    const tmdbId = item.show?.ids?.tmdb;
    return tmdbId && !dbIds.has(tmdbId) && !deleted.has(tmdbId);
  });

  missing.sort((a, b) => (b.listed_at || '').localeCompare(a.listed_at || ''));

  console.log(`\nMissing from DB (${missing.length}):\n`);
  for (const item of missing) {
    const s = item.show;
    console.log(`${item.listed_at?.slice(0,10)}  tmdb=${s.ids.tmdb}  slug=${s.ids.slug}  ${s.title} (${s.year})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
