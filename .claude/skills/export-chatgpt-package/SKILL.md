---
name: export-chatgpt-package
description: Build a self-contained data package (CSVs, taste profile, prediction history, platform report card, analyst prompt, zip) that an external LLM such as ChatGPT can be pointed at to write its own reports on the TV library. Use when the user asks for a data export, a package for ChatGPT, or a platform report card / streaming analysis.
---

# Export ChatGPT Package

Produce `exports/chatgpt-package-<date>/` and its zip: every show with every
column, one row per show × platform, per-platform summary numbers, the raw Trakt
capture, the taste profile and prediction history, a report card written here,
and a ready-to-paste analyst brief. Read-only against the DB.

## Hard rules

- Run every command from the repo root. The exporter is
  `scripts/export-chatgpt-package.ts` — extend it rather than hand-editing CSVs.
- This skill writes nothing to the DB and nothing under `docs/`. Its only outputs
  are under `exports/` (gitignored — the package carries the user's review notes
  in bulk, so it is regenerated, not committed).
- The report card is analysis, not data: grades are yours to call, but every
  number in it must come from `platform_summary.csv` / `platform_shows.csv`.

## Preflight

1. `test -f .env.local` — if missing, STOP.
2. `which zip` — if missing, run without `--zip` and say the folder is unzipped.
3. `TODAY=$(date +%F)`.

## Steps

### Step 1 — Freshness decision

```
ls -t .trakt-capture-*.json 2>/dev/null | head -1
```

If the newest capture is older than 7 days, or the user said "fresh" / "update
first": invoke the Skill tool with `sync-library` and let it finish before
exporting. If it STOPs for a Trakt login and the user is not around, export
anyway and carry the staleness into the summary. If the user said "as-is", skip
the sync.

### Step 2 — Export

```
npx tsx scripts/export-chatgpt-package.ts --zip
```

Read the `WARNING:` lines (old capture / stale streaming data) and the `SUMMARY:`
line (`out=`, `shows=`, `rated=`, `predicted=`, `platforms=`, `capture=`,
`streamingNewest=`, `zip=`). `RESULT: FAIL` → STOP and show the error.

Sanity-check the CSVs before trusting them:

```
python3 -c "import csv; d='exports/chatgpt-package-$TODAY/'; [print(f, sum(1 for _ in csv.DictReader(open(d+f)))) for f in ['shows.csv','platform_shows.csv','platform_summary.csv','trakt_progress.csv']]"
```

Row counts must match the exporter's printed counts (a mismatch means a quoting
bug — fix the exporter, never the CSV).

### Step 3 — Report card

Read `platform_summary.csv` (sorted by `weightedScore`), and for the per-platform
notes `platform_shows.csv` filtered to `worthIt4plus = true`, sorted by
`qualityScore` desc. Write `<out>/report-card-$TODAY.md` with EXACTLY these
sections:

1. **Header** — date, what "worth it" means (unfinished, not stalled, quality
   score ≥ 4★ where score = rating if rated else predicted), the current
   subscriptions from `subscriptions.csv`, and the `foxtel-now` = Max note.
2. **Grade table** — `Platform | Grade | 4★+ worth it | Exclusive | Live now |
   Solo / Together | Status`. Omit `foxtel-now`. Status = Subscribed / Not
   subscribed / Free (ABC iview, SBS On Demand, 10 Play are free).
   Grading rubric — start from `worthIt4plus`:
   ≥20 A · 15–19 A- · 11–14 B+ · 8–10 B · 6–7 C+ · 4–5 C · 2–3 D+ · 0–1 D.
   Then adjust ONE step, stating why in the per-platform note:
   down if `worthItExclusive / worthIt4plus < 0.3` (the shelf exists elsewhere);
   up if `worthItLive / worthIt4plus ≥ 0.5` (the queue is already in motion);
   down if `worthItLive = 0` and the platform is subscribed (paying for cold starts).
3. **Per platform** — one paragraph each, descending grade: the 4.5★+ titles by
   name with mode, the live shows with progress (`traktCompleted/traktAired`,
   next episode), how many are single-season (`worthItSingleSeason`), the
   3.5★ tail size (`tier35`). Name shows; do not pad.
4. **Recommendation** — keep / drop / start next / then, each with the shows that
   earn the decision. One line each. Compare against the subscribed set.
5. **Caveat** — unstarted scores are predictions (MAE ≈ 0.5★; see
   `docs/taste-profile.md` Prediction Accuracy); grades resting on rated live
   shows are firmer than grades resting on cold starts.

Keep it under ~90 lines. The previous card, if one exists in an older package
folder, is a style reference only — re-derive every number from today's CSVs.

### Step 4 — Re-zip with the report card included

```
npx tsx scripts/export-chatgpt-package.ts --zip 2>&1 | grep -E 'zip:|RESULT'
unzip -l exports/chatgpt-package-$TODAY.zip | grep -c report-card
```

The second command must print `1`. (The exporter regenerates the CSVs and
README identically and leaves the report card in place.)

### Step 5 — Summary

```
Package: exports/chatgpt-package-<date>/  (zip: <path>, <size>)
Data: <shows> shows, <rated> rated, <predicted> predicted, <platforms> platforms
Freshness: Trakt capture <date>, streaming <date>  <— list any WARNING here>
Report card: top <platform> (<grade>), subscribed: <slugs> graded <grades>
Recommendation: <one line from the card>
```

Then tell the user how to use it, in two lines: upload the zip to ChatGPT (or
drop the folder into a Project), and paste `ANALYST-PROMPT.md` as the first
message. When the ChatGPT report comes back, save it under
`exports/streaming-analysis-<date>/` and ask to compare it against the report
card — disagreements between the two are the useful output.

## Failure modes

| Symptom | Action |
|---|---|
| `RESULT: FAIL` from the exporter | Show the error; usually a missing `.env.local` or a DB connection issue |
| `WARNING: no .trakt-capture-*.json` | Progress columns and `watchCategory` are degraded — run `/sync-library` unless told to export as-is, and say so in the summary |
| CSV row count ≠ printed count | Quoting bug in `csvCell` — fix the exporter, re-run; never hand-edit a CSV |
| `zip` not installed | Export without `--zip`; point the user at the folder |
| `/sync-library` stops for a Trakt login | Export anyway, flag `capture=<old date>` in the summary |
