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

### Step 3 — Backfill rating sources

```
npx tsx scripts/enrich-new-show-ratings.ts
```

Read the `SUMMARY:` line. Then re-run
`npx tsx scripts/find-shows-needing-predictions.ts` — this refreshed output is
your working list (it now shows Trakt ratings for the enriched shows).

If `stillNoRatingSource>0`: for those shows only, research a rating via WebFetch
on imdb.com or wikipedia.org. If a show still has no rating source anywhere,
STOP and ask the user what to do with it (predict from judgment alone, or skip).

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

Present the full prediction table: Title | Predicted | Solo/Together | complete
reason text — then proceed straight to Step 7 WITHOUT waiting for approval.
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
