---
name: recheck-predictions
description: Re-check star predictions that were made before the evidence existed - pre-air, on a handful of aired episodes, or on a thin vote count - now that the season has aired and the numbers have settled. Re-derives them from fresh Trakt data and critic reception, applies changes, logs them. Use when the user asks to revisit, double-check, or re-predict shows that may have been predicted too early, or names shows whose predictions "might not have had enough information".
---

# Recheck Predictions (premature-prediction audit)

Different from the other two prediction skills:
- `/review-ratings` learns from **user ratings** (what the user scored vs what
  was predicted) and updates the taste profile. Rated shows belong there.
- `/rescan-predictions` propagates **taste-profile changes** to existing predictions.
- **This skill** fixes predictions whose **evidence** was thin when written — the
  show had not aired, only 1–4 episodes existed, votes were in the dozens — and
  for which better evidence now exists. The profile is not the problem; the
  inputs were.

Widow's Bay is the canonical case: predicted 3.5★ together pre-air on 70 votes,
then sat unrevised through a 98% RT season and 14 Emmys — it is 4.5★ solo.

## Hard rules

- Run every command from the repo root.
- Predictions are written to the DB ONLY via `npx tsx scripts/apply-predictions.ts`.
  Never raw SQL, never `node -e`, never a one-off script.
- NEVER write or change `rating`, `ratedAt`, `reviewNote`, or `watchPreference`.
- Unrated shows only. If the user names a **rated** show, say that `/review-ratings`
  owns it (the user's rating is ground truth; re-predicting it is meaningless) and
  skip it.
- Never re-derive a **pre-air** show from "buzz". Record the first-air date and the
  instruction "re-derive after <date>"; a pre-air call is structural by definition.
- Sub-3★ predictions are never re-thought (CLAUDE.md rescan rule). The screen
  excludes them; `--include-low` only on explicit user request.
- A prediction must never contradict a recorded `watchPreference`.
- Commit to ONE final number per show. No ranges, no options, no approval gate.
- If any validation/fix loop fails 3 times, STOP and show the exact errors.

## Preflight

1. `test -f .env.local` — if missing, STOP.
2. Freshness: `ls -t .trakt-capture-*.json | head -1`. If the newest capture is
   older than 14 days (or absent), say so and run `/sync-library` first (Skill
   tool). If that stops for a Trakt login, wait for the user — the fresh Trakt
   numbers ARE the evidence this skill needs.

## Steps

### Step 1 — Screen

```
npx tsx scripts/airtime-screen.ts
```

If the user named shows, ALSO run `npx tsx scripts/airtime-screen.ts --tmdb <ids>`
(find ids with `npx tsx scripts/lookup-show.ts "<title>"`). Named shows bypass the
scope and recency filters — the user's hunch is always screened, but it is still
re-derived on evidence, not deference.

Read the `REASON:` lines and the `SUMMARY:`. Flags mean:
- `PREMATURE(a->b eps)` — predicted on ≤4 aired episodes; `b` have aired now. Always recheck.
- `NEW-EPISODES(+n)` — 3+ episodes aired since the prediction (mid-season growth or
  the season completing). Recheck.
- `THIN-VOTES(trakt=n)` — under 500 Trakt votes and still airing/just ended, so the
  number is still moving. Recheck.
- `STALE-PHRASE("...")` — the stored reason itself admits thin evidence
  (worksheet Step 0 phrases, or cites a vote count under 500). Recheck — at minimum
  the reason must be rewritten.
- `PRE-AIR` — do not re-derive; note the first-air date.
- `RECENT(...)` / "skipped" note — predicted within the last 14 days with no new
  episodes since; nothing has changed. Leave it.

The `(col)` note: for shows with no batch-file date the script falls back to
`predictionsUpdatedAt`, which the 2026-09-16 ramp backfill bumped. Their real
prediction date may be months older — if one of them is borderline, confirm with
`git log -S"<title>" -- docs/prediction-updates.md`.

If `flagged=0` and the user named nothing: report "no premature predictions" with
the `recentSkipped` list, and stop.

### Step 2 — Dedupe against the log

For each flagged title, `grep -n "<title>" docs/prediction-updates.md | tail -3`.
If it was **re-derived or "checked and left unchanged" within the last 30 days**
and its only flags are `THIN-VOTES` / `STALE-PHRASE` (no `PREMATURE` /
`NEW-EPISODES`), skip it — the evidence has not moved. List these as "skipped
(recently re-verified)" in Step 7. Everything else is the working list.

### Step 3 — Fresh evidence (STOP gate on the browser)

**Trakt numbers.** In the logged-in `app.trakt.tv` tab (`list_pages` /
`select_page`), run the lookup snippet from `/sync-library` Step 4 with `IDS` set
to the working-list tmdbIds, `filePath` = `<repo root>/.trakt-lookup-$(date +%F).json`.
No tab / no tooling / snippet returns an error → **STOP** and ask the user to log
in. Trakt is the base rating (IMDb is unreachable from this setup, OMDB has no
key); without it there is no fresh base and the recheck cannot proceed.

Then:

```
npx tsx scripts/lookup-to-captures.ts
npx tsx scripts/backfill-trakt-meta.ts        # writes fresh traktRating / traktVoteCount
npx tsx scripts/merge-trakt-genres.ts --tmdb <ids>   # additive; a late Horror/Thriller tag flips the mode
```

The `lookup-to-captures.ts` output lines give, per show: Trakt rating, votes,
`status` (returning / ended / canceled), `aired` episode count, network, first-air
date. Those are the Step 1 base and the Step 0 freshness facts.

**Reception.** The RT scraper is broken and `rtCriticsScore` is unknown, not low.
For each show run one `WebSearch`: `"<title>" <year> season <n> reviews Rotten
Tomatoes Metacritic`. Record critic %, audience %, Metacritic, whether the season
has finished, and how the finale landed. Where critics and audience split, the
taste profile says which side to take per genre (e.g. Mystery/Crime sides with the
audience — Scarpetta 2026-10-28).

### Step 4 — Re-derive

1. Read `docs/taste-profile.md` IN FULL.
2. Follow `docs/prediction-worksheet.md` EXACTLY per show, Step 0 through Step 6
   (bingeability + ramp clause in the same pass), writing the worksheet out. Use
   the metadata from Step 3, not the stored reason.
3. Classify each show:
   - **CHANGE** — rating moves ≥ 0.5★, or watch mode flips, or bingeability moves.
     Row carries all five prediction fields.
   - **REFRESH** — number and mode hold but the stored reason cites stale
     evidence ("2 episodes", "only 154 votes", "not yet aired"). Row carries the
     same number with a rewritten reason.
   - **UNCHANGED** — number holds and the reason is still accurate. **No row, no
     write** (a write would bump `predictionsUpdatedAt` for nothing).
4. `changeNote` (≤120 chars) names the trigger, in one of these forms:
   - `Post-air recheck: predicted on N eps; <evidence> — X→Y★ M`
   - `Mid-season recheck: predicted after N eps/V votes; <evidence> — X★ M holds, refreshed`
   - `Vote-settle recheck: V→W votes at R; <evidence> — X→Y★ M`
5. Save to `data/prediction-batches/YYYY-MM-DD-airtime-recheck.json` (suffix `-2`
   if it exists). Reasons 400–600 chars starting `Predicted X★: `; bingeability
   reasons 120–400 chars starting `Binge X/5: ` and ending with one of the four
   ramp clauses. Say what changed since the original call — "full S1 now out,
   Trakt slid 7.8→7.4", "finale split fans" — that is the point of the recheck.

### Step 5 — Validate

```
npx tsx scripts/apply-predictions.ts data/prediction-batches/<file>.json --dry-run
```

Fix EVERY error, re-run until `RESULT: DRY-RUN OK` (max 3 cycles, else STOP).
Over-length reasons: cut a parenthetical or a second comp, never the evidence
sentence. Investigate every `WARNING:` (platform words) — rewrite real ones.

### Step 6 — Present (no approval gate)

Table: `Show | Old | New | Flags | Reason for Change` for CHANGE + REFRESH rows,
plus the UNCHANGED list with one line each on why the call still stands. Then go
straight to Step 7. If the user pushes back afterwards, debate on the evidence;
revise to one new number only if convinced, re-dry-run, re-apply.

### Step 7 — Apply and log

```
npx tsx scripts/apply-predictions.ts data/prediction-batches/<file>.json
```

Confirm `RESULT: OK`. Append to the END of `docs/prediction-updates.md`:

```
## YYYY-MM-DD — Premature-prediction recheck (/recheck-predictions)

Screened <screened> unrated predictions (airtime-screen.ts); <flagged> flagged
(<premature> premature, <newEpisodes> new-episode, <thinVotes> thin-vote, <stalePhrase> stale-phrase).
Trakt refreshed for <n> shows via the browser session; IMDB unavailable, Trakt is the base.

<the table apply-predictions.ts printed>

**Checked and left unchanged (no write):** <Title X★ M — why it stands; ...>
**Skipped (recently re-verified / pre-air):** <Title — reason; Harry Potter — pre-air, re-derive after 2026-12-25>
```

The "left unchanged" list is mandatory — it is what Step 2 reads next time.

### Step 8 — Summary

```
Screened: <n> | Flagged: <n> | Rechecked: <n>
Changed: <n> (Title X→Y★ M, ...) | Refreshed: <n> | Unchanged: <n> | Skipped: <n>
Pre-air (re-derive later): <Title after <date>, ...>
Files changed: <output of git diff --stat>
```

Offer to commit (batch JSON + prediction-updates.md). If a recheck changed a
rating by ≥1★, say so explicitly — that is a lesson candidate for `/review-ratings`
(a profile rule, not just an evidence gap, may be at fault).

## Failure modes

| Symptom | Action |
|---|---|
| No logged-in Trakt tab | STOP — ask the user to log in; no fresh base without it |
| `lookup-to-captures.ts` → `failed>0` for a show | Re-derive it on TMDB votes only and say so in the reason's evidence sentence |
| User names a rated show | Skip; point to `/review-ratings` |
| User names a sub-3★ show | Screen it with `--tmdb` (explicit request overrides the rule) and say the rule was overridden |
| `RESULT: FAILED` on final apply | Never hand-write to the DB; show the errors, STOP |
| Validation loop exceeds 3 cycles | STOP with the exact remaining errors |
