/**
 * List ratings added since the last ratings review, prediction misses in that
 * window, and completed-but-unrated shows.
 *
 * Used by the /review-ratings skill. The `SUMMARY:` footer line is machine-read.
 *
 * Run with: npx tsx scripts/latest-ratings.ts [--since <ISO date>]
 *   --since defaults to the "Last ratings review" marker in docs/profile-changelog.md
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';

// Import after env is loaded
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { db, shows } = require('../src/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isNotNull, isNull, desc, and, sql } = require('drizzle-orm');

const CHANGELOG_PATH = 'docs/profile-changelog.md';

function resolveSince(): { since: string | null; source: string } {
  const argIdx = process.argv.indexOf('--since');
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    return { since: process.argv[argIdx + 1], source: '--since arg' };
  }
  if (fs.existsSync(CHANGELOG_PATH)) {
    const text = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    const m = text.match(/^\*\*Last ratings review:\*\* (.+)$/m);
    if (m) return { since: m[1].trim(), source: CHANGELOG_PATH };
  }
  return { since: null, source: 'none' };
}

async function main() {
  const { since, source } = resolveSince();
  if (!since) {
    console.log(
      `WARNING: no --since arg and no "Last ratings review" marker in ${CHANGELOG_PATH}; falling back to the 25 most recent ratings.`
    );
  }

  // 1. Ratings in the window (or last 25 as fallback)
  const base = db
    .select({
      tmdbId: shows.tmdbId,
      title: shows.title,
      year: shows.year,
      rating: shows.rating,
      predictedRating: shows.predictedRating,
      recommendedWatchPreference: shows.recommendedWatchPreference,
      ratedAt: shows.ratedAt,
      watchPreference: shows.watchPreference,
      watchPreferenceNote: shows.watchPreferenceNote,
      reviewNote: shows.reviewNote,
      dropped: shows.dropped,
      status: shows.status,
    })
    .from(shows);

  // ratedAt is always set via new Date().toISOString(), so string comparison is safe
  const recent = since
    ? await base
        .where(and(isNotNull(shows.ratedAt), sql`${shows.ratedAt} > ${since}`))
        .orderBy(desc(shows.ratedAt))
    : await base.where(isNotNull(shows.ratedAt)).orderBy(desc(shows.ratedAt)).limit(25);

  console.log(`\n=== NEW RATINGS since ${since ?? '(last 25 mode)'} — ${recent.length} ===\n`);
  for (const s of recent) {
    const diff =
      s.predictedRating != null && s.rating != null
        ? (s.rating - s.predictedRating).toFixed(1)
        : 'n/a';
    const prefFlip =
      s.recommendedWatchPreference && s.watchPreference && s.recommendedWatchPreference !== s.watchPreference
        ? ` [PREF FLIP: predicted ${s.recommendedWatchPreference}, actual ${s.watchPreference}]`
        : '';
    console.log(
      `${s.ratedAt?.slice(0, 10) ?? '????-??-??'}  ${s.rating}★ (pred ${s.predictedRating ?? '-'}★, Δ${diff})  ${s.dropped ? '[DROPPED] ' : ''}${s.watchPreference ?? '-'}${prefFlip}  ${s.title} (${s.year ?? '?'})  tmdb=${s.tmdbId}`
    );
    if (s.reviewNote) console.log(`   note: ${s.reviewNote.slice(0, 300)}`);
    if (s.watchPreferenceNote) console.log(`   pref note: ${s.watchPreferenceNote.slice(0, 300)}`);
  }

  // 2. Big misses within the window (|actual - predicted| >= 1.0)
  const bigMisses = recent.filter(
    (s) =>
      s.rating != null &&
      s.predictedRating != null &&
      Math.abs(s.rating - s.predictedRating) >= 1.0
  );
  console.log(`\n=== BIG MISSES in window (|Δ| >= 1.0★) — ${bigMisses.length} ===\n`);
  for (const s of bigMisses) {
    const delta = (s.rating - s.predictedRating).toFixed(1);
    console.log(
      `pred ${s.predictedRating}★ → got ${s.rating}★ (Δ${delta})  ${s.dropped ? '[DROPPED] ' : ''}${s.watchPreference ?? '-'}  ${s.title}`
    );
  }

  // 3. Completed but unrated (candidates to prompt the user to rate)
  const unrated = await db
    .select({
      tmdbId: shows.tmdbId,
      title: shows.title,
      year: shows.year,
      createdAt: shows.createdAt,
      numberOfSeasons: shows.numberOfSeasons,
    })
    .from(shows)
    .where(
      and(
        sql`${shows.status} = 'completed'`,
        isNull(shows.rating),
        sql`(${shows.dropped} IS NULL OR ${shows.dropped} = 0)`,
        sql`(${shows.hidden} IS NULL OR ${shows.hidden} = 0)`
      )
    )
    .orderBy(desc(shows.createdAt));

  console.log(`\n=== COMPLETED BUT UNRATED — ${unrated.length} ===\n`);
  for (const s of unrated) {
    console.log(
      `tmdb=${s.tmdbId}  ${s.title} (${s.year ?? '?'})  seasons=${s.numberOfSeasons ?? '?'}  added=${s.createdAt?.slice(0, 10) ?? '?'}`
    );
  }

  console.log(
    `\nSUMMARY: newRatings=${recent.length} bigMisses=${bigMisses.length} completedUnrated=${unrated.length} since=${since ?? 'null'} sinceSource=${source.replace(/\s/g, '-')}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
