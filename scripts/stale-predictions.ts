/**
 * Dump unrated shows whose predictions predate the latest taste-profile change,
 * along with the pending profile changes they should be screened against.
 *
 * Used by the /rescan-predictions skill. The `SUMMARY:` footer line is machine-read.
 *
 * Run with: npx tsx scripts/stale-predictions.ts [--since <ISO date>]
 *   --since defaults to the newest unchecked `- [ ]` entry date in
 *   docs/profile-changelog.md (inclusive on purpose: a prediction updated between
 *   change 1 and change 2 is still stale w.r.t. change 2).
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';

// Import after env is loaded
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { db, shows } = require('../src/lib/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isNotNull, isNull, desc, and, sql, or } = require('drizzle-orm');

const CHANGELOG_PATH = 'docs/profile-changelog.md';

// Predictions below 3★ are excluded from rescans by default — see the where clause.
const includeLow = process.argv.includes('--include-low');

function getPendingEntries(): string[] {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error(`ERROR: ${CHANGELOG_PATH} not found. Run from the repo root.`);
    process.exit(1);
  }
  const text = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  return text.split('\n').filter((line) => /^- \[ \] /.test(line));
}

function resolveSince(pending: string[]): string | null {
  const argIdx = process.argv.indexOf('--since');
  if (argIdx !== -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1];
  // Entry format: "- [ ] YYYY-MM-DD | TYPE | what changed | affects: ..."
  const dates = pending
    .map((line) => line.match(/^- \[ \] (\d{4}-\d{2}-\d{2})/)?.[1])
    .filter(Boolean)
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

async function main() {
  const pending = getPendingEntries();
  const since = resolveSince(pending);

  if (pending.length === 0 && !since) {
    console.log('No pending profile changes and no --since given. Nothing to rescan.');
    console.log('SUMMARY: pendingChanges=0 staleCount=0 since=null');
    return;
  }

  console.log(`\n=== PENDING PROFILE CHANGES — ${pending.length} ===\n`);
  for (const line of pending) console.log(line);

  // Stale = unrated, has a prediction, not dropped/hidden, prediction older than `since`
  // (predictionsUpdatedAt IS NULL = legacy prediction with no timestamp = stale)
  const stale = await db
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
      predictedRating: shows.predictedRating,
      predictedRatingReason: shows.predictedRatingReason,
      recommendedWatchPreference: shows.recommendedWatchPreference,
      predictionsUpdatedAt: shows.predictionsUpdatedAt,
    })
    .from(shows)
    .where(
      and(
        isNull(shows.rating),
        isNotNull(shows.predictedRating),
        sql`(${shows.dropped} IS NULL OR ${shows.dropped} = 0)`,
        sql`(${shows.hidden} IS NULL OR ${shows.hidden} = 0)`,
        // Sub-3★ predictions are not worth re-deriving (rule added 2026-09-14).
        // Below 3★ the Completion Risk table puts drop risk at 65% (2.5★) to 100%
        // (2★) — the call is already "not worth watching", and no profile tweak
        // flips that into a recommendation. Pass --include-low to override.
        ...(includeLow ? [] : [sql`${shows.predictedRating} >= 3`]),
        or(
          isNull(shows.predictionsUpdatedAt),
          sql`${shows.predictionsUpdatedAt} < ${since}`
        )
      )
    )
    .orderBy(desc(shows.predictedRating));

  console.log(`\n=== STALE PREDICTIONS (predictionsUpdatedAt < ${since}) — ${stale.length} ===\n`);
  for (const s of stale) {
    const genres = (s.genres || []).join('/') || '-';
    console.log(
      `tmdb=${s.tmdbId}  ${s.title} (${s.year ?? '?'})  status=${s.status ?? '?'}  predicted=${s.predictedRating}★ pref=${s.recommendedWatchPreference ?? '?'}  predictionsUpdatedAt=${s.predictionsUpdatedAt ?? 'null'}`
    );
    console.log(
      `   genres=${genres}  seasons=${s.numberOfSeasons ?? '?'}  showStatus=${s.showStatus ?? '?'}  origin=${s.origin ?? '?'}  format=${s.format ?? '?'}`
    );
    console.log(
      `   IMDB ${s.imdbRating ?? '-'} | Trakt ${s.traktRating ?? '-'} | TMDB ${s.tmdbRating ?? '-'} | RT ${s.rtCriticsScore ?? '-'}/${s.rtAudienceScore ?? '-'}`
    );
    console.log(`   REASON: ${s.predictedRatingReason ?? '(none)'}`);
    if (s.overview) console.log(`   overview: ${s.overview.slice(0, 240)}`);
    console.log('');
  }

  console.log(
    `SUMMARY: pendingChanges=${pending.length} staleCount=${stale.length} since=${since ?? 'null'} lowExcluded=${includeLow ? 'off' : 'on'}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
