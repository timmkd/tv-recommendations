---
name: review-ratings
description: Review recently rated TV shows, update the taste profile from prediction accuracy, sync and predict new Trakt shows, and surface completed-but-unrated shows. Use when the user asks to review ratings, update the taste profile, check for new shows, or do a ratings review.
---

# Review Ratings & Update Taste Profile

Read the ratings added since the last review, learn from prediction accuracy,
update `docs/taste-profile.md` (with approval), sync new shows from Trakt, and
hand new shows to `/predict-new-shows` for prediction.

## Hard rules

- Run every command from the repo root.
- Predictions are written to the DB ONLY via `npx tsx scripts/apply-predictions.ts`
  (which `/predict-new-shows` runs). Never raw SQL, never `node -e`, never a new
  one-off script.
- NEVER write or change `rating`, `ratedAt`, `reviewNote`, or `watchPreference` on
  any show — those are the user's fields. If shows need rating, ASK the user to
  rate them in the app or on Trakt.
- NEVER edit `docs/rating-analysis.md` (auto-generated) or
  `docs/prediction-review-report.md` (historical).
- NEVER delete, rename, or reorder headings in `docs/taste-profile.md`.
- The marker lines in `docs/profile-changelog.md` are updated ONLY by
  `scripts/mark-review-done.ts`. Your only manual edit to that file is APPENDING
  `- [ ]` lines.
- If any validation/fix loop fails 3 times, STOP and show the user the exact error.

## Preflight

1. `test -f .env.local` — if missing, STOP.
2. `test -f docs/profile-changelog.md` — if missing, STOP and tell the user
   (do NOT recreate it; it holds review state).
3. `git status --short docs/ data/` — note any pre-existing dirt so end-of-run
   diffs are attributable to this run.

## Steps

### Step 1 — Get new ratings

```
npx tsx scripts/latest-ratings.ts
```

Read the `SUMMARY:` footer line and branch:
- `newRatings=0` and `completedUnrated=0` → nothing to learn; go to Step 5.
- `newRatings=0` but `completedUnrated>0` → do Step 2, then go to Step 5.
- otherwise → continue in order.

### Step 2 — STOP: completed-but-unrated shows

If `completedUnrated>0`: list those shows and ask the user:
"You've finished these but haven't rated them. Rate them in the app/Trakt now and
I'll re-run the review, or continue without them?" WAIT for the answer. If they
rate now, re-run Step 1.

### Step 3 — Accuracy analysis

1. Build a table for every new rating:
   `Show | Predicted | Actual | Δ | Pref predicted/actual | note excerpt`.
2. Run `npx tsx scripts/profile-stats.ts` for fresh aggregate numbers
   (distribution, solo/together averages, MAE, bias, within-0.5★).
3. For EACH show with `|Δ| >= 1.0` (and each `[PREF FLIP]`), answer these three
   questions in writing:
   a. Which modifier or rule over/under-fired — or was missing entirely?
   b. Is this a watch-mode miss (solo/together) rather than a rating miss?
      (A together-drop is NOT a solo verdict — see the taste profile.)
   c. Does an existing lesson or rule in `docs/taste-profile.md` already cover
      it? (Search the doc before claiming it's new.)
4. Draft proposed profile changes as a table:
   `Section | Change | Evidence (shows + deltas)`.
   Constraints:
   - A NEW modifier row or a CHANGED modifier value needs ≥ 2 supporting shows.
   - A single show justifies at most a lesson bullet.
   - Review-note quotes are the strongest evidence — cite them.

### Step 4 — STOP: profile update approval, then guarded edit

Present the proposal table and the fresh stats. The user may push back — debate
on the evidence, don't fold automatically. Only after approval:

1. Edit `docs/taste-profile.md`. ONLY these five operations are allowed:
   a. Update numeric cells in the rating-distribution table and the
      "(N rated shows)" heading count, using `profile-stats.ts` numbers.
   b. Update the MAE / bias / within-0.5★ numbers in "Prediction Accuracy".
   c. Append lesson bullets (each citing show + predicted + actual).
   d. Append rows to a modifier table.
   e. Change an existing modifier's value in place.
   Anything else (deleting text, rewriting sections, new headings) is forbidden —
   if a change doesn't fit these operations, ask the user to make it themselves.
2. For each change that could INVALIDATE existing predictions (new/changed
   modifiers, rule changes — NOT stats updates, and NOT pure-validation or
   calibration-note lessons that no stored prediction reason relies on), append
   one line to the "Pending prediction rescan" section of
   `docs/profile-changelog.md`, following the entry format and `affects:`
   vocabulary documented in that file. If in doubt whether a lesson invalidates
   anything, ask the user at the approval gate.
3. Validate: run `git diff docs/taste-profile.md`. FAIL if any removed line
   (starting `-`) is a heading (`#`) — UNLESS its matching `+` line differs only
   in the "(N rated shows)" count — or is not part of an in-place value change
   you intended. On FAIL: `git checkout -- docs/taste-profile.md` and redo once;
   if it fails again, STOP and show the diff.

### Step 5 — Check for new Trakt shows (delegate to /sync-library)

The Trakt API is permanently gone, so `check-new-trakt-shows.ts` always prints
`0 shows` and the dev-server `syncFromTrakt` route cannot import anything. Do NOT
run either. Instead invoke the Skill tool with `sync-library`: it reads the user's
Trakt account through the logged-in `app.trakt.tv` browser tab, resyncs watch
status, imports missing shows, and calls `/predict-new-shows` itself.

If `/sync-library` STOPs because there is no logged-in Trakt tab, note "Trakt not
synced — no browser session" in the Step 9 summary and continue to Step 7 with
what is in the DB.

### Step 6 — (retired)

Kept as a heading so the step numbers below stay stable. The dev-server sync it
described depended on the dead Trakt API.

### Step 7 — Predict new shows (delegate)

```
npx tsx scripts/find-shows-needing-predictions.ts
```

If it lists more than 0 shows: invoke the Skill tool with `predict-new-shows` and
let it run its full flow (enrich → worksheet → dry-run → present → apply → log).
Do NOT duplicate its prediction logic here, and do NOT improvise predictions
inline if the invocation fails — report the failure instead.

### Step 8 — Close out

```
npx tsx scripts/mark-review-done.ts ratings
```

### Step 9 — Summary

Report using this template:

```
Ratings reviewed: <n> new since <date> (window MAE <x>★, <n> big misses)
Profile changes: <list, or "none"> — <n> pending rescan entries added
  → run /rescan-predictions to propagate them to existing predictions
New shows: <n> synced from Trakt via /sync-library, <n> predicted (via /predict-new-shows)
Still unrated: <list of completed-but-unrated, or "none">
Files changed: <output of git diff --stat>
```

Offer to commit the changed files (docs + batch JSON in one commit, per repo
convention). Do NOT auto-run /rescan-predictions — only suggest it.

## Failure modes

| Symptom | Action |
|---|---|
| `.env.local` or `docs/profile-changelog.md` missing | STOP, tell the user |
| `/sync-library` stops for a Trakt login | Continue without the sync; say so in the summary |
| /predict-new-shows invocation fails | Report it; never improvise predictions inline |
| Profile diff validation fails twice | STOP, show the diff, let the user decide |
