// @ts-nocheck
/**
 * Premature-prediction screen. Read-only.
 *
 * Finds star predictions that were made before the evidence existed — on a
 * handful of aired episodes, pre-air, on a thin vote count, or with the
 * worksheet's stale-evidence phrases in the reason — and that have NEW evidence
 * now (more episodes aired, votes accumulated). These are the ones /recheck-predictions
 * re-derives; everything else is left alone.
 *
 * The star-prediction DATE comes from data/prediction-batches/*.json (latest batch
 * row carrying `predictedRating` for that tmdbId), NOT from `predictionsUpdatedAt`,
 * which bingeability-only writes bump (the 2026-09-16 ramp backfill moved ~180 rows).
 * When no batch mentions the show, the column is used and marked `(col)`.
 *
 * Scope (default): unrated, non-dropped, predicted >= 3★, and either first aired in
 * the last two calendar years, or still returning/in production. Sub-3★ predictions
 * are never re-thought (see CLAUDE.md); `--include-low` overrides.
 *
 * Run: npx tsx scripts/airtime-screen.ts [--tmdb a,b,c] [--all] [--include-low] [--max-eps N]
 *   --tmdb      screen only these ids (user-named shows), regardless of scope
 *   --all       screen every unrated predicted show (slow: one TMDB call per season)
 *   --max-eps   "premature" threshold: predicted on <= N aired episodes (default 4)
 *   --min-age   skip shows whose star prediction is younger than N days (default 14) —
 *               a show rechecked last week on thin votes is still thin; it is not new evidence
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';
const { db, shows } = require('../src/lib/db');

const KEY = process.env.TMDB_API_KEY;
const STALE = [/no buzz yet/i, /no IMDB\/RT/i, /unproven/i, /not yet aired/i, /new-series volatility/i, /ratings? (are|is) unusable/i, /pre-air/i, /\bone episode\b/i, /\b\d+ episodes? (have|has) aired/i, /predicted on \d+ eps?/i];
// "N votes" counts as stale evidence only when N was thin (< 500) at the time
const thinVotePhrase = (reason) => {
  for (const m of reason.matchAll(/(\d[\d,]*(?:\.\d+)?)(k?)\s+votes/gi)) {
    const n = parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1);
    if (n < 500) return m[0];
  }
  return null;
};
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function predictionDates() {
  // tmdbId -> { date, file } for the latest STAR prediction (row has predictedRating)
  const out = new Map();
  const dir = 'data/prediction-batches';
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const date = (f.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1];
    if (!date) continue;
    let rows;
    try { rows = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    rows = Array.isArray(rows) ? rows : rows.rows || rows.predictions || [];
    for (const r of rows) if (r && r.tmdbId != null && r.predictedRating != null) out.set(r.tmdbId, { date, file: f });
  }
  return out;
}

async function tmdb(p) {
  const r = await fetch(`https://api.themoviedb.org/3${p}${p.includes('?') ? '&' : '?'}api_key=${KEY}`);
  if (!r.ok) throw new Error(`TMDB ${r.status} ${p}`);
  return r.json();
}

async function main() {
  if (!KEY) { console.error('RESULT: FAIL — TMDB_API_KEY missing from .env.local'); process.exit(1); }
  const args = process.argv.slice(2);
  const only = args.includes('--tmdb') ? args[args.indexOf('--tmdb') + 1].split(',').map(Number) : null;
  const all = args.includes('--all');
  const includeLow = args.includes('--include-low');
  const maxEps = args.includes('--max-eps') ? Number(args[args.indexOf('--max-eps') + 1]) : 4;
  const minAge = args.includes('--min-age') ? Number(args[args.indexOf('--min-age') + 1]) : 14;
  const minYear = new Date().getFullYear() - 1;
  const dates = predictionDates();

  const lib = await db.select().from(shows);
  let cand = lib.filter((s) => !s.dropped && s.rating == null && s.predictedRating != null);
  if (only) cand = cand.filter((s) => only.includes(s.tmdbId));
  else {
    if (!includeLow) cand = cand.filter((s) => s.predictedRating >= 3);
    if (!all) cand = cand.filter((s) => (s.year ?? 0) >= minYear || /returning|production|planned|pilot/i.test(s.showStatus || ''));
  }
  if (only) for (const id of only) if (!cand.find((s) => s.tmdbId === id)) console.log(`WARNING: tmdb=${id} is not an unrated predicted show (rated, dropped, missing, or no prediction) — skipped`);

  console.log(`Screening ${cand.length} unrated predicted shows (scope: ${only ? 'named' : all ? 'all' : `year>=${minYear} or returning`}; premature = predicted on <=${maxEps} aired eps)\n`);
  const rows = [];
  for (const s of cand) {
    const pd = dates.get(s.tmdbId);
    const predAt = pd ? pd.date : (s.predictionsUpdatedAt || '').slice(0, 10) || null;
    const src = pd ? pd.file.replace(/\.json$/, '') : '(col: predictionsUpdatedAt — may be a bingeability bump, real date could be older)';
    const ageDays = predAt ? Math.floor((Date.now() - Date.parse(predAt)) / 86400000) : null;
    let d;
    try { d = await tmdb(`/tv/${s.tmdbId}`); } catch (e) { rows.push({ s, err: e.message }); continue; }
    const first = d.first_air_date || null;
    let airedAtPred = 0, airedNow = 0, lastAirInPredSeason = null;
    for (const se of d.seasons || []) {
      if (se.season_number === 0) continue;
      if (se.air_date && se.air_date > today) continue;
      let sd; try { sd = await tmdb(`/tv/${s.tmdbId}/season/${se.season_number}`); } catch { continue; }
      for (const ep of sd.episodes || []) {
        if (!ep.air_date) continue;
        if (ep.air_date <= today) airedNow++;
        if (predAt && ep.air_date <= predAt) airedAtPred++;
      }
    }
    const reason = s.predictedRatingReason || '';
    const phrases = STALE.filter((p) => p.test(reason)).map((p) => (reason.match(p) || [''])[0]);
    const tv = thinVotePhrase(reason); if (tv) phrases.push(tv);
    const lastAir = d.last_air_date || null;
    const recentlyAiring = lastAir && (Date.now() - Date.parse(lastAir)) / 86400000 <= 90; // votes still accumulating
    const flags = [];
    if (!first || first > today) flags.push('PRE-AIR');
    else {
      if (predAt && airedAtPred <= maxEps && airedNow > airedAtPred) flags.push(`PREMATURE(${airedAtPred}->${airedNow} eps)`);
      else if (predAt && airedNow - airedAtPred >= 3) flags.push(`NEW-EPISODES(+${airedNow - airedAtPred})`);
      if ((s.traktVoteCount ?? 0) < 500 && recentlyAiring) flags.push(`THIN-VOTES(trakt=${s.traktVoteCount ?? '-'})`);
    }
    if (phrases.length) flags.push(`STALE-PHRASE("${phrases[0]}")`);
    if (!predAt) flags.push('NO-DATE');
    const recent = !only && ageDays != null && ageDays < minAge && flags.length && !flags.some((f) => f.startsWith('PREMATURE') || f.startsWith('NEW-EPISODES'));
    if (recent) flags.splice(0, flags.length, `RECENT(${ageDays}d ago: ${flags.join(' ')})`);
    rows.push({ s, predAt, src, recent, first, lastAir, airedAtPred, airedNow, total: d.number_of_episodes, seasons: d.number_of_seasons, tmdbStatus: d.status, next: d.next_episode_to_air?.air_date || null, flags });
  }

  rows.sort((a, b) => (b.flags?.length || 0) - (a.flags?.length || 0) || (a.airedAtPred ?? 0) - (b.airedAtPred ?? 0));
  console.log('title | tmdb | pred | mode | predictedOn (source) | epsAiredThen -> now / total | tmdbStatus | nextEp | trakt votes | flags');
  for (const r of rows) {
    if (r.err) { console.log(`${r.s.title} | ${r.s.tmdbId} | ERR ${r.err}`); continue; }
    console.log(`${r.s.title} | ${r.s.tmdbId} | ${r.s.predictedRating}★ | ${r.s.recommendedWatchPreference} | ${r.predAt} ${r.src.startsWith('(col') ? '(col)' : '(' + r.src + ')'} | ${r.airedAtPred} -> ${r.airedNow} / ${r.total} | ${r.tmdbStatus} | ${r.next ?? '-'} | ${r.s.traktVoteCount ?? '-'} | ${r.flags.join(' ') || '-'}`);
  }
  const flagged = rows.filter((r) => r.flags && r.flags.length && !r.recent);
  const recentSkipped = rows.filter((r) => r.recent);
  const colDated = rows.filter((r) => r.src && r.src.startsWith('(col'));
  if (colDated.length) console.log(`\nNOTE: ${colDated.length} show(s) have no batch-file date; their "(col)" date is predictionsUpdatedAt and may be a bingeability-only bump (the real star prediction could be older).`);
  if (recentSkipped.length) console.log(`NOTE: ${recentSkipped.length} show(s) skipped — predicted <${minAge} days ago with no new episodes since: ${recentSkipped.map((r) => r.s.title).join(', ')}`);
  console.log('');
  for (const r of flagged) console.log(`REASON: ${r.s.title} (tmdb=${r.s.tmdbId}) — ${r.flags.join('; ')}`);
  const n = (k) => flagged.filter((r) => r.flags.some((f) => f.startsWith(k))).length;
  console.log(`\nRECHECK_TMDB_IDS: ${JSON.stringify(flagged.map((r) => r.s.tmdbId))}`);
  console.log(`SUMMARY: screened=${rows.length} flagged=${flagged.length} recentSkipped=${recentSkipped.length} preAir=${n('PRE-AIR')} premature=${n('PREMATURE')} newEpisodes=${n('NEW-EPISODES')} thinVotes=${n('THIN-VOTES')} stalePhrase=${n('STALE-PHRASE')} noDate=${n('NO-DATE')} errors=${rows.filter((r) => r.err).length}`);
  console.log('RESULT: OK');
}
main().catch((e) => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
