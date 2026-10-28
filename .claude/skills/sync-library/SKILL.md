---
name: sync-library
description: Resync the TV library from live sources - streaming availability (JustWatch), watch status and episode progress from the user's Trakt account via a logged-in browser session, import shows that exist on Trakt but not locally, and hand new shows to /predict-new-shows. Use when the user asks for a resync, an update, a refresh of streaming platforms or watch counts, or before a report/export.
---

# Sync Library

Bring the local DB up to date with what the user has actually watched and where
things stream. Four sources, in order: JustWatch (streaming), the Trakt browser
session (watched / watchlist / progress), TMDB (metadata for imports), and the
prediction skill for anything new.

## Hard rules

- Run every command from the repo root.
- NEVER write or change `rating`, `ratedAt`, `reviewNote`, `watchPreference` or
  `bingeability` — the user's fields. `status` is the only user-facing column this
  skill writes, and only via `scripts/resync-watch-status.ts`.
- Predictions are written ONLY by `/predict-new-shows` (which uses
  `apply-predictions.ts`). Never predict inline here.
- The Trakt API is permanently dead (403 on everything). The ONLY Trakt read path
  is the logged-in `app.trakt.tv` tab via Chrome DevTools. `check-new-trakt-shows.ts`
  and the dev-server `syncFromTrakt` route cannot work — do not run them.
- A tombstoned show (`[TOMBSTONED]` in the diff) was deleted on purpose. Never
  re-import it without asking.
- Subscriptions are user preference data: report the table, never change it
  unless the user states the new list in this conversation.
- If any step's `RESULT:` line is `FAIL`, STOP and show the user the exact output.

## Preflight

1. `test -f .env.local` — if missing, STOP.
2. `git status --short docs/ data/` — note pre-existing dirt.
3. `TODAY=$(date +%F)` — every capture file below is named with the local date.

## Steps

### Step 1 — Streaming availability (JustWatch, ~2 minutes)

```
npx tsx scripts/resync-streaming.ts 2>&1 | tail -3
grep '^CHANGED' .streaming-resync-log.txt
```

Read `DONE. processed=N changed=N (filled empty=N, went empty=N)`. List every
`CHANGED` line in the summary. Two things to know when reading them:
- `foxtel-now` is JustWatch's legacy label for HBO titles that are really on
  **Max**. Binge has had no HBO since April 2025. Never report Foxtel Now as a
  platform of its own.
- `went empty` means JustWatch found nothing in AU today; that is "unknown",
  not "unavailable".

### Step 2 — Trakt browser capture (STOP gate)

Find a logged-in `app.trakt.tv` tab with `mcp__chrome-devtools__list_pages`
(select it with `select_page`). If there is no such tab, no Chrome DevTools
tooling, or the snippet below reports a missing `oidc.user:` key, **STOP** and
tell the user: "I need you to open app.trakt.tv in Chrome and log in so I can
read your watch history." WAIT. Do not substitute any other Trakt path.

Run this with `mcp__chrome-devtools__evaluate_script`. Pass `filePath` as the
**absolute path inside the repo**: `<repo root>/.trakt-capture-$TODAY.json`.
(The scratchpad is refused — "not within workspace roots". The file is gitignored.)

```js
async () => {
  const k = Object.keys(localStorage).find(x => x.startsWith('oidc.user:'));
  if (!k) return { error: 'no oidc.user key — not logged in' };
  const clientId = k.split('oidc.user:https://auth.trakt.tv:')[1];
  const token = JSON.parse(localStorage[k]).access_token;
  const H = { 'Authorization': 'Bearer ' + token, 'trakt-api-key': clientId, 'trakt-api-version': '2' };
  const get = async (p) => { const r = await fetch('https://apiz.trakt.tv' + p, { headers: H }); if (!r.ok) throw new Error(p + ' ' + r.status); return { body: await r.json(), pages: +(r.headers.get('x-pagination-page-count') || 1) }; };
  const w = await get('/users/me/watched/shows');
  const watched = w.body.map(x => ({ tmdb: x.show.ids.tmdb, trakt: x.show.ids.trakt, slug: x.show.ids.slug, title: x.show.title, plays: x.plays, last: x.last_watched_at }));
  let watchlist = []; const p1 = await get('/users/me/watchlist/show?page=1&limit=100');
  watchlist = p1.body; for (let p = 2; p <= p1.pages; p++) watchlist = watchlist.concat((await get('/users/me/watchlist/show?page=' + p + '&limit=100')).body);
  watchlist = watchlist.map(x => ({ tmdb: x.show.ids.tmdb, trakt: x.show.ids.trakt, slug: x.show.ids.slug, title: x.show.title, year: x.show.year, listed: x.listed_at }));
  const progress = []; const errs = [];
  for (const s of watched) {
    try { const r = await get('/shows/' + s.slug + '/progress/watched?hidden=false&specials=false'); progress.push({ tmdb: s.tmdb, title: s.title, slug: s.slug, aired: r.body.aired, completed: r.body.completed, lastEp: r.body.last_episode ? (r.body.last_episode.season + 'x' + r.body.last_episode.number) : null, nextEp: r.body.next_episode ? (r.body.next_episode.season + 'x' + r.body.next_episode.number) : null }); }
    catch (e) { errs.push({ slug: s.slug, err: String(e) }); }
  }
  return { capturedAt: new Date().toISOString(), watched, watchlist, progress, errs };
}
```

Then split it into the files the resync scripts read:

```
npx tsx scripts/split-trakt-capture.ts
```

Branch on its lines: `RESULT: FAIL` (not a capture / every progress fetch failed →
session dead, ask the user to log in again) → STOP. Any `WARNING:` about missing
progress rows → carry those titles into the summary; their status will be left alone.

### Step 3 — Diff against the local library

```
npx tsx scripts/trakt-capture-diff.ts
```

Read the `SUMMARY:` line and the `IMPORT_TMDB_IDS:` array.
- `importable>0` → do Step 4 for exactly those ids.
- `tombstoned>0` → list them in the summary as "on Trakt, deleted locally on
  purpose — not re-imported". Do not import.
- `stalledActive>0` → the show is on `data/stalled-shows.json` but has new plays.
  Remove it from that file (it is a resume candidate again) and say so.
- Keep the "Watched since" list — it is the human-readable change log for Step 7.

### Step 4 — Import missing shows (only when `importable>0`)

For each id in `IMPORT_TMDB_IDS`, with `--status watching` if it came from the
"Watched on Trakt" list, else `--status watchlist`:

```
npx tsx scripts/add-show-by-tmdb.ts <tmdbId> --status <watching|watchlist>
```

Then fetch their Trakt metadata in the SAME browser tab (set `IDS` to the array)
and save with `filePath` = `<repo root>/.trakt-lookup-$TODAY.json`:

```js
async () => {
  const IDS = [/* paste IMPORT_TMDB_IDS */];
  const k = Object.keys(localStorage).find(x => x.startsWith('oidc.user:'));
  const clientId = k.split('oidc.user:https://auth.trakt.tv:')[1];
  const token = JSON.parse(localStorage[k]).access_token;
  const H = { 'Authorization': 'Bearer ' + token, 'trakt-api-key': clientId, 'trakt-api-version': '2' };
  const out = {}; let errs = 0;
  for (const id of IDS) {
    try {
      const r = await fetch('https://apiz.trakt.tv/search/tmdb/' + id + '?type=show&extended=full', { headers: H });
      if (!r.ok) { out[id] = { err: r.status }; errs++; continue; }
      const b = await r.json(); const s = b[0]?.show; if (!s) { out[id] = { err: 'nomatch' }; errs++; continue; }
      out[id] = { slug: s.ids.slug, trakt: s.ids.trakt, imdb: s.ids.imdb, title: s.title, year: s.year, rating: s.rating, votes: s.votes, genres: s.genres, cert: s.certification, status: s.status, aired: s.aired_episodes, runtime: s.runtime, network: s.network, first: s.first_aired, country: s.country, overview: (s.overview||'').slice(0,300) };
    } catch (e) { out[id] = { err: String(e) }; errs++; }
  }
  return { count: IDS.length, errs, data: out };
}
```

Then, in this order (each must print `RESULT: OK`):

```
npx tsx scripts/lookup-to-captures.ts            # -> .trakt-genres-$TODAY.json + .trakt-newshows.json
npx tsx scripts/backfill-trakt-meta.ts            # slug / Trakt rating / votes / imdbId
npx tsx scripts/merge-trakt-genres.ts --tmdb <ids> # Horror/Thriller/Superhero tags TMDB cannot express
npx tsx scripts/backfill-show-data.ts --tmdb <ids> # streaming + justWatchUrl for the new rows
```

### Step 5 — Watch status (dry-run, read the table, then write)

```
npx tsx scripts/resync-watch-status.ts --dry-run
```

Read the move table before writing. Sanity rules — STOP and show the table if any
is violated:
- A `→ completed` move must show `[completed>=aired]` evidence. The script's
  default is least-assuming (no evidence → left alone); if you see dozens of
  `watchlist → completed`, that is the 93-show bug and something is wrong with
  the capture.
- More than ~25 moves in total is unusual for a month; re-read Step 2's counts.

Then apply:

```
npx tsx scripts/resync-watch-status.ts
```

Confirm `RESULT: OK (N statuses written)`.

### Step 6 — Predict anything new (delegate)

```
npx tsx scripts/find-shows-needing-predictions.ts
```

If it lists more than 0 shows: invoke the Skill tool with `predict-new-shows` and
let it run its full flow. Do NOT predict inline. Its genre merge (Step 3b) will
find the capture you wrote in Step 4 and report `CHECK OK`.

### Step 7 — Subscriptions (report only)

```
npx tsx scripts/set-subscriptions.ts --list
```

Print the `SUMMARY:` line. If the user has said in this conversation that the
list changed, set it with the FULL new list via `set-subscriptions.ts <slugs>` and
update the "Current Subscriptions" paragraph of `CLAUDE.md` to match. Otherwise
leave it and say "tell me if this is out of date".

### Step 8 — Log

Append to the END of `docs/prediction-updates.md`:

```
## YYYY-MM-DD — Library sync (/sync-library)

**Streaming** (`resync-streaming.ts`, JustWatch): <processed> shows, <changed>
changed — <the CHANGED lines that matter, e.g. "Line of Fire netflix→max">.
**Watch status** (`resync-watch-status.ts` from the YYYY-MM-DD browser capture,
<watched> watched / <watchlist> watchlist / <progress> progress rows): <N> moves —
<title → status, ...>.
**Imported from Trakt:** <titles, or "none">. **Tombstoned, not re-imported:** <titles or none>.
**Stalled list:** <removed X / unchanged>.
**Predicted:** <handled by /predict-new-shows — n shows, or "nothing new">.
```

### Step 9 — Summary

```
Streaming: <processed> checked, <changed> changed (<notable>)
Trakt capture: <date> — <watched>/<watchlist>/<progress> rows, <errs> errors
Watch status: <n> moves (<title → status>, ...)
Imported: <n> (<titles>) | Tombstoned skipped: <n>
Stalled list: <change or none>
New predictions: <n> via /predict-new-shows, or none
Subscriptions: <slugs> (unchanged / updated)
Files changed: <output of git diff --stat>
```

Offer to commit the changed files (docs + batch JSON + data/stalled-shows.json).
Capture files (`.trakt-*.json`, `.streaming-resync-log.txt`) are gitignored — keep
them; `/export-chatgpt-package` and `/recheck-predictions` read the newest capture.

## Failure modes

| Symptom | Action |
|---|---|
| No logged-in app.trakt.tv tab | STOP, ask the user to open it and log in; nothing else can read Trakt |
| Capture snippet returns `{error}` or `errs == watched.length` | Session expired — STOP, ask the user to log in again |
| `split-trakt-capture.ts` → `RESULT: FAIL` | The saved file is not a capture (wrong tab? wrapper?) — show the first 300 bytes, STOP |
| `resync-watch-status.ts --dry-run` shows mass `→ completed` | Do NOT apply; show the table, STOP |
| `add-show-by-tmdb.ts` → FAIL | Movie id or bad id — report, skip that show, continue |
| `lookup-to-captures.ts` reports `failed>0` | Those shows get TMDB genres only; say so in the summary and in the /predict-new-shows hand-off |
| `/predict-new-shows` invocation fails | Report it; never improvise predictions inline |
