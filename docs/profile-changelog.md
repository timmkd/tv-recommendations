# Profile Review State & Change Log

Machine state for the `/review-ratings` and `/rescan-predictions` skills.
The two marker lines are updated ONLY by `scripts/mark-review-done.ts` — never by hand.
You MAY hand-append `- [ ]` entries to the Pending section after manually editing
`docs/taste-profile.md`; `/rescan-predictions` will pick them up.

**Last ratings review:** 2026-11-04T03:16:58.103Z
**Last prediction rescan:** 2026-11-04T03:57:23.232Z

## Pending prediction rescan

Rule/modifier changes to `docs/taste-profile.md` that have not yet been propagated
into existing predictions. `/review-ratings` appends unchecked entries;
`/rescan-predictions` processes them and checks them off (via `mark-review-done.ts rescan --check-all`).

Entry format (one line each):
`- [ ] YYYY-MM-DD | TYPE | what changed (old -> new) | affects: <keywords>`

- Types: `NEW-MODIFIER`, `MODIFIER-CHANGE`, `RULE-CHANGE`, `LESSON`.
- Stats-only profile updates (counts, MAE, averages) are NOT logged here — they never invalidate predictions.
- `affects:` keywords use this vocabulary only: genre names (`comedy`, `crime`, ...),
  `pref=solo` / `pref=together`, `origin=<country>`, `seasons<=N`, `format=<format>`,
  and `reason~"<phrase>"` (a phrase cited in existing prediction reasons).

Examples of well-formed entries:
`- [ ] 2026-05-30 | RULE-CHANGE | Schur comedies flip together only when heartwarming, not via crime backbone (old: crime backbone -> new: silliness dial) | affects: comedy, pref=together, reason~"crime backbone"`
`- [ ] 2026-02-25 | MODIFIER-CHANGE | New-series volatility weakened when show hits a core sweet spot (-0.3 -> -0.3 weak) | affects: seasons<=1, reason~"new-series volatility"`

- [x] 2026-07-13 | RULE-CHANGE | (seed entry — profile state as of skill creation, already reflected in all predictions) | affects: none
- [x] 2026-07-17 | LESSON | Cringe/icky premise doesn't force solo — dry-deadpan register + relatable stakes + binge momentum can flip comedy together (Alice and Steve pred 3.5★ solo -> 4★ together) | affects: comedy, pref=solo, reason~"Rosehaven"
- [x] 2026-08-31 | MODIFIER-CHANGE | 4+ seasons longevity bonus now requires a serialised arc or comfort-rewatch status — never on a cold start into an episodic back-catalogue (+0.3 -> +0.3 conditional; Monk 4★ -> 3★, Ghosts 4★ -> 3★) | affects: reason~"longevity", reason~"4+ seasons", reason~"seasons"
- [x] 2026-08-31 | MODIFIER-CHANGE | Together procedural bonus now requires a serialised spine; pure case-of-the-week gets nothing (+0.2 -> +0.2 conditional; Matlock 4★ vs Monk/Elementary/Elsbeth/The Resident all 3★) | affects: crime, mystery, pref=together, reason~"procedural"
- [x] 2026-08-31 | NEW-MODIFIER | Bingeability axis added (1-5, own column + UI): predicted 4-5 = +0.2/+0.3, 1-2 = -0.3/-0.5, never lifts a prediction above 4★. PROVISIONAL — no user-entered scores exist yet, weights derived only from inferred values in review notes. DO NOT apply to predictions until ~20-30 real scores exist and weights are re-derived. | affects: none
- [x] 2026-09-09 | RULE-CHANGE | Bingeability recalibrated on 78 real scores: axes are correlated (r=0.55) not orthogonal; sustain is necessary-not-sufficient for 4.5★+; hook predicts abandonment, NOT quality — so never cap a prediction for a slow start alone when a payoff signal exists (Dark 4.5★ weak hook vs Monk 3★ weak hook, no payoff). Negative bingeability weights RETIRED; positive weights stay out of the formula. | affects: reason~"slow burn", reason~"slow-burn", reason~"nothing happens"
- [x] 2026-09-09 | NEW-MODIFIER | Bingeability is a run-AVERAGE across seasons, not a peak: drop one level when the run is 4+ seasons (or 3 with a notorious collapse) AND the later-run complaint is momentum/resolution rather than quality (Westworld 3, Upload 3 vs The Crown 5). Per-season-closed structures exempt. Diagnostic axis only — does not touch star predictions. | affects: reason~"bingeable", reason~"momentum", reason~"cliffhanger", seasons<=1
- [x] 2026-10-03 | LESSON | Bingeability also averages down for interleaved STRESS, not just front-loaded decay: The Bear 4★/binge 3 with an effusive note ("love the script… beautifully made") — pressure-cooker prestige drama with slow S1 estimates binge 3, ramp "picks up from S2; worth it", and the 3 holds the star at 4★ rather than lowering it. Also re-confirms sustain-necessary-for-4.5★ at n=22. Diagnostic axis only. | affects: drama, pref=solo, reason~"stressful", reason~"intense", reason~"pressure"
- [x] 2026-11-04 | LESSON | Heavy-but-purposeful together drama no longer caps binge at 4 (We Were the Lucky Ones pred 4 -> scored 5; Testaments 5, Handmaid's 5) | affects: drama, pref=together, reason~"caps consecutive viewing", reason~"heavy subject matter"
- [x] 2026-11-04 | LESSON | Hacks re-rated 3.5★ -> 4★ solo; reasons anchored on "Hacks 3.5★" are stale by 0.5★ (Platonic, Girls, Rake, Youth) | affects: comedy, pref=solo, reason~"Hacks 3.5"
- [x] 2026-11-04 | RULE-CHANGE | Multi-season ramp penalty for cold starts: -0.5★ when the good stretch starts at S2+ (none -> -0.5★ provisional), ramp "picks up from S N", prediction text must state the end-state payoff | affects: reason~"picks up from S", reason~"later seasons", reason~"first season", reason~"season 1", reason~"gets better"
- [x] 2026-11-04 | RULE-CHANGE | Multi-season ramp refined: number = end-state rating, text must state the weak-stretch rating ("S1 likely 3.5★"); -0.5★ only when the ramp is 2+ seasons (old: -0.5★ for any S2+ ramp -> new: one-season ramp free) | affects: reason~"picks up from S", reason~"cold start"
- [ ] 2026-11-08 | RULE-CHANGE | Ramp clause must come from per-episode evidence (scripts/episode-scores.ts + reviews), not format; `Grabs from ep 1.` is a finding, not a default (old: inferred from format, 126/179 backfill rows Grabs -> new: read from per-episode shape; 3 of 4 Disney+ Grabs were wrong) | affects: reason~"Grabs from ep 1"
