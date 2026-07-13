/**
 * Backfill rating sources for newly imported shows.
 *
 * The Trakt sync saves TMDB metadata + streaming but NO imdbRating/traktRating
 * (IMDB needs OMDB_API_KEY, which may be unset). Predictions need a base rating,
 * so this fetches the Trakt community rating + imdbId for any show that has
 * neither imdbRating nor traktRating, and IMDB via OMDB when the key exists.
 *
 * Used by the /predict-new-shows skill. The `SUMMARY:` footer line is machine-read.
 *
 * Run with: npx tsx scripts/enrich-new-show-ratings.ts [--tmdb <id>,<id>,...]
 *   --tmdb  enrich only these tmdbIds (default: all unrated shows missing both sources)
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Import after env is loaded
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { db, shows } = require('../src/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getImdbRating } = require('../src/lib/trakt');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isNull, and, sql, inArray } = require('drizzle-orm');

const TRAKT_API_URL = 'https://api.trakt.tv';

function parseTmdbArg(): number[] | null {
  const idx = process.argv.indexOf('--tmdb');
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1]
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));
}

async function main() {
  const explicit = parseTmdbArg();

  const conditions = [
    sql`(${shows.dropped} IS NULL OR ${shows.dropped} = 0)`,
    sql`(${shows.hidden} IS NULL OR ${shows.hidden} = 0)`,
  ];
  if (explicit) {
    conditions.push(inArray(shows.tmdbId, explicit));
  } else {
    conditions.push(isNull(shows.rating));
    conditions.push(and(isNull(shows.imdbRating), isNull(shows.traktRating)));
  }

  const targets = await db
    .select({ tmdbId: shows.tmdbId, title: shows.title, traktSlug: shows.traktSlug })
    .from(shows)
    .where(and(...conditions));

  console.log(`\n=== ENRICHING ${targets.length} show(s) ===\n`);

  const headers = {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': process.env.TRAKT_CLIENT_ID,
    'User-Agent': 'tv-recommendations/1.0',
  };

  let enriched = 0;
  let skipped = 0;

  for (const t of targets) {
    if (!t.traktSlug) {
      console.log(`SKIP tmdb=${t.tmdbId} ${t.title}: no traktSlug`);
      skipped++;
      continue;
    }

    const res = await fetch(`${TRAKT_API_URL}/shows/${t.traktSlug}?extended=full`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) {
      console.log(`SKIP tmdb=${t.tmdbId} ${t.title}: Trakt API ${res.status}`);
      skipped++;
      continue;
    }
    const data = await res.json();
    const imdbId = data.ids?.imdb ?? null;

    let imdb = null;
    if (imdbId && process.env.OMDB_API_KEY) {
      imdb = await getImdbRating(imdbId);
    }

    const existing = await getOverlayByTmdbId(t.tmdbId);
    if (!existing) {
      console.log(`SKIP tmdb=${t.tmdbId} ${t.title}: overlay vanished`);
      skipped++;
      continue;
    }
    await saveOverlay({
      ...existing,
      tmdbId: t.tmdbId,
      ...(data.rating != null && { traktRating: data.rating, traktVoteCount: data.votes ?? null }),
      ...(imdbId && { imdbId }),
      ...(imdb && { imdbRating: imdb.rating, imdbVoteCount: imdb.votes }),
    });
    console.log(
      `OK   tmdb=${t.tmdbId} ${t.title}: trakt=${data.rating?.toFixed?.(2) ?? '-'} (${data.votes ?? '-'} votes)  imdbId=${imdbId ?? '-'}  imdb=${imdb?.rating ?? '-'}`
    );
    enriched++;
    await new Promise((r) => setTimeout(r, 300));
  }

  // Shows that STILL have no usable base rating source at all
  const noSource = await db
    .select({ tmdbId: shows.tmdbId, title: shows.title })
    .from(shows)
    .where(
      and(
        isNull(shows.rating),
        isNull(shows.predictedRating),
        sql`(${shows.dropped} IS NULL OR ${shows.dropped} = 0)`,
        sql`(${shows.hidden} IS NULL OR ${shows.hidden} = 0)`,
        isNull(shows.imdbRating),
        isNull(shows.traktRating),
        isNull(shows.tmdbRating)
      )
    );
  if (noSource.length) {
    console.log('\nShows with NO rating source (need manual research):');
    for (const s of noSource) console.log(`  tmdb=${s.tmdbId}  ${s.title}`);
  }

  console.log(`\nSUMMARY: enriched=${enriched} skipped=${skipped} stillNoRatingSource=${noSource.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
