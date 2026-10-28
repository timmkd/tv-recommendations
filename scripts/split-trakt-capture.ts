// @ts-nocheck
/**
 * Split a Trakt browser-session capture into the input files the resync
 * scripts read. Pure file I/O — never touches the DB.
 *
 * Input: a capture produced by the /sync-library Step 2 browser snippet:
 *   { capturedAt, watched:[{tmdb,trakt,slug,title,plays,last}],
 *     watchlist:[{tmdb,trakt,slug,title,year,listed}],
 *     progress:[{tmdb,title,slug,aired,completed,lastEp,nextEp}], errs:[...] }
 *   The Chrome DevTools wrapper ({result:{...}} / {data:{...}}) is unwrapped.
 *
 * Output (all gitignored):
 *   .trakt-progress.json            {capturedAt, rows: progress}   <- resync-watch-status.ts
 *   .trakt-watchlist.json           {capturedAt, rows: watchlist}  <- resync-watch-status.ts
 *   .trakt-watched-<YYYY-MM-DD>.json {capturedAt, watched}
 *
 * Run: npx tsx scripts/split-trakt-capture.ts [.trakt-capture-<date>.json]
 *      (defaults to the newest .trakt-capture-*.json in the repo root)
 */
import fs from 'fs';

function unwrap(d) {
  let x = d;
  for (let i = 0; i < 3 && x && typeof x === 'object' && !x.watched; i++) x = x.result ?? x.data ?? x.value ?? x;
  return x;
}

const arg = process.argv[2];
const file = arg || fs.readdirSync('.').filter((f) => /^\.trakt-capture-.*\.json$/.test(f)).sort().pop();
if (!file || !fs.existsSync(file)) {
  console.error('RESULT: FAIL — no capture file (expected .trakt-capture-<date>.json in the repo root)');
  process.exit(1);
}
const c = unwrap(JSON.parse(fs.readFileSync(file, 'utf8')));
const problems = [];
if (!c || typeof c !== 'object') problems.push('not an object');
else {
  if (!Array.isArray(c.watched)) problems.push('missing watched[]');
  if (!Array.isArray(c.watchlist)) problems.push('missing watchlist[]');
  if (!Array.isArray(c.progress)) problems.push('missing progress[]');
  if (!c.capturedAt) problems.push('missing capturedAt');
}
if (problems.length) {
  console.error(`RESULT: FAIL — ${file} is not a capture: ${problems.join(', ')}`);
  process.exit(1);
}
const errs = Array.isArray(c.errs) ? c.errs : [];
const badProgress = c.progress.filter((r) => r.tmdb == null || typeof r.aired !== 'number' || typeof r.completed !== 'number');
if (badProgress.length) console.log(`WARNING: ${badProgress.length} progress row(s) lack tmdb/aired/completed and will be ignored by the resync`);
if (errs.length) {
  console.log(`WARNING: ${errs.length} progress fetch(es) failed in the browser — those shows have NO progress row:`);
  for (const e of errs.slice(0, 20)) console.log(`   ${e.slug}: ${e.err}`);
}
if (c.watched.length && c.progress.length + errs.length < c.watched.length) {
  console.log(`WARNING: progress rows (${c.progress.length}) + errs (${errs.length}) < watched (${c.watched.length}) — the capture may be truncated`);
}
const ageDays = Math.floor((Date.now() - Date.parse(c.capturedAt)) / 86400000);
const capLocal = new Date(Date.parse(c.capturedAt) - new Date().getTimezoneOffset() * 60000);
const day = capLocal.toISOString().slice(0, 10); // local date of the capture
fs.writeFileSync('.trakt-progress.json', JSON.stringify({ capturedAt: c.capturedAt, rows: c.progress }));
fs.writeFileSync('.trakt-watchlist.json', JSON.stringify({ capturedAt: c.capturedAt, rows: c.watchlist }));
fs.writeFileSync(`.trakt-watched-${day}.json`, JSON.stringify({ capturedAt: c.capturedAt, watched: c.watched }));
console.log(`Wrote .trakt-progress.json, .trakt-watchlist.json, .trakt-watched-${day}.json from ${file}`);
console.log(`SUMMARY: capturedAt=${c.capturedAt} ageDays=${ageDays} watched=${c.watched.length} watchlist=${c.watchlist.length} progress=${c.progress.length} errs=${errs.length}`);
console.log(`RESULT: ${errs.length === c.watched.length && c.watched.length > 0 ? 'FAIL — every progress fetch failed (session dead?)' : 'OK'}`);
if (errs.length === c.watched.length && c.watched.length > 0) process.exit(1);
