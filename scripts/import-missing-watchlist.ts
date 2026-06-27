/**
 * Import shows that are on Trakt's /sync/watchlist/shows endpoint but missing
 * from the local DB. Enriches with TMDB data + streaming availability.
 *
 * Run with: npx tsx scripts/import-missing-watchlist.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { getSettings, getDeletedTmdbIds, saveOverlay } = require('../src/lib/db/queries');
const { db, shows } = require('../src/lib/db');
const { enrichShowWithTMDB } = require('../src/lib/tmdb');
const { getShowStreaming } = require('../src/lib/trakt');

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

  // Paginate — Trakt caps list endpoints at 100 items per page; fetching only
  // page 1 silently drops newer watchlist additions.
  let wl = [];
  let page = 1;
  let pageCount = 1;
  do {
    const r = await fetch(`${TRAKT_API_URL}/sync/watchlist/shows?page=${page}&limit=100`, {
      headers,
      cache: 'no-store',
    });
    if (!r.ok) {
      console.error(`watchlist page ${page} failed: ${r.status}`);
      break;
    }
    pageCount = parseInt(r.headers.get('x-pagination-page-count') || '1', 10) || 1;
    wl = wl.concat(await r.json());
    page++;
  } while (page <= pageCount);

  const dbRows = await db.select({ tmdbId: shows.tmdbId }).from(shows);
  const dbIds = new Set(dbRows.map(r => r.tmdbId));
  const deleted = await getDeletedTmdbIds();

  const missing = wl.filter(item => {
    const tmdbId = item.show?.ids?.tmdb;
    return tmdbId && !dbIds.has(tmdbId) && !deleted.has(tmdbId);
  });
  missing.sort((a, b) => (b.listed_at || '').localeCompare(a.listed_at || ''));

  console.log(`Importing ${missing.length} shows...\n`);

  for (const item of missing) {
    const s = item.show;
    const tmdbId = s.ids.tmdb;
    const slug = s.ids.slug;
    console.log(`→ ${s.title} (${s.year})  tmdb=${tmdbId}`);

    try {
      // Insert basic row first
      await saveOverlay({
        tmdbId,
        traktSlug: slug,
        status: 'watchlist',
        title: s.title,
        year: s.year,
      });

      // Enrich with TMDB
      const tmdbData = await enrichShowWithTMDB(tmdbId);
      console.log(`   tmdb: ${tmdbData.genres?.join('/')} | ${tmdbData.numberOfSeasons}s | ${tmdbData.showStatus} | rating ${tmdbData.tmdbRating}`);

      // Streaming
      let streamingServices = [];
      try {
        streamingServices = await getShowStreaming(slug, 'au');
      } catch (err) {
        console.log(`   streaming fetch failed: ${err.message}`);
      }
      console.log(`   streaming: ${streamingServices.join(',') || '-'}`);

      await saveOverlay({
        tmdbId,
        traktSlug: slug,
        status: 'watchlist',
        title: s.title,
        year: s.year,
        posterPath: tmdbData.posterPath,
        overview: tmdbData.overview,
        genres: tmdbData.genres,
        numberOfSeasons: tmdbData.numberOfSeasons,
        showStatus: tmdbData.showStatus,
        tmdbRating: tmdbData.tmdbRating,
        tmdbVoteCount: tmdbData.tmdbVoteCount,
        streamingServices: streamingServices.length > 0 ? streamingServices : undefined,
        streamingFetchedAt: streamingServices.length > 0 ? new Date().toISOString() : undefined,
      });

      // Small delay to be nice to APIs
      await new Promise(res => setTimeout(res, 250));
    } catch (err) {
      console.error(`   FAILED: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
