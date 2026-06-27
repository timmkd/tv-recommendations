/**
 * Find shows that don't yet have a prediction (and aren't dropped/hidden/rated).
 * These are the "new" shows that need predictions added.
 *
 * Run with: npx tsx scripts/find-shows-needing-predictions.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { db, shows } = require('../src/lib/db');
const { isNull, and, sql, desc } = require('drizzle-orm');

async function main() {
  // Shows without a predictedRating, not dropped, not hidden, not already rated
  const rows = await db
    .select({
      tmdbId: shows.tmdbId,
      title: shows.title,
      year: shows.year,
      status: shows.status,
      genres: shows.genres,
      numberOfSeasons: shows.numberOfSeasons,
      showStatus: shows.showStatus,
      overview: shows.overview,
      origin: shows.origin,
      format: shows.format,
      imdbRating: shows.imdbRating,
      traktRating: shows.traktRating,
      tmdbRating: shows.tmdbRating,
      rtCriticsScore: shows.rtCriticsScore,
      rtAudienceScore: shows.rtAudienceScore,
      streamingServices: shows.streamingServices,
      createdAt: shows.createdAt,
    })
    .from(shows)
    .where(
      and(
        isNull(shows.predictedRating),
        isNull(shows.rating),
        sql`(${shows.dropped} IS NULL OR ${shows.dropped} = 0)`,
        sql`(${shows.hidden} IS NULL OR ${shows.hidden} = 0)`
      )
    )
    .orderBy(desc(shows.createdAt));

  console.log(`\n=== ${rows.length} shows without predictions ===\n`);
  for (const s of rows) {
    const created = s.createdAt?.slice(0, 10) ?? '????-??-??';
    const genres = (s.genres || []).slice(0, 3).join('/');
    const streaming = (s.streamingServices || []).join(',') || '-';
    console.log(
      `added=${created}  tmdb=${s.tmdbId}  ${s.status ?? '?'}  ${s.title} (${s.year ?? '?'})`
    );
    console.log(
      `   genres=${genres}  seasons=${s.numberOfSeasons ?? '?'}  showStatus=${s.showStatus ?? '?'}  origin=${s.origin ?? '?'}  format=${s.format ?? '?'}`
    );
    console.log(
      `   IMDB ${s.imdbRating ?? '-'} | Trakt ${s.traktRating ?? '-'} | TMDB ${s.tmdbRating ?? '-'} | RT ${s.rtCriticsScore ?? '-'}/${s.rtAudienceScore ?? '-'}  streaming=${streaming}`
    );
    if (s.overview) {
      console.log(`   overview: ${s.overview.slice(0, 240)}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
