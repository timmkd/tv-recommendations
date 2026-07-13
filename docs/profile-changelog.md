# Profile Review State & Change Log

Machine state for the `/review-ratings` and `/rescan-predictions` skills.
The two marker lines are updated ONLY by `scripts/mark-review-done.ts` — never by hand.
You MAY hand-append `- [ ]` entries to the Pending section after manually editing
`docs/taste-profile.md`; `/rescan-predictions` will pick them up.

**Last ratings review:** 2026-07-13T13:19:42.512Z
**Last prediction rescan:** 2026-07-13T13:00:50.044Z

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
