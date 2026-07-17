---
name: rescan-predictions
description: Rescan existing predictions for unrated shows after taste-profile changes - find stale or conflicting predictions, recompute them against the current profile, apply, and log. Use when the user asks to rescan or refresh predictions, propagate profile changes, or when /review-ratings reports pending profile changes.
---

# Rescan Predictions

After `docs/taste-profile.md` changes, existing predictions may cite superseded
rules or miss new modifiers. This skill screens every stale prediction against
the pending profile changes, recomputes only the ones actually affected, applies
them via the validated write path, and checks the changes off.

## Hard rules

- Run every command from the repo root.
- Predictions are written to the DB ONLY via `npx tsx scripts/apply-predictions.ts`.
  Never raw SQL, never `node -e`, never a new one-off script.
- NEVER write or change `rating`, `ratedAt`, `reviewNote`, or `watchPreference`.
- NEVER edit `docs/taste-profile.md` in this skill. If the rescan reveals a
  profile problem, report it and suggest `/review-ratings`.
- The markers/checkboxes in `docs/profile-changelog.md` are updated ONLY by
  `scripts/mark-review-done.ts`.
- Commit to ONE final predicted rating per show — never a range, never options.
- If any validation/fix loop fails 3 times, STOP and show the user the exact error.

## Preflight

1. `test -f .env.local` — if missing, STOP.
2. `test -f docs/profile-changelog.md` — if missing, STOP (do NOT recreate it).

## Steps

### Step 1 — Load pending changes and the stale set

```
npx tsx scripts/stale-predictions.ts
```

Read the `SUMMARY:` footer line and branch:
- `pendingChanges=0` → report: "No pending profile changes. To force a rescan,
  hand-append a `- [ ]` entry to docs/profile-changelog.md (format documented in
  that file) or re-run me with a date: `npx tsx scripts/stale-predictions.ts
  --since <ISO>`." Then stop.
- `staleCount=0` → the pending changes touch no live predictions. Run
  `npx tsx scripts/mark-review-done.ts rescan --check-all` and report that the
  changes are propagated (vacuously). Stop.
- otherwise → continue.

### Step 2 — Screen every stale show

1. Read `docs/taste-profile.md` IN FULL first.
2. Produce a screening table with EXACTLY `staleCount` rows — one per show the
   script printed, no skipping:
   `Title | pending entry matched (by date) or — | KEEP / RECOMPUTE | one-line why`

   Mark RECOMPUTE if ANY of these hold (and nothing else — do not re-litigate
   predictions no pending entry touches):
   a. The show's stored REASON text cites a rule/phrase that a pending entry
      changed (match the entry's `reason~"..."` keywords against the REASON).
   b. The show's attributes match the entry's `affects:` keywords
      (genre, `pref=`, `origin=`, `seasons<=N`, `format=`).
   c. The show's `recommendedWatchPreference` conflicts with a changed
      solo/together rule.

### Step 3 — Recompute the flagged shows

For each RECOMPUTE show, follow `docs/prediction-worksheet.md` EXACTLY, writing
the worksheet out per show. Use the metadata the script already printed (IMDB/
Trakt/TMDB numbers, genres, seasons, showStatus, overview).

Include a row in the batch ONLY if at least one of:
- the predicted rating changes by ≥ 0.5★, or
- the solo/together preference flips, or
- the old reason cites a superseded rule (keep the number, rewrite the reason —
  `changeNote: "reason refresh: <entry date>"`).

Every row's `changeNote` MUST name the pending entry that drove it (by date and
a couple of words). Save to `data/prediction-batches/YYYY-MM-DD-rescan.json`.

If NO show ends up in the batch (all recomputes land within 0.5★, same pref,
reasons still valid): skip to Step 7 — the screening table is still the product.

### Step 4 — Validate

```
npx tsx scripts/apply-predictions.ts data/prediction-batches/<file>.json --dry-run
```

Fix EVERY listed error, re-run until `RESULT: DRY-RUN OK` (max 3 cycles, else
STOP). Investigate every `WARNING:` line — rewrite if it's a real platform
mention.

### Step 5 — Present (no approval gate)

Present: (1) the screening table, (2) the changes table
`Show | Old | New | Reason for Change` — then proceed straight to Step 6 WITHOUT
waiting for approval. Predictions are the predictor's call (user directive
2026-07-17). If the user challenges a change after it's applied, debate it on
the evidence — don't fold automatically; revise to a single new number only if
convinced, re-dry-run, re-apply via Step 6.

### Step 6 — Apply and log

```
npx tsx scripts/apply-predictions.ts data/prediction-batches/<file>.json
```

Confirm `RESULT: OK`. Append to the END of `docs/prediction-updates.md`:

```
## YYYY-MM-DD — Prediction rescan (profile changes: <pending entry dates>)

Screened <staleCount> stale predictions; kept <n> unchanged.

<the table the script printed>
```

### Step 7 — Close out

```
npx tsx scripts/mark-review-done.ts rescan --check-all
```

### Step 8 — Summary

```
Pending changes processed: <n> (dates)
Screened: <staleCount> stale predictions
Recomputed: <n> — Applied: <n> changed, <n> reason-refreshes
Kept unchanged: <n>
Files changed: <output of git diff --stat>
```

Offer to commit the changed files.

## Failure modes

| Symptom | Action |
|---|---|
| `pendingChanges=0` but the user insists something changed | Explain the hand-entry format in docs/profile-changelog.md, or use `--since <ISO>` |
| `staleCount` > 40 | Still screen ALL of them (the exactly-staleCount-rows table is mandatory); if genuinely unmanageable, STOP and propose splitting the run by `affects:` keyword |
| `RESULT: FAILED` on final apply | Never hand-write to the DB; show the errors and STOP |
| Validation loop exceeds 3 cycles | STOP with the exact remaining errors |
