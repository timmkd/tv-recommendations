# Profile Review State & Change Log

Machine state for the `/review-ratings` and `/rescan-predictions` skills.
The two marker lines are updated ONLY by `scripts/mark-review-done.ts` — never by hand.
You MAY hand-append `- [ ]` entries to the Pending section after manually editing
`docs/taste-profile.md`; `/rescan-predictions` will pick them up.

**Last ratings review:** 2026-09-15T23:55:07.398Z
**Last prediction rescan:** 2026-09-09T13:02:03.201Z

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
