// @ts-nocheck
/**
 * Resync each show's `status` (watchlist | watching | completed) from Trakt
 * progress data captured to JSON.
 *
 * Inputs (produced from an authenticated browser session when the API
 * credential is dead — see .trakt-*.json):
 *   .trakt-progress.json   {rows:[{tmdb,title,aired,completed}]}
 *   .trakt-watchlist.json  {rows:[{tmdb,title}]}
 *
 * Status rule — deliberately the LEAST-ASSUMING form from CLAUDE.md. A missing
 * or zero progress row must never imply "completed"; that inverted default once
 * flipped 93 watchlist shows to completed.
 *
 *   completed  <- completed >= aired AND aired > 0   (positive evidence only)
 *   watching   <- completed > 0
 *   watchlist  <- on the Trakt watchlist with no progress
 *   (otherwise the existing status is LEFT ALONE — absence of data is not evidence)
 *
 * Only `status` is written. Never rating/ratedAt/reviewNote/watchPreference/
 * bingeability/predictions.
 *
 * Run: npx tsx scripts/resync-watch-status.ts [--dry-run]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

function load(p) {
  if (!fs.existsSync(p)) { console.error(`RESULT: FAIL — missing ${p}`); process.exit(1); }
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (d.error) { console.error(`RESULT: FAIL — ${p} holds an error: ${d.error}`); process.exit(1); }
  return d.rows || [];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const progress = load('.trakt-progress.json');
  const watchlist = load('.trakt-watchlist.json');

  const prog = new Map();
  for (const r of progress) if (r.tmdb != null) prog.set(r.tmdb, r);
  const wl = new Set(watchlist.filter(r => r.tmdb != null).map(r => r.tmdb));

  const local = await db.select({ tmdbId: shows.tmdbId, title: shows.title, status: shows.status, dropped: shows.dropped }).from(shows);

  const changes = [], unchanged = [], untouched = [];
  for (const s of local) {
    const p = prog.get(s.tmdbId);
    let next;
    if (p && p.aired > 0 && p.completed >= p.aired) next = 'completed';
    else if (p && p.completed > 0) next = 'watching';
    else if (wl.has(s.tmdbId)) next = 'watchlist';
    else { untouched.push(s); continue; }   // no evidence -> leave as-is

    if (s.status === next) unchanged.push(s);
    else changes.push({ ...s, next, ev: p ? `${p.completed}/${p.aired}` : 'on watchlist, no progress' });
  }

  const byMove = {};
  for (const c of changes) { const k = `${c.status ?? 'null'} -> ${c.next}`; (byMove[k] ||= []).push(c); }

  console.log(`Local shows: ${local.length} | Trakt progress rows: ${prog.size} | Trakt watchlist: ${wl.size}`);
  console.log(`\nAlready correct: ${unchanged.length} | No evidence, left alone: ${untouched.length} | To change: ${changes.length}`);
  for (const [move, list] of Object.entries(byMove).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n--- ${move}  (${list.length})`);
    for (const c of list.slice(0, 25)) console.log(`    ${c.title}  [${c.ev}]${c.dropped ? '  (dropped)' : ''}`);
    if (list.length > 25) console.log(`    ...and ${list.length - 25} more`);
  }

  if (dryRun) { console.log(`\nRESULT: DRY-RUN OK (${changes.length} would change, 0 written)`); return; }

  const now = new Date().toISOString();
  for (const c of changes) await db.update(shows).set({ status: c.next, updatedAt: now }).where(eq(shows.tmdbId, c.tmdbId));
  console.log(`\nRESULT: OK (${changes.length} statuses written)`);
}
main().catch(e => { console.error(`RESULT: FAIL — ${e.message}`); process.exit(1); });
