// @ts-nocheck
/**
 * Export a self-contained data package (CSV + Markdown) for an external LLM
 * (e.g. ChatGPT) to analyse the library, predictions, ratings and platform
 * availability. Read-only — never writes to the DB.
 *
 * Output: exports/chatgpt-package-<YYYY-MM-DD>/
 *   shows.csv              every show, every column (arrays joined with |)
 *   platform_shows.csv     one row per show x platform, with watch-state category
 *   platform_summary.csv   per-platform counts (the "report card" numbers)
 *   subscriptions.csv      streaming services + subscribed flag
 *   trakt_progress.csv     per-show aired/completed from the latest browser capture
 *   trakt_watched.csv      plays + last watched from the latest capture
 *   trakt_watchlist.csv    Trakt watchlist from the latest capture
 *   docs/                  taste profile, worksheet, rating analysis, logs
 *   prediction_batches/    every prediction batch JSON (prediction history)
 *   README.md              file list + column dictionary (generated, with live counts)
 *   ANALYST-PROMPT.md      a ready-to-paste prompt for the external LLM
 *   stats.txt              headline counts
 *
 * Run: npx tsx scripts/export-chatgpt-package.ts [--zip] [--out <dir>]
 *   --zip   also write exports/<package>.zip next to the folder
 * Prints freshness WARNINGs (old Trakt capture / streaming data) and a SUMMARY line.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';
const { db, shows, streamingServices } = require('../src/lib/db');

const { execSync } = require('child_process');
const args = process.argv.slice(2);
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); // local date
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join('exports', `chatgpt-package-${today}`);
const ZIP = args.includes('--zip');

// In-progress shows that are abandoned/stalled in practice (see taste profile:
// quiet abandonment, late-run fizzle, rewatch-in-progress). Flagged, not removed.
// Maintained in data/stalled-shows.json (the /sync-library skill warns when one gets new plays).
const STALLED = new Set(fs.existsSync('data/stalled-shows.json') ? JSON.parse(fs.readFileSync('data/stalled-shows.json', 'utf8')).titles : []);
const warnings = [];

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) v = v.join('|');
  if (typeof v === 'boolean') v = v ? 'true' : 'false';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const writeCsv = (file, rows, cols) => {
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','));
  fs.writeFileSync(path.join(OUT, file), lines.join('\n') + '\n');
  console.log(`  ${file}: ${rows.length} rows`);
};
const latest = (prefix) => {
  const f = fs.readdirSync('.').filter((x) => x.startsWith(prefix) && x.endsWith('.json')).sort().pop();
  return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};

async function main() {
  fs.mkdirSync(path.join(OUT, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'prediction_batches'), { recursive: true });

  const all = await db.select().from(shows);
  const services = await db.select().from(streamingServices);
  const subscribed = new Set(services.filter((s) => s.isSubscribed).map((s) => s.slug));

  // Trakt capture (latest)
  const capture = latest('.trakt-capture-');
  const progress = new Map((capture?.progress || []).map((r) => [r.tmdb, r]));
  const days = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null);
  if (!capture) warnings.push('no .trakt-capture-*.json found — watchCategory/progress columns will be empty; run /sync-library first');
  else if (days(capture.capturedAt) > 7) warnings.push(`Trakt capture is ${days(capture.capturedAt)} days old (${capture.capturedAt.slice(0, 10)}) — consider /sync-library first`);
  const newestStreaming = all.map((s) => s.streamingFetchedAt).filter(Boolean).sort().pop();
  if (!newestStreaming || days(newestStreaming) > 14) warnings.push(`streaming availability last refreshed ${newestStreaming ? days(newestStreaming) + ' days ago' : 'never'} — consider /sync-library first`);

  // ---- shows.csv -----------------------------------------------------------
  const showCols = ['id', 'tmdbId', 'traktSlug', 'imdbId', 'title', 'year', 'status', 'watchCategory',
    'dropped', 'hidden', 'bookmarked', 'genres', 'numberOfSeasons', 'showStatus', 'origin', 'format',
    'contentFlags', 'watchPreference', 'watchPreferenceNote', 'rating', 'bingeability', 'ratedAt',
    'reviewNote', 'notes', 'predictedRating', 'recommendedWatchPreference', 'predictedBingeability',
    'predictionsUpdatedAt', 'predictionDelta', 'predictedRatingReason', 'predictedBingeabilityReason',
    'imdbRating', 'imdbVoteCount', 'traktRating', 'traktVoteCount', 'tmdbRating', 'tmdbVoteCount',
    'rtCriticsScore', 'rtAudienceScore', 'streamingServices', 'onSubscribedService', 'streamingFetchedAt',
    'justWatchUrl', 'traktAired', 'traktCompleted', 'traktLastEpisode', 'traktNextEpisode',
    'overview', 'createdAt', 'updatedAt'];

  const categorise = (s) => {
    if (s.dropped) return 'dropped';
    if (s.status === 'completed') return 'completed';
    const p = progress.get(s.tmdbId);
    if (s.status === 'watching') {
      if (STALLED.has(s.title)) return 'stalled';
      if (p && p.lastEp && p.nextEp && +p.nextEp.split('x')[0] > +p.lastEp.split('x')[0]) return 'new-season-waiting';
      if (p && p.aired > 0 && p.completed >= p.aired) return 'caught-up';
      return 'mid-season';
    }
    return 'not-started';
  };

  const showRows = all.map((s) => {
    const p = progress.get(s.tmdbId);
    return {
      ...s,
      watchCategory: categorise(s),
      predictionDelta: s.rating != null && s.predictedRating != null ? +(s.rating - s.predictedRating).toFixed(1) : null,
      onSubscribedService: (s.streamingServices || []).some((x) => subscribed.has(x)),
      traktAired: p?.aired ?? null, traktCompleted: p?.completed ?? null,
      traktLastEpisode: p?.lastEp ?? null, traktNextEpisode: p?.nextEp ?? null,
    };
  }).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  writeCsv('shows.csv', showRows, showCols);

  // ---- platform_shows.csv --------------------------------------------------
  const platRows = [];
  for (const s of showRows) {
    for (const sv of s.streamingServices || []) {
      const quality = s.rating ?? s.predictedRating ?? null;
      platRows.push({
        platform: sv, platformAlias: sv === 'foxtel-now' ? 'alias-of-max (JustWatch legacy HBO mapping)' : '',
        subscribed: subscribed.has(sv), tmdbId: s.tmdbId, title: s.title, year: s.year,
        watchCategory: s.watchCategory, watchMode: s.watchPreference || s.recommendedWatchPreference || '',
        rating: s.rating, predictedRating: s.predictedRating, qualityScore: quality,
        worthIt4plus: s.watchCategory !== 'completed' && s.watchCategory !== 'dropped' && s.watchCategory !== 'stalled' && quality != null && quality >= 4,
        exclusiveToPlatform: (s.streamingServices || []).filter((x) => x !== 'foxtel-now').length === 1,
        numberOfSeasons: s.numberOfSeasons, showStatus: s.showStatus, genres: s.genres,
        traktCompleted: s.traktCompleted, traktAired: s.traktAired, traktNextEpisode: s.traktNextEpisode,
      });
    }
  }
  writeCsv('platform_shows.csv', platRows, ['platform', 'platformAlias', 'subscribed', 'tmdbId', 'title', 'year',
    'watchCategory', 'watchMode', 'rating', 'predictedRating', 'qualityScore', 'worthIt4plus', 'exclusiveToPlatform',
    'numberOfSeasons', 'showStatus', 'genres', 'traktCompleted', 'traktAired', 'traktNextEpisode']);

  // ---- platform_summary.csv -----------------------------------------------
  const plats = [...new Set(platRows.map((r) => r.platform))];
  const summary = plats.map((pl) => {
    const rows = platRows.filter((r) => r.platform === pl);
    const live = rows.filter((r) => !['completed', 'dropped'].includes(r.watchCategory));
    const worth = live.filter((r) => r.worthIt4plus);
    const n = (f) => live.filter(f).length;
    return {
      platform: pl, subscribed: subscribed.has(pl), aliasOfMax: pl === 'foxtel-now',
      totalInLibrary: rows.length, completed: rows.filter((r) => r.watchCategory === 'completed').length,
      dropped: rows.filter((r) => r.watchCategory === 'dropped').length,
      unfinished: live.length,
      newSeasonWaiting: n((r) => r.watchCategory === 'new-season-waiting'),
      midSeason: n((r) => r.watchCategory === 'mid-season'),
      stalled: n((r) => r.watchCategory === 'stalled'),
      notStarted: n((r) => r.watchCategory === 'not-started'),
      worthIt4plus: worth.length,
      worthIt45plus: worth.filter((r) => r.qualityScore >= 4.5).length,
      worthIt4only: worth.filter((r) => r.qualityScore >= 4 && r.qualityScore < 4.5).length,
      tier35: live.filter((r) => r.watchCategory !== 'stalled' && r.qualityScore != null && r.qualityScore >= 3.5 && r.qualityScore < 4).length,
      worthItExclusive: worth.filter((r) => r.exclusiveToPlatform).length,
      worthItLive: worth.filter((r) => ['new-season-waiting', 'mid-season', 'caught-up'].includes(r.watchCategory)).length,
      worthItSolo: worth.filter((r) => r.watchMode === 'solo').length,
      worthItTogether: worth.filter((r) => r.watchMode === 'together').length,
      worthItSingleSeason: worth.filter((r) => (r.numberOfSeasons || 1) <= 1).length,
      worthItSeasonsTotal: worth.reduce((a, r) => a + (r.numberOfSeasons || 1), 0),
      weightedScore: worth.reduce((a, r) => a + (r.qualityScore >= 4.5 ? 3 : 2), 0) + live.filter((r) => r.watchCategory !== 'stalled' && r.qualityScore >= 3.5 && r.qualityScore < 4).length,
    };
  }).sort((a, b) => b.weightedScore - a.weightedScore);
  writeCsv('platform_summary.csv', summary, Object.keys(summary[0]));

  // ---- subscriptions.csv --------------------------------------------------
  writeCsv('subscriptions.csv', services.map((s) => ({ slug: s.slug, name: s.name, subscribed: !!s.isSubscribed })), ['slug', 'name', 'subscribed']);

  // ---- trakt captures -----------------------------------------------------
  if (capture) {
    writeCsv('trakt_progress.csv', capture.progress, ['tmdb', 'title', 'slug', 'aired', 'completed', 'lastEp', 'nextEp']);
    writeCsv('trakt_watched.csv', capture.watched, ['tmdb', 'trakt', 'slug', 'title', 'plays', 'last']);
    writeCsv('trakt_watchlist.csv', capture.watchlist, ['tmdb', 'trakt', 'slug', 'title', 'year', 'listed']);
    fs.writeFileSync(path.join(OUT, 'trakt_capture_meta.txt'), `capturedAt: ${capture.capturedAt}\nwatched: ${capture.watched.length}\nwatchlist: ${capture.watchlist.length}\nprogress rows: ${capture.progress.length}\n`);
  }

  // ---- docs + batches -----------------------------------------------------
  for (const f of ['taste-profile.md', 'prediction-worksheet.md', 'rating-analysis.md', 'prediction-updates.md',
    'profile-changelog.md', 'prediction-review-report.md']) {
    if (fs.existsSync(path.join('docs', f))) fs.copyFileSync(path.join('docs', f), path.join(OUT, 'docs', f));
  }
  fs.copyFileSync('CLAUDE.md', path.join(OUT, 'docs', 'repo-guide-CLAUDE.md'));
  for (const f of fs.readdirSync('data/prediction-batches')) fs.copyFileSync(path.join('data/prediction-batches', f), path.join(OUT, 'prediction_batches', f));

  // ---- quick stats for README --------------------------------------------
  const rated = all.filter((s) => s.rating != null);
  const both = rated.filter((s) => s.predictedRating != null && !s.dropped);
  const mae = both.length ? (both.reduce((a, s) => a + Math.abs(s.rating - s.predictedRating), 0) / both.length).toFixed(2) : 'n/a';
  fs.writeFileSync(path.join(OUT, 'stats.txt'), [
    `exportedAt: ${new Date().toISOString()}`,
    `shows: ${all.length}`, `rated: ${rated.length}`, `dropped: ${all.filter((s) => s.dropped).length}`,
    `with prediction: ${all.filter((s) => s.predictedRating != null).length}`,
    `rated AND predicted (non-dropped): ${both.length}  MAE=${mae}`,
    `by watchCategory: ${JSON.stringify(showRows.reduce((m, s) => (m[s.watchCategory] = (m[s.watchCategory] || 0) + 1, m), {}))}`,
    `subscribed: ${[...subscribed].join(', ')}`,
  ].join('\n') + '\n');

  // ---- README.md (generated) ----------------------------------------------
  const subsNames = services.filter((x) => x.isSubscribed).map((x) => x.name).join(', ') || 'none';
  const cats = showRows.reduce((m, s) => (m[s.watchCategory] = (m[s.watchCategory] || 0) + 1, m), {});
  const readme = `# TV library data package — exported ${today}

Everything an analyst (human or LLM) needs to report on this TV library: what has
been watched and rated, what is predicted, where each show streams in Australia,
and the taste profile the predictions are derived from. All ratings are by one
viewer ("Tim"); "together" means watched with his partner Helen.

Start with \`ANALYST-PROMPT.md\` (the brief) and \`docs/taste-profile.md\` (the rules).

## Files

| File | What it is |
|---|---|
| \`shows.csv\` | **The master table.** One row per show (${all.length}), every column. Includes completed and dropped shows. |
| \`platform_shows.csv\` | One row per show × streaming platform (${platRows.length}). Use for per-platform analysis. |
| \`platform_summary.csv\` | Per-platform counts: unfinished, worth-it, exclusive, solo/together, weighted score. |
| \`subscriptions.csv\` | Streaming services and which are currently subscribed (${subsNames}). |
| \`trakt_progress.csv\` | Per-show episodes aired vs completed from Trakt (watched shows only, ${capture ? capture.progress.length : 0} rows). |
| \`trakt_watched.csv\` | Trakt play counts and last-watched timestamps. |
| \`trakt_watchlist.csv\` | Trakt watchlist (${capture ? capture.watchlist.length : 0}). |
| \`trakt_capture_meta.txt\` | When the Trakt capture was taken. |
| \`stats.txt\` | Headline counts and prediction MAE. |
| \`report-card-*.md\` | (if present) A platform report card already produced from this data — a worked example, not ground truth. |
| \`docs/taste-profile.md\` | **Read this first.** The viewer's taste profile, prediction formula, modifiers, solo/together rules, bingeability axis, validated lessons. |
| \`docs/prediction-worksheet.md\` | The exact per-show procedure used to produce predictions. |
| \`docs/rating-analysis.md\` | Correlation analysis of ratings vs external sources. |
| \`docs/prediction-updates.md\` | Chronological log of every prediction change with reasons (long). |
| \`docs/profile-changelog.md\` | Review state and pending rescan queue. |
| \`docs/prediction-review-report.md\` | Historical review report. |
| \`docs/repo-guide-CLAUDE.md\` | The repo's working guide: data formats, rating system, operating rules. |
| \`prediction_batches/*.json\` | Every batch of predictions ever applied, in order — the prediction history. |

## Column dictionary — shows.csv

- \`tmdbId\`, \`traktSlug\`, \`imdbId\` — external ids. \`title\`, \`year\`, \`genres\` (pipe-separated; includes Trakt-only tags like Horror/Thriller/Superhero), \`numberOfSeasons\`, \`showStatus\` (TMDB: Ended / Returning Series / Canceled / In Production), \`overview\`.
- \`status\` — library status: \`watchlist\` (not started), \`watching\`, \`completed\`. Synced from Trakt progress.
- \`watchCategory\` — derived: \`not-started\`, \`mid-season\`, \`new-season-waiting\` (caught up on a season, next season available), \`caught-up\`, \`stalled\` (in progress but abandoned in practice — see taste profile "quiet abandonment" / "late-run fizzle"; list in the repo's data/stalled-shows.json), \`completed\`, \`dropped\`. Counts: ${JSON.stringify(cats)}.
- \`dropped\` — decided against; hidden in the app but kept for taste analysis. \`hidden\`, \`bookmarked\` — app flags.
- \`origin\`, \`format\`, \`contentFlags\` — optional classification fields (sparse).
- **User fields (ground truth):** \`watchPreference\` (solo/together — who actually watched it), \`watchPreferenceNote\`, \`rating\` (0.5–5 stars, half steps), \`bingeability\` (1–5 integer: how easily watched, NOT how good), \`ratedAt\`, \`reviewNote\` (free text — the richest signal), \`notes\`.
- **Prediction fields:** \`predictedRating\`, \`predictedRatingReason\` (400–600 chars, names comps with ratings), \`recommendedWatchPreference\`, \`predictedBingeability\`, \`predictedBingeabilityReason\` (ends with a "ramp clause" saying when the show picks up), \`predictionsUpdatedAt\`. **Caveat:** \`predictionsUpdatedAt\` was bumped on ~180 rows by a 2026-09-16 bingeability-only backfill; date a star prediction from \`prediction_batches/\` or \`docs/prediction-updates.md\` instead.
- \`predictionDelta\` — \`rating − predictedRating\` where both exist (positive = under-predicted).
- **External ratings:** \`imdbRating\`/\`imdbVoteCount\` (all null — IMDb is unreachable from this setup), \`traktRating\`/\`traktVoteCount\` (the working base rating), \`tmdbRating\`/\`tmdbVoteCount\`, \`rtCriticsScore\`/\`rtAudienceScore\` (RT scraper broken since Sep 2026; missing = unknown, not low).
- **Streaming (Australia, via JustWatch):** \`streamingServices\` (pipe-separated slugs), \`onSubscribedService\`, \`streamingFetchedAt\`, \`justWatchUrl\`. **\`foxtel-now\` is a legacy alias for HBO titles that are actually on Max** — treat it as Max, do not count it as a separate platform.
- **Trakt progress:** \`traktAired\`, \`traktCompleted\`, \`traktLastEpisode\`, \`traktNextEpisode\` (SxE) — only for shows with watch history.

## Column dictionary — platform_shows.csv / platform_summary.csv

- \`qualityScore\` = \`rating\` if rated, else \`predictedRating\`. \`worthIt4plus\` = unfinished, not stalled, score ≥ 4.
- \`exclusiveToPlatform\` = available on exactly one platform (ignoring foxtel-now).
- \`weightedScore\` (summary) = 3 per 4.5★+ show, 2 per 4★ show, 1 per 3.5★ show, unfinished only.

## How the ratings should be read

- Scale compression: most rated shows sit at 3.5★ or 4★. A 4★ is "good solid show"; 4.5★ is a strong signal; 5★ is rare.
- Solo vs together is about **drop risk**, not ceiling: together shows that survive rate as high as solo ones, but most drops are together (Helen-fit failures). See the taste profile.
- Predictions are formula + judgment; the profile's own audit finds the formula barely beats "always guess 4★" on point accuracy (MAE ≈ 0.5). Treat predicted ratings as a ranking signal, not a measurement.
- Shows with \`predictedRating < 3\` are deliberately never revisited.

## Suggested questions for an analyst

- Which platform has the most high-quality unfinished content per dollar, split by solo vs together?
- Which in-progress shows are at highest risk of being abandoned (see bingeability, ramp clauses, review notes of similar shows)?
- Where do predictions systematically miss (by genre, origin, watch mode, season count)? Use \`predictionDelta\` and \`reviewNote\`.
- Which watchlist shows share the profile of past 4.5★+ hits, and which share the profile of past drops?
- Is the current subscription set (${subsNames}) the right one for the next 3 months of viewing?
`;
  fs.writeFileSync(path.join(OUT, 'README.md'), readme);

  const prompt = `# Analyst brief (paste this to the LLM along with the package)

You are analysing one viewer's TV library (${all.length} shows, ${rated.length} rated by the viewer, ${all.filter((s) => s.predictedRating != null).length} with a predicted rating) exported on ${today}. Australia; the viewer is Tim, "together" means watched with his partner Helen.

Read in this order: README.md (what each column means), docs/taste-profile.md (how the viewer rates and the prediction rules), then the CSVs. Treat every number in the CSVs as the source of truth and every markdown report in the package (report-card-*.md, if present) as one earlier analyst's opinion, not ground truth.

Hard facts to respect:
- Current paid subscriptions: ${subsNames}. \`foxtel-now\` rows are really Max — never count Foxtel Now as a separate platform.
- \`rating\` is the viewer's real score; \`predictedRating\` is a model guess with MAE ≈ 0.5★. Where both exist, \`predictionDelta\` shows the miss.
- Missing Rotten Tomatoes / IMDb values mean "unknown", never "low". \`traktRating\` is the working external score.
- \`watchCategory = stalled\` shows are in progress on paper but abandoned in practice; do not recommend resuming them unless the viewer asks.
- Shows predicted below 3★ are deliberately never revisited.

Deliver (in this order):
1. A platform report card: for each platform, how much 4★+ content is unfinished, how much is exclusive, how much is live (mid-season / new season waiting) vs cold starts, the solo/together split, and a letter grade with one paragraph of reasoning. Then a subscription recommendation: keep / drop / start next, with the shows that earn each decision.
2. A watch-next list of 10 shows across the subscribed platforms, split solo vs together, each with one line on why now.
3. Prediction diagnostics: where the predictions miss systematically (by genre, origin, watch mode, season count, year), using \`predictionDelta\` and quoting \`reviewNote\` where it explains a miss.
4. Anything in the data that contradicts the taste profile's stated rules, with the rows that show it.

Be concrete: name shows and cite the column values you used. Where you disagree with the earlier report card, say so and show the numbers.
`;
  fs.writeFileSync(path.join(OUT, 'ANALYST-PROMPT.md'), prompt);

  // ---- zip ------------------------------------------------------------------
  let zipPath = null;
  if (ZIP) {
    zipPath = OUT.replace(/\/$/, '') + '.zip';
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    execSync(`cd "${path.dirname(OUT)}" && zip -qr "${path.basename(zipPath)}" "${path.basename(OUT)}" -x "*.DS_Store"`);
    console.log(`  zip: ${zipPath} (${fs.statSync(zipPath).size} bytes)`);
  }

  for (const w of warnings) console.log(`WARNING: ${w}`);
  console.log(`SUMMARY: out=${OUT} shows=${all.length} rated=${rated.length} predicted=${all.filter((s) => s.predictedRating != null).length} platformRows=${platRows.length} platforms=${summary.length} capture=${capture ? capture.capturedAt.slice(0, 10) : 'none'} streamingNewest=${newestStreaming ? newestStreaming.slice(0, 10) : 'none'} warnings=${warnings.length} zip=${zipPath ?? 'no'}`);
  console.log(`RESULT: OK -> ${OUT}`);
}
main().catch((e) => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
