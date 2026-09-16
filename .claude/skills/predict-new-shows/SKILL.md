---
name: predict-new-shows
description: Predict ratings for recently added TV shows that don't have a prediction yet. Use when the user asks to predict new shows, generate predictions for new watchlist items, or predict unpredicted/latest-added shows.
---

# Predict New Shows

Produce predictions (rating + solo/together + reason) for every show in the DB
that has no prediction and no user rating, then write them via the validated
apply script and log them.

## Hard rules

- Run every command from the repo root.
- Predictions are written to the DB ONLY via `npx tsx scripts/apply-predictions.ts`.
  Never raw SQL, never `node -e`, never a new one-off script, never editing the DB
  any other way.
- NEVER write or change `rating`, `ratedAt`, `reviewNote`, or `watchPreference` on
  any show — those are the user's fields.
- This skill does NOT edit `docs/taste-profile.md` and does NOT run the full
  Trakt sync — EXCEPT the Step 1 escape hatch (user explicitly asked for a
  not-yet-imported show). If the profile looks wrong, say so and suggest
  `/review-ratings`.
- NEVER predict a show whose Trakt genres have not been merged (Step 3b). A
  missing `Horror`/`Sci-Fi & Fantasy`/`Superhero` tag flips the solo/together
  call, and TMDB cannot supply those tags at all.
- Commit to ONE final predicted rating per show — never a range, never options.
- If any validation/fix loop fails 3 times, STOP and show the user the exact error.

## Preflight

1. `test -f .env.local` — if missing, STOP: "need .env.local with Turso credentials".
2. You are in the repo root (`package.json` exists).

## Steps

### Step 1 — Check for unsynced Trakt shows (read-only, no server needed)

```
npx tsx scripts/check-new-trakt-shows.ts
```

If it reports shows on Trakt that are NOT in the local DB:

- If the user's request explicitly names one of the missing shows, import it:
  follow the dev-server sync lifecycle in review-ratings Step 6 EXACTLY
  (reuse or start the server → trigger sync → converge → enrichment wait →
  stop only a server you started), then continue with Step 2.
- Otherwise tell the user "N shows are on Trakt but not yet imported — run
  /review-ratings to sync them first, or continue with what's in the DB?"
  and WAIT for their answer.

### Step 2 — Build the working list

```
npx tsx scripts/find-shows-needing-predictions.ts
```

If it prints `0 shows without predictions`, report "nothing to predict" and stop.

### Step 3 — Backfill EVERYTHING missing (not just ratings)

A show must never be predicted against a half-populated row, and an imported show
must never be left without streaming availability. Run BOTH:

```
npx tsx scripts/enrich-new-show-ratings.ts
npx tsx scripts/backfill-show-data.ts
```

The second fills, for the shows being predicted, any field that is currently
empty — TMDB metadata on stub rows, `streamingServices` + `justWatchUrl`, and RT
scores. It never overwrites a field that already has a value.

Read its `SUMMARY:` line and act on each counter:
- `needTrakt>0` — Trakt slug/rating/imdbId cannot be fetched while the app
  registration is gone (403 on every call). Capture them from a logged-in browser
  session (see the Trakt section of CLAUDE.md) and write them with
  `npx tsx scripts/backfill-trakt-meta.ts`. Do this BEFORE predicting when the
  show has no other rating source — it supplies the Step 1 base.
- `needImdb>0` — `imdbRating` needs `OMDB_API_KEY`; note it and move on.
- `rtScraperBroken=true` — every `rt=not-found` in that run means UNKNOWN, not
  absent. Do NOT reason from a missing RT score as if it were a low one.

Then re-run `npx tsx scripts/find-shows-needing-predictions.ts` — this refreshed
output is your working list.

If `stillNoRatingSource>0`: for those shows only, research a rating via WebFetch
on imdb.com or wikipedia.org. If a show still has no rating source anywhere,
STOP and ask the user what to do with it (predict from judgment alone, or skip).

### Step 3b — Merge Trakt genres (do NOT skip — this decides watch mode)

TMDB's TV genre set cannot express **Horror, Thriller, Romance, Superhero,
History or Musical**. A show can therefore sit in the DB as `Drama/Mystery/Comedy`
while actually being a horror show. That is not cosmetic: `Horror`,
`Sci-Fi & Fantasy` and `Superhero` are Helen's canonical dislikes, so a missing
tag silently flips the solo/together call. Widow's Bay was predicted
**3.5★ together** on exactly this gap and was wrong for three months — it is
**4.5★ solo**.

Genres were backfilled library-wide on 2026-09-16, so this step only has to cover
the shows added since. Use the tmdbIds from your Step 3 working list.

1. Check whether the local captures already cover them:

```
npx tsx scripts/merge-trakt-genres.ts --check --tmdb <comma-separated tmdbIds>
```

2. Branch on the `RESULT:` line — do not interpret anything else:

- `CHECK OK` → apply and continue:
  ```
  npx tsx scripts/merge-trakt-genres.ts --tmdb <same ids>
  ```
  Then go to Step 4.
- `CHECK INCOMPLETE` → the capture is missing some shows. It prints a JSON array
  of the Trakt slugs that need fetching. Do step 3 below, then re-run step 1.

Also read the `noSlug=` counter. A show with `noSlug>0` has no `traktSlug`, so its
genres cannot be looked up at all — note it, say so in Step 6, and predict it from
TMDB genres only. Do NOT invent a slug.

3. Browser capture. Trakt's API is permanently gone (see CLAUDE.md); a logged-in
   browser session is the only read path.

   - Find a logged-in `app.trakt.tv` tab via the Chrome DevTools tools. If there
     is no such tab, no Chrome DevTools tooling available, or `localStorage` has
     no `oidc.user:` key, **STOP** and tell the user: "I need you to open
     app.trakt.tv in Chrome and log in so I can read genres for N new shows —
     without it their watch mode may be wrong." WAIT for them.
   - Run this against that tab, with `SLUGS` set to the array the check printed,
     saving the output to a NEW file named `.trakt-genres-<today>.json` (the
     script reads every `.trakt-genres*.json`, so never overwrite an existing one):

   ```js
   async () => {
     const SLUGS = [/* paste the array from the check output */];
     const k = Object.keys(localStorage).find(x => x.startsWith('oidc.user:'));
     const clientId = k.split('oidc.user:https://auth.trakt.tv:')[1];
     const token = JSON.parse(localStorage[k]).access_token;
     const H = { 'Authorization': 'Bearer ' + token, 'trakt-api-key': clientId, 'trakt-api-version': '2' };
     const out = {}; let errs = 0;
     for (const s of SLUGS) {
       try {
         const r = await fetch('https://apiz.trakt.tv/shows/' + s + '?extended=full', { headers: H });
         if (!r.ok) { out[s] = { err: r.status }; errs++; continue; }
         const b = await r.json();
         out[s] = { tmdb: b.ids?.tmdb, genres: b.genres || [], cert: b.certification || null };
       } catch (e) { out[s] = { err: String(e) }; errs++; }
     }
     return { count: Object.keys(out).length, errs, data: out };
   }
   ```

   - If `errs` equals `count` (every slug failed), the session is dead: **STOP**
     and ask the user to log in again. Do not proceed on zero genre data.

The merge is **additive only** — it never removes or renames an existing genre —
and deliberately does not bump `updatedAt`, so it will not bury real prediction
changes in the app's "Recently Updated" sort.

### Step 4 — Predict each show

1. Read `docs/taste-profile.md` IN FULL. Do not skip this even if you think you
   know it.
2. Read `docs/prediction-worksheet.md` and follow it EXACTLY for each show in the
   working list, writing the worksheet out per show (base source → base →
   modifier walk → sum/round/clamp → solo/together rule citation → reason).
3. Save all rows to `data/prediction-batches/YYYY-MM-DD-new-shows.json`
   (today's date; if the file already exists from an earlier run today, use
   `-new-shows-2.json`).

### Step 5 — Validate

```
npx tsx scripts/apply-predictions.ts data/prediction-batches/<file>.json --dry-run
```

- If `RESULT: FAILED`: fix EVERY error in the numbered list by editing the JSON,
  then re-run. Max 3 fix cycles, then STOP and show the user the remaining errors.
- Investigate every `WARNING:` line (Max/Stan/Binge words) — if it's a platform
  reference, rewrite that reason; if it's a false positive (a name, "bingeable"),
  say so and continue.
- Proceed only on `RESULT: DRY-RUN OK`.

### Step 6 — Present (no approval gate)

Present the full prediction table: Title | Predicted | Solo/Together | Binge |
complete reason text — then proceed straight to Step 7 WITHOUT waiting for
approval. EVERY show you predict gets a bingeability score and reason in the same
pass (worksheet Step 6) — never leave it for a separate manual run.
Predictions are the predictor's call (user directive 2026-07-17: "ratings are
your choice, you are the predictor"). If the user challenges a prediction after
it's applied, debate it on the evidence — do not fold automatically, and do not
offer them rating options; revise to a single new number only if the debate
convinces you, then re-run the `--dry-run` and re-apply via Step 7.

### Step 7 — Apply and log

```
npx tsx scripts/apply-predictions.ts data/prediction-batches/<file>.json
```

Confirm `RESULT: OK`. The script prints a ready-made markdown table — append to
`docs/prediction-updates.md` (at the end of the file):

```
## YYYY-MM-DD — New show predictions (/predict-new-shows)

<the table the script printed>
```

### Step 8 — Summary

Report using this template:

```
Predicted: <n> shows (list: Title predicted-X★ S/T, ...)
Skipped: <n> (with reasons)
Files changed: <output of git diff --stat>
```

Then offer to commit the changed files (batch JSON + prediction-updates.md).
EXCEPTION: when this skill was invoked from /review-ratings, return the summary
and do NOT offer to commit — /review-ratings owns the close-out.

## Failure modes

| Symptom | Action |
|---|---|
| No rating source for a show anywhere | STOP, ask the user (never invent a base) |
| Trakt API errors during enrichment | The script skips those shows; report them per show and continue |
| `RESULT: FAILED` on final apply | Never hand-write to the DB; show the errors and STOP |
| Validation loop exceeds 3 cycles | STOP with the exact remaining errors |
| Step 3b `CHECK INCOMPLETE` and no logged-in Trakt tab | STOP and ask the user to log in to app.trakt.tv — do NOT predict on incomplete genres, that is the Widow's Bay failure |
| Step 3b capture snippet returns `errs == count` | Session is dead; STOP and ask the user to log in again |
| Step 3b reports `noSlug>0` | That show has no Trakt slug; predict from TMDB genres only, and say so in Step 6 |
