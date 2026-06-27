// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { getSettings, saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');
const { getImdbRating } = require('../src/lib/trakt');

const TRAKT_API_URL = 'https://api.trakt.tv';
const TARGETS = [240740, 114922, 257994, 158756, 290724, 273866, 245318, 259909];

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

  const r = await fetch(`${TRAKT_API_URL}/sync/watchlist/shows`, { headers, cache: 'no-store' });
  const wl = await r.json();

  for (const tmdbId of TARGETS) {
    const item = wl.find(i => i.show?.ids?.tmdb === tmdbId);
    if (!item) {
      console.log(`tmdb=${tmdbId} not found in watchlist`);
      continue;
    }
    const s = item.show;
    const imdbId = s.ids.imdb;
    console.log(`\n${s.title} (${s.year})  imdb=${imdbId}`);

    // Trakt show ratings endpoint
    const tr = await fetch(`${TRAKT_API_URL}/shows/${s.ids.slug}?extended=full`, { headers, cache: 'no-store' });
    if (tr.ok) {
      const td = await tr.json();
      console.log(`   trakt rating: ${td.rating} (${td.votes} votes)  runtime=${td.runtime}m  status=${td.status}  network=${td.network}`);
    }

    let imdb = null;
    if (imdbId) {
      imdb = await getImdbRating(imdbId);
      console.log(`   IMDB: ${imdb?.rating ?? 'n/a'} (${imdb?.votes ?? '-'} votes)`);
    }

    const existing = await getOverlayByTmdbId(tmdbId);
    await saveOverlay({
      ...existing,
      tmdbId,
      imdbId,
      ...(imdb && { imdbRating: imdb.rating, imdbVoteCount: imdb.votes }),
    });
  }
}
main().catch(e => { console.error(e); process.exit(1); });
