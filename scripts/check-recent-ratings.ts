/**
 * Check shows recently rated to see if taste profile needs updating.
 * Also list shows missing predictions.
 *
 * Run with: npx tsx scripts/check-recent-ratings.ts
 */
// @ts-nocheck

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Import after env is loaded
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { db, shows } = require('../src/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isNotNull, isNull, desc, and, sql } = require('drizzle-orm');

async function main() {
  // 1. Recently rated shows (newest 25)
  const recent = await db
    .select({
      title: shows.title,
      year: shows.year,
      rating: shows.rating,
      predictedRating: shows.predictedRating,
      ratedAt: shows.ratedAt,
      watchPreference: shows.watchPreference,
      reviewNote: shows.reviewNote,
      dropped: shows.dropped,
      status: shows.status,
    })
    .from(shows)
    .where(isNotNull(shows.ratedAt))
    .orderBy(desc(shows.ratedAt))
    .limit(25);

  console.log('\n=== 25 MOST RECENTLY RATED ===\n');
  for (const s of recent) {
    const diff =
      s.predictedRating != null && s.rating != null
        ? (s.rating - s.predictedRating).toFixed(1)
        : 'n/a';
    console.log(
      `${s.ratedAt?.slice(0, 10) ?? '????-??-??'}  ${s.rating}★ (pred ${s.predictedRating ?? '-'}★, Δ${diff})  ${s.dropped ? '[DROPPED] ' : ''}${s.watchPreference ?? '-'}  ${s.title} (${s.year ?? '?'})`
    );
    if (s.reviewNote) {
      console.log(`   note: ${s.reviewNote.slice(0, 200)}`);
    }
  }

  // 2. Predictions where |actual - predicted| >= 1.0 (potential learning signals)
  const miss = await db
    .select({
      title: shows.title,
      year: shows.year,
      rating: shows.rating,
      predictedRating: shows.predictedRating,
      ratedAt: shows.ratedAt,
      watchPreference: shows.watchPreference,
      reviewNote: shows.reviewNote,
      dropped: shows.dropped,
    })
    .from(shows)
    .where(
      and(
        isNotNull(shows.rating),
        isNotNull(shows.predictedRating),
        isNotNull(shows.ratedAt)
      )
    )
    .orderBy(desc(shows.ratedAt));

  const bigMisses = miss
    .filter((s) => Math.abs((s.rating ?? 0) - (s.predictedRating ?? 0)) >= 1.0)
    .slice(0, 20);

  console.log('\n=== PREDICTION MISSES (|Δ| >= 1.0★) – top 20 most recent ===\n');
  for (const s of bigMisses) {
    const delta = ((s.rating ?? 0) - (s.predictedRating ?? 0)).toFixed(1);
    console.log(
      `${s.ratedAt?.slice(0, 10)}  pred ${s.predictedRating}★ → got ${s.rating}★ (Δ${delta})  ${s.dropped ? '[DROPPED] ' : ''}${s.watchPreference ?? '-'}  ${s.title}`
    );
    if (s.reviewNote) console.log(`   ${s.reviewNote.slice(0, 220)}`);
  }

  // 3. Shows missing predictions (in library, not dropped, no prediction set)
  const noPred = await db
    .select({
      tmdbId: shows.tmdbId,
      title: shows.title,
      year: shows.year,
      status: shows.status,
      watchPreference: shows.watchPreference,
      imdbRating: shows.imdbRating,
      traktRating: shows.traktRating,
      tmdbRating: shows.tmdbRating,
      rtCriticsScore: shows.rtCriticsScore,
      rtAudienceScore: shows.rtAudienceScore,
      genres: shows.genres,
      numberOfSeasons: shows.numberOfSeasons,
      showStatus: shows.showStatus,
      overview: shows.overview,
      origin: shows.origin,
      format: shows.format,
      streamingServices: shows.streamingServices,
    })
    .from(shows)
    .where(
      and(isNull(shows.predictedRating), sql`(${shows.dropped} IS NULL OR ${shows.dropped} = 0)`)
    );

  console.log(`\n=== SHOWS WITHOUT PREDICTION (${noPred.length}) ===\n`);
  for (const s of noPred) {
    console.log(
      `tmdb=${s.tmdbId}  ${s.status ?? '?'}  IMDB ${s.imdbRating ?? '-'} | Trakt ${s.traktRating ?? '-'} | RT ${s.rtCriticsScore ?? '-'}/${s.rtAudienceScore ?? '-'}  ${s.title} (${s.year ?? '?'})`
    );
  }

  // 4. Aggregate counts
  const totalRated = (await db.select().from(shows).where(isNotNull(shows.rating))).length;
  console.log(`\nTotal rated in DB: ${totalRated}`);
  console.log(`Profile doc claims: 198 rated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
