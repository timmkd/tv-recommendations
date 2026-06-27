// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { getSettings } = require('../src/lib/db/queries');

const TRAKT_API_URL = 'https://api.trakt.tv';

async function get(url, headers) {
  const r = await fetch(url, { headers, cache: 'no-store' });
  if (!r.ok) return { status: r.status, data: null, text: await r.text() };
  return { status: r.status, data: await r.json() };
}

async function main() {
  const settings = await getSettings();
  const username = settings.traktUsername;
  const auth = settings.traktAuth || {};
  const token = auth.accessToken;
  console.log(`user=${username} authed=${!!token}`);

  const headers = {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': process.env.TRAKT_CLIENT_ID,
    'User-Agent': 'tv-recommendations/1.0',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  // Endpoints that might hold "Start Watching" shows
  const endpoints = [
    `/users/${username}/watchlist/shows`,
    `/users/${username}/recommendations/shows`,
    `/sync/watchlist/shows`,
    `/sync/recommendations/shows`,
  ];

  const targets = ['scarpetta', 'half man', "margo's", 'bennet sister', 'rooster', 'starfleet academy', 'waiting for the out', 'seven dials', 'widow', 'big mistakes'];

  for (const ep of endpoints) {
    console.log(`\n=== ${ep} ===`);
    const r = await get(`${TRAKT_API_URL}${ep}`, headers);
    console.log(`status: ${r.status}  count: ${Array.isArray(r.data) ? r.data.length : '-'}`);
    if (Array.isArray(r.data)) {
      for (const target of targets) {
        const hits = r.data.filter(x => {
          const t = (x.show?.title || x.title || '').toLowerCase();
          return t.includes(target);
        });
        if (hits.length) {
          console.log(`  MATCHES "${target}":`);
          for (const h of hits) {
            const s = h.show || h;
            console.log(`    tmdb=${s.ids?.tmdb} slug=${s.ids?.slug}  ${s.title} (${s.year})  listed_at=${h.listed_at}`);
          }
        }
      }
    } else {
      console.log(`  text: ${(r.text || '').slice(0, 200)}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
