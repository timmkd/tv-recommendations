# Taste Profile & Prediction System

For data formats, API routes, and coding patterns, see `CLAUDE.md`.

## Rating Distribution (216 rated shows)

| Rating | Count | Meaning |
|--------|-------|---------|
| 5★ | 5 | Exceptional - all-time favorites |
| 4.5★ | 18 | Loved it - strong signal |
| 4★ | 81 | Good solid show |
| 3.5★ | 49 | Enjoy but don't love |
| 3★ | 37 | Still good |
| 2-2.5★ | 26 | Dropped or disappointed |

### Solo vs Together — it's about VARIANCE, not a lower ceiling (revised May 2026)

The old read ("solo allows deeper engagement → higher ratings") was a survivorship artifact. The real picture:

| Set | Solo | Together |
|-----|------|----------|
| **Kept only (excl dropped)** | 3.77★ (n=91) | **3.73★ (n=77)** — near parity |
| Incl dropped (old methodology) | 3.74★ (n=95) | 3.46★ (n=101) |

**Together is the high-variance lane, not the low-ceiling lane.** Of 28 dropped shows, **24 are together** (avg 2.56★) vs only **4 solo** (avg 3.00★). A together show that *survives* rates essentially as high as a solo one — the gap is created entirely by together shows that get **dropped hard** (Helen-fit failures: fizzle, bleak, procedural fatigue, character-investment failure).

**Implication for predictions:** don't apply a blanket "together penalty." Instead screen aggressively for **drop risk** up front (the failure modes below + the strict 2-episode test). If a together show clears that filter, predict it near solo levels. The danger in the together lane is a 2★ drop, not a capped 3.5★.

## The 5★ Shows

- **Severance** (solo) - psychological sci-fi, mind-bending
- **Parks and Recreation** (solo) - comfort workplace comedy
- **The Office** (solo) - comfort workplace comedy
- **Chernobyl** (together) - WWII-era true story, prestige limited series
- **The West Wing** (together) - prestige political drama

### Predicting a 5★ (added Sep 2026)

Two routes reach 5★, and until Sep 2026 **neither had ever been predicted** — 220
predictions sat under a 4.5★ wall while the formula's own arithmetic cleared 5.0 for
two shows. The wall was habit. Breaking Bad (5★ solo) and Band of Brothers (5★
together) were the corrections.

1. **Prestige route — peak execution + a delivered payoff** (Chernobyl, Severance, The
   West Wing). Predictable, and the one to actually use. Requires: no
   cancelled/unresolved risk, no known weak season, and a real payoff — this user
   rates the *landing* hardest (Dark 4.5★ *for* being "beautifully resolved"; Sherlock
   capped at 4.5★ because "the last season wasn't quite as good").
2. **Comedy route** (Parks, The Office US). **Not a rewatch artefact** — user-corrected
   2026-09-10: *"they would have been five stars even on original watch… I haven't
   found a show to rival them."* The rewatch notes are a consequence of the 5★, not
   its cause. So a first-watch 5★ comedy is possible in principle.

**But the comedy route is empirically closed: the base rate is 0 for 38.** Every
comedy after 2009 caps at 4.5★ (B99, Lower Decks), with a dense 4★ wall beneath it
(Abbott Elementary, Superstore, Schitt's Creek, Veep, Community, Mrs. Maisel). The
format has been deliberately restaged twice and did not reproduce — **The Paper 4★**
(Greg Daniels, mockumentary workplace ensemble, same universe: the closest possible
comp, a full star short) and **The Office AU 2024 2★**.

**Rule: never predict a new comedy above 4.5★.** What would flip it: a 7+ season
ensemble workplace comedy with genuine multi-season character-growth arcs in a warm —
not cynical, not zany — register. The modern release model rarely commissions one,
which is why the slot has stayed empty; it is *not* a limit on the user's scale.

---

## Solo Profile

**Core tastes:** Psychological depth, mind-bending narratives, exceptional acting. Sci-fi that makes you think. Easy rewatchable comedies. **Jaw-dropping reveals and twists.**

**Loves:**
- **Jaw-drop reveals and twists** - "One of my absolute favourite things in a TV show." Dark 4.5★, Foundation S3 finale. Shows that deliver surprises and payoffs are highly valued.
- Psychological sci-fi (Severance 5★, Black Mirror 4.5★, Dark 4.5★, Silo 4.5★, Foundation 4.5★, Stranger Things 4.5★, Pluribus 4.5★ - "This is the type of sci fi I love. So much.")
- Comfort workplace comedies (Parks & Rec 5★, The Office 5★, Brooklyn Nine-Nine 4.5★)
- Easy bingeworthy shows (Superstore 4★, The Paper 4★ - "surprisingly good easy watch")
- Star Trek universe (Lower Decks 4.5★, Strange New Worlds 4★, Discovery 4★)
- Marvel/superhero completionist (Loki 4.5★, WandaVision 4★, What If...? 4★, Jessica Jones 4★)
- Sharp satire/dark comedy (The Great 4.5★, Barry 4★, Fleabag 4★)
- True story dramas (Dopesick 4★ - "love based on true stories")
- Australian content - stated preference (Total Control 4★, Newsreader 3.5★, Boy Swallows Universe 3.5★)
- Musical theatre - stated preference (Schmigadoon! 4★)

**Avoids:**
- Cancelled unresolved shows (Big Door Prize 2.5★ - "I hate when cancelled unresolved")
- Declining quality in later seasons (Arrested Development 4★ - "s05 was rubbish")
- Too intense AND slow (Mindhunter 2.5★)
- Shows that fizzle (Travelers 3★ - "fizzled out towards the end")
- **Animation without franchise hook** - Animated hits (Lower Decks, What If) are franchise-driven. Adult animation without IP attachment faces a barrier. Apply -0.5★.

---

## Together Profile (with Helen)

**Core tastes:** Spy thrillers, period dramas, prestige true stories, light mysteries, easy watches. Shows need momentum to keep Helen engaged.

**Loves:**
- **Mystery/spy/crime** (avg 4.2★+): Slow Horses 4.5★, Sherlock 4.5★, Bodyguard 4★, The Americans 4★, Homeland 4★, The Diplomat 4★, Only Murders 4★
- **DRY WIT + GROUNDED characters, NOT zany (refined May 2026, user-flagged):** Helen gravitates to dry/deadpan/grounded characters and bounces off zany/absurd/silly ones — often within the *same* show. Loves: the "grumpy dry wit" archetype (Jackson Lamb — "loves his one-liners so much"; Ron Swanson — but *not* the broader zany Parks cast), the Tina Fey/Alec Baldwin grounded dynamic in 30 Rock (but *not* zany Tracy Jordan), and grounded family sitcoms (Modern Family 3.5★, The Big Bang Theory 3.5★). This is the character-level texture of the silliness axis: dry/grounded → Helen; zany/absurd → "less Helen". Explains 30 Rock landing 3.5★ together (she watched it for Liz/Jack, not Tracy), and why a dry-wit anchor can pull solo-leaning comedy into together.
- Period dramas (The Crown 4.5★, Bridgerton 4★, The Gilded Age 4★, A Gentleman in Moscow 4★)
- Prestige true stories (Chernobyl 5★, Lessons in Chemistry 4.5★, Unorthodox 4★)
- Easy watches (Nobody Wants This 4★, Gilmore Girls 4★, The Four Seasons 4★ - "good pace and an easy watch")
- Family sitcoms — broader appeal for Helen (Modern Family 3.5★, Big Bang Theory 3.5★)
- WWII + True Story + Uplifting = near-guaranteed hit (A Small Light 4★, All the Light We Cannot See 4★)
- Procedural/case-of-the-week formats (The Rookie 4.5★, The Pitt 4★, Fringe 4★)
- Low-commitment limited series (Manhunt 3.5★, Quiz 3.5★ - "low intensity, low commitment")
- Legal/political dramas (The Good Wife 4★, The West Wing 5★, Total Control 4★)

**Helen Dislikes** (canonical list):
- Superhero content
- Crude humor, graphic sex/language (tolerates if show is gripping enough)
- Slow pacing **in plot-driven genres** (Severance "too slow for helen", Fargo, Normal People). NOTE: Slow pacing is fine with likeable characters + light tone (The Four Seasons 4★)
- Sci-fi/fantasy
- Shows that get boring mid-run (Elsbeth 3★, Night Agent 3★, Elementary 3★)
- Drawn out mysteries (The Agency 3.5★, Paradise 3.5★)
- Shows where nothing happens early (The Artful Dodger 2.5★)

**Together Failure Modes** (don't conflate these):
- **Fizzle** - starts strong, loses momentum (Killing Eve 3★, Tehran 3★, A League of Their Own 2.5★)
- **Bleak/punishing** - too dark from the start (Happy Valley 2★, MobLand 2.5★)
- **Procedural fatigue** - format gets boring in S2+ (Elementary 3★, The Resident 3★)

---

## Dark Content & Difficulty Rules

**Default rule:** Dark content → **SOLO** unless specifically engaging for Helen.

| Content Type | Solo/Together | Examples |
|--------------|---------------|----------|
| Dark prestige antihero dramas | SOLO | Succession, Peaky Blinders |
| Serial killer / studying evil | SOLO | Mindhunter, Blackbird |
| Punishing (must skip scenes) | SOLO or SKIP | Happy Valley |
| Dark but engaging with purpose | CAN work together | Handmaid's Tale 4★, Unbelievable 4★, Adolescence 4★ |
| Bleak but SHORT (3-6 eps) | CAN work together | **Time 3.5★** (bleak prison drama, but 3 eps = low-commitment buffer) |

**The skip-scenes test:** If you have to skip scenes, the show has failed its contract.

**The short-buffer caveat (validated May 2026):** Don't reflexively flip bleak content to solo — **length matters**. The Happy Valley drop was a *long-runway* bleak show. A short bleak prestige limited series (Time, 3 eps, 3.5★ together) can work as a couple because the commitment is low and enjoyable characters carry the slow tone before it becomes punishing. Apply the bleak→solo default to long/open-ended dark shows; for 3-6 episode bleak limiteds, together is viable with a strict-2-ep test.

**Helen's True Crime Paradox:** Loves true crime/spy podcasts but not serial killer TV. Audio creates distance; TV puts you IN the scene. "Loves true crime podcasts" ≠ "Will enjoy Mindhunter."

**True-crime/scandal — COMPELLING beats LIKEABLE (validated May 2026, user-flagged):** The axis is NOT whether the real people are sympathetic — it's whether there's **propulsion**. Watched all three seasons of **American Crime Story 3.5★ together** (O.J., Versace, Impeachment) — unlikeable real people, but a case/trial/manhunt engine + systemic stakes + a cultural moment unfolding ("I really enjoy watching how a cultural moment unfolds" — Quiz 3.5★). DROPPED **A Very British Scandal 2★** AND **A Very English Scandal 2★** — same unlikeable-real-people territory, but slow *chamber-pieces* with no case engine, so "nothing happens / no one to root for." **Rule:** true-crime/scandal with a propulsive case or cultural-moment engine = together watch (3.5-4★); a slow character study of awful people = drop. The fraud-exposé cluster lands ~3.5★ when propulsive (The Dropout 3.5★, Quiz 3.5★, Apple Cider Vinegar pred 3.5★). The failure mode here is **momentum, not sympathy** — don't penalise unlikeable real people if the engine propels.

**Purposeful difficulty works when:** PURPOSE (something to say), PAYOFFS (difficulty leads somewhere), MOMENTUM, SYSTEMIC VILLAIN (critiques systems, not just individual evil), CAMERA SYMPATHY (with people fighting darkness).

**Purposeful difficulty fails when:** Dark for darkness' sake, individual evil without broader context, no lesson, "felt pointless," watching suffering without agency.

**The "cultural moment" test:** Do you want to discuss it afterward? If yes, difficulty was worth it. If you just want to forget it, it was punishing.

---

## Key Drop Patterns

1. **Character Investment Failure** - Don't like characters by ep 3-4 = drop (Station 19 2★, Bad Monkey 2.5★, The Buccaneers 2.5★, A Very British Scandal 2★, A Very English Scandal 2★). **Caveat for true-crime/scandal:** unlikeable real people are fine *if propulsive* (American Crime Story 3.5★) — these two Scandals failed on **momentum**, not sympathy (slow chamber-pieces). See "Compelling beats likeable" above.
2. **Momentum Loss** - "Nothing happens" = abandoned (Artful Dodger 2.5★, Home Before Dark 2.5★)
3. **Season 2 Decline** - Many shows get boring in S2 (Elementary 3★, The Resident 3★, Night Agent 3★, Swagger 3★)
4. **Weak Payoffs** - Unsatisfying resolutions (Suspicion 3★, Homecoming 2.5★). Shows need momentum AND satisfying payoffs.
5. **Punishing Difficulty** - Dark without purpose (Happy Valley 2★, MobLand 2.5★)
6. **Cancelled/Unresolved** - (Big Door Prize 2.5★, Sunny 2.5★)
7. **Comedy Killers** - Action + Comedy hybrid (Mr. & Mrs. Smith 2★, The Tick 2.5★), slow pacing in comedy, unlikeable characters (Bad Monkey 2.5★)
8. **Quiet abandonment — the 3★ floor (Aug 2026)** - Distinct from every pattern above, which involve active dislike and land at 2-2.5★. Here the show is *fine* and simply loses to the backlog: several episodes in, never came back, no complaint beyond inertia. **Ghosts 3★** ("not terrible… just finding myself reaching for other shows") and **Monk 3★** ("not bad… so much more on offer that investing in it seemed like an effort"). Both were **partial watches**, so treat the rating as a verdict on the *hook*, not on the show's ceiling — and as a capped, not final, score.

---

## Solo vs Together Decision Logic

### General Rules

- **Solo:** psychological depth, cerebral complexity, slow-burn, Trek, Marvel, experimental, workplace comedy, crude humor, dark/satirical, animation
- **Together:** spy thrillers, prestige limited series, WWII stories, procedurals, easy watches, period dramas, mystery-comedy, family sitcoms, legal/political

### Comedy-Specific

**Core principle:** Pure Comedy = Solo. A genre backbone *can* pull comedy Together — **but only if the tone is heartwarming/gentle; silly/zany comedy stays Solo regardless of backbone** (the real Helen dial — see below).

```
Is the primary genre Comedy (not Comedy + Crime/Mystery)?
├─ YES: Likely SOLO
│   ├─ Workplace/mockumentary (non-family) → SOLO
│   ├─ Crude/adult humor → SOLO (dealbreaker for Helen)
│   ├─ Dark/satirical → SOLO
│   └─ Family sitcom format → TOGETHER (exception)
└─ NO: Check the backbone genre
    ├─ Spy/Mystery/Crime + Comedy → TOGETHER only if gentle/warm; SILLY → SOLO (B99)
    ├─ Procedural + Comedy → TOGETHER
    ├─ Action + Comedy → AVOID (2.50★ avg)
    └─ Sci-Fi + Comedy → SOLO
```

**Helen's comedy axis = SILLINESS, not genre (key, May 2026 — user-flagged):** Within comedy, what flips a show TOGETHER is a **heartwarming / feel-good / relatable** register; what keeps it SOLO is **silly / zany / quirky / absurd** humour ("less Helen"). This *overrides* the backbone branch above — a crime/mystery backbone only helps if the tone is gentle. Evidence: Man on the Inside S1 4★ (heartwarming) together **vs** Brooklyn Nine-Nine 4.5★ (silly, *also* a crime backbone) solo; The Four Seasons 4★ (warm/relatable) together **vs** Rosehaven (quirky) solo.

**Schur exception — it's TONE (silliness), NOT the crime backbone (corrected May 2026, user-flagged):** Schur shows default solo (Parks 5★, Office 5★, B99 4.5★) and flip TOGETHER only when the register is **heartwarming / feel-good / gentle — i.e. dialled DOWN from Schur's usual silliness.** **A Man on the Inside S1 4★ together** worked because it was warm and feel-good (Ted Danson's understated charm), not because of its undercover-mystery plot. The crime backbone is **incidental** — Brooklyn Nine-Nine has a crime backbone too but is *silly*, so it stays SOLO (Helen finds it less enjoyable). **Validating data (in progress):** Man on the Inside **S2** leans harder into the silly register — Tim loves it more, but Helen is enjoying it *less*. So the Helen dial is silliness, full stop: heartwarming → together, silly/zany → solo. (Earlier I wrongly credited the "crime backbone"; B99 disproves that.)

**Rosehaven counter-example (May 2026):** **Rosehaven** (gentle Australian small-town character comedy) was recommended **together** on "Australian + light tone could work together" — and it missed badly. Helen "hated it... pointless and boring," with the female lead "so annoying" (her Character-Investment-Failure signature). The reason it failed isn't a missing genre backbone — it's that its **quirky** humour and off-putting lead gave Helen nothing to connect with. Contrast the together wins, which are **heartwarming + relatable** (The Four Seasons 4★, Man on the Inside S1 4★): warmth Helen *connects* with flips comedy together; quirky/odd character comedy stays **SOLO**. Now solo (Tim continuing solo, unrated pending a few more episodes).

**Constructed-reality / semi-scripted comedy (May 2026):** Tim loves the conceit — **Jury Duty 4★ solo** ("laughed my head off") — but it's firmly **SOLO** (showed Helen, she "didn't find it funny"). The format alone doesn't carry it: the follow-up **Jury Duty Presents: Company Retreat** was **dropped after 2 eps** ("unoriginal and not funny," left unrated). What made Jury Duty work = warmth + originality + a sweet "mark" to root for + genuine belly-laughs. Relevance to **The Rehearsal** (Nathan Fielder): shares the constructed-reality scaffolding (positive — Tim engages with the conceit and isn't cringe-averse), but a colder, more cerebral register vs Jury Duty's warm belly-laughs — so it's a partial comp, not a clean uplift. The Rehearsal lands ~4★ solo, high-variance.

**Best combos:** Pure Comedy 3.95★, Comedy + Animation 4.25★ (solo), Comedy + Crime/Mystery 3.75★ (together)

---

## Creator & Studio Signals

Creator/producer is a strong predictor **because it predicts a consistent format + tone.** Trust it *within* a creator's signature format; discount it when they step outside it (or when it's a derivative remake by other hands).

### Hello Sunshine (Reese Witherspoon) → reliable TOGETHER, ~3.7★ floor
User-flagged and validated (May 2026; Daisy Jones confirmed Jun 2026). Every rated Hello Sunshine show was watched **together**, none dropped, avg **3.7★** (n=6):
- Little Fires Everywhere 4★ · The Morning Show 4★ · Daisy Jones & the Six 4★ · Big Little Lies 3.5★ · Truth Be Told 3.5★ · Surface 3★ (the soft spot)
- Daisy Jones & the Six landed **4★** together (predicted 4★ — exact hit; "easy to binge and watch multiples"), hitting the ~4★ ceiling exactly — the binge-momentum is the together win, not a mystery hook this time.
- *The Last Thing He Told Me* — enjoyed together, but NOT yet in the library

**Why it works:** female-led prestige relationship drama almost always built on a **mystery / domestic-thriller hook** (a murder, an arson, an amnesia, a missing husband) = propulsion + relatable leads = Helen's sweet spot. Daisy Jones swaps the thriller hook for pure **bingeable momentum** and still lands 4★, so the floor is the *propulsion + relatable leads*, not the mystery specifically. Treat Hello Sunshine as a safe **3.5-4★ together** pick — a dependable floor, ceiling ~4★ (not a 4.5★ smash).

### Schur / Greg-Daniels "Office-lineage" workplace comedy → near-lock SOLO, ~4.4★
- The Office (US) 5★ · Parks and Recreation 5★ · Brooklyn Nine-Nine 4.5★ · The Good Place 4★ · The Paper 4★ · Superstore 4★ (Office-alum Justin Spitzer)
- **The two 5★s are the ceiling of this lane, not its average — and they are closed.** The Paper is the same creator, format and universe and landed 4★. Predict new entries at 4-4.5★; see **Predicting a 5★** above.
- **Exception:** a heartwarming/gentle (NOT silly) register flips it TOGETHER — A Man on the Inside S1 4★. The crime backbone is incidental; B99 is a silly crime-comedy and stays solo (see Schur exception above).

### The guardrail: it's the FORMAT, not the byline
The signal breaks the moment the creator leaves their signature format, or it's a brand remake by other hands:
- **Greg Daniels outside workplace comedy:** Upload 3.5★ (sci-fi), Space Force **2.5★ dropped** — the magic didn't transfer.
- **Brand remake, different creators:** The Office (AU, 2024) **2★** — the name guarantees nothing without the people/format.

So: use creator/studio as a strong *prior*, then anchor on the actual format + tone, not the byline alone. (Mirrors the writer/auteur tone signal — e.g. Richard Gadd → dark psychological → solo.)

---

## Prediction Formula

```
predicted_rating = (IMDB / 2) - 0.5★ + modifiers
```

Base: IMDB/2 minus 0.5★ (validated by 12-show sample showing -0.54★ overprediction at -0.3★).

### Positive Modifiers

| Pattern | Adjustment |
|---------|------------|
| Psychological complexity (Severance-like) | +0.5★ |
| Workplace comedy / ensemble format | +0.5★ |
| Jaw-drop reveals/twists potential (solo) | +0.5★ |
| Australian content (stated preference) | +0.5★ |
| Purposeful difficulty with cultural moment | +0.3★ |
| True story | +0.3★ |
| Limited/complete series | +0.3★ |
| 4+ seasons (longevity signal) — ONLY with a serialised arc or comfort-rewatch status; never on a cold start into an episodic back-catalogue | +0.3★ |
| WWII setting (together) | +0.3★ |
| Mockumentary style | +0.3★ |
| Established 2000s/early 2010s classic | +0.2★ |
| High predicted bingeability (4-5) — PROVISIONAL, see Bingeability | +0.2 to +0.3★ (never lifts a prediction above 4★) |
| Mystery/spy/crime (together) | +0.2★ |
| Pure comedy (no drama tag) | +0.2★ |
| "Easy watch" (together) | +0.2★ |
| Procedural format (together) — requires a serialised spine (season arc / hidden identity / ongoing mystery); pure case-of-the-week gets nothing | +0.2★ |

### Negative Modifiers

| Pattern | Adjustment |
|---------|------------|
| Dark character study, not mystery (Happy Valley effect) | -1.0★ |
| Punishing difficulty, must skip scenes | -1.0★ or SKIP |
| Cancelled/unresolved | -0.5★ |
| Slow-burn/experimental in plot-driven genres | -0.5★ |
| Style over substance risk | -0.5★ |
| "Nothing happens" / weak payoffs risk | -0.5★ |
| Bleak crime, no comedy buffer (together) | -0.5★ |
| Serial killer / studying evil (together) | -0.5★, consider SOLO |
| Animation without franchise hook | -0.5★ |
| Comedy + Action hybrid | -0.5★ |
| Crude humor (together) | -0.5★ or switch to SOLO |
| Low predicted bingeability (1-2) — PROVISIONAL, see Bingeability | -0.3 to -0.5★ |
| New-series volatility (1 season, predicted 4.5★) | -0.3★ (weaker if core sweet spot) |

### Context Rules

- **Spy thriller pacing:** Night Manager predicted 4.5★, S1 landed 3.5★ ("two episodes shorter") → re-rated **4★** after S2 (Helen + Tim "really enjoyed Season 2," awaiting S3). Slow Horses succeeds via tight pacing + Jackson Lamb. Pacing bloat dents spy thrillers but a strong later season can recover them.
- **Together procedural ceiling:** Cap at 4★ (The Pitt predicted 4.5★ → got 4★)
- **Low commitment bonus:** Short limited series (3-6 eps) worth recommending at lower thresholds — and short length also *buffers bleak content* for together viewing (Time 3.5★ together, 3 eps)
- **Dark prestige → default SOLO**
- **True story preferred** over alt-history
- **Show status:** Ended 3.66★, Returning 3.64★, Canceled 3.26★ (danger)

---

## Bingeability

A second rating axis, tracked separately from the star rating since Aug 2026. **1-5 integers, user-entered in the app** (`bingeability` column; `predictedBingeability` holds the AI estimate). It measures how easily the show is watched — deliberately NOT how good it is.

| | Label |
|---|---|
| **5** | Couldn't stop - wanted to keep going |
| **4** | Very easy to keep watching |
| **3** | Easy enough, watched steadily |
| **2** | Needed effort to keep going |
| **1** | A struggle to get into |

**Recording convention (decided Sep 2026):** ONE score per show, not a hook/sustain split. The number is a **blend**; when a show's start and finish differ, that shape goes in the review note ("slow start, unstoppable finish"). Do not add a second numeric field — this was considered and rejected as over-engineering.

> **STATUS (2026-09-09, rev 2): 80 shows scored — the axis is VALIDATED as a distinct signal, the WEIGHTS are not.** The scored set is deliberately skewed to shows Tim rated 3-5★ (only one show at 3★, none below, no dropped shows), and he has decided **not** to score the low end. Two consequences, both permanent: (1) the negative weights can never be validated, so they are **retired** rather than pending — low-hook risk is carried by the structural modifiers instead; (2) with only 3 of the 80 scored shows holding a stored Trakt score, whether bingeability adds anything **over** IMDB/Trakt is untestable, so the positive weights stay PROVISIONAL and out of the formula.
>
> **The axis has one validation point (updated 2026-09-10): n=1, exact.** Malcolm in the Middle: Life's Still Unfair was predicted binge **5** and scored **5** — the first time a stored `predictedBingeability` has ever met a user score, and the note matches the predicted reasoning ("Super easy binge... very easy to watch quickly" vs "four episodes total, the lowest commitment in the entire library"). Before this the overlap was ZERO. **One point derives nothing**: it cannot move the weights, cannot establish MAE, and does not lift the PROVISIONAL status above. Do NOT read the gap between the predicted distribution (mean 3.74; 16% at 5) and the scored distribution (mean 4.19; 44% at 5) as predictor bias: the scored set is **completion-selected** — Tim scores only shows he finished, and finishing is itself selected on high bingeability — while the predicted set is mostly unwatched watchlist. No blanket recalibration is justified from that comparison; only rule-driven, per-show changes are. The overlap grows only as scored shows happen to carry an earlier prediction, so treat each new one as a data point to log, not as licence to re-weight.

### Why it is a separate axis

Measured on the 80 scored shows (Sep 2026, rev 2):

| Metric | Value |
|---|---|
| r (bingeability vs star rating) | **0.58** (r² = 0.34) |
| Bingeability spread (sd) | **0.83** — range 2-5 used |
| Star spread (sd), same shows | **0.36** — nearly all on 4★ |
| Score distribution | 5: 35 · 4: 26 · 3: 18 · 2: 1 · 1: 0 |

**The axes are correlated, NOT orthogonal** — and since the scored set spans only 3-5★, range restriction *attenuates* r, so the true library-wide figure is likely higher. But bingeability still discriminates where the star scale cannot: on shows rated almost identically, it varies more than twice as much. That is the point of it. (Context: 128 of 214 rated shows sit at 3.5★ or 4★, so the star scale has ~1.5★ of usable range.)

**CORRECTION — the earlier "orthogonal at the top" claim was wrong.** It was built by mining review notes for binge language and reading *silence* as evidence of low bingeability. Every show cited as proof went the other way once actually scored: Dark 4, Sherlock 4, and Foundation, The Crown, Murderbot and Pluribus all **5**. Absence of binge language in a note means nothing. Do not infer this axis from note text.

### The real structure: sustain vs hook

The single score blends **hook** (how fast it grabs) and **sustain** (whether you can stop once in). Three shows state the split explicitly: **Dark** 4.5★/binge 4 ("super bingeable at the end… the start took a little to get into — that's why bingeability isn't 5 star"), **Homeland** 4★/binge 4 ("start of seasons were often a slow grind but the end is always hard to stop watching"), **The Handmaid's Tale** 4★/binge 5 ("five star bingeable at the end of seasons although not always at the start").

The two halves predict **opposite** things:

- **Sustain is NECESSARY for a top rating.** All 21 shows rated ≥4.5★ score binge ≥4 — no exceptions. The three at 4 rather than 5 (Dark, Sherlock, The Great) are hook-limited, not sustain-limited.
- **Sustain is NOT SUFFICIENT.** Binge 5 spans 4★ (17 shows), 4.5★ (13) and 5★ (5). A compulsive watch is often just a 4★.
- **Hook predicts ABANDONMENT, not quality.** Monk 3★ ("haven't been able to jump on board after about 8 episodes") and Ghosts 3★ ("reaching for other shows") both failed on hook. But **Dark had a weak hook and still landed 4.5★** — because the payoff was real.

**The score is a run-AVERAGE across seasons — not a peak, not a final state (added Sep 2026).** Both new scores say so in the note, unprompted: **Upload** 3.5★/binge **3** ("Earlier seasons were higher in bingeability than the later seasons, so it averaged to a 3") and **Westworld** 3★/binge **3** ("...average to a 3"). A front-loaded show is scored on the whole run Tim actually watched, so a strong S1 does not carry it. This is a third dimension on top of hook and sustain, and it only ever pushes **down**.

- **Momentum decline ≠ quality decline — only momentum drags the average.** **The Crown** declined in quality by its own note ("started to get a little less good as it went on") and still scored **5**. **Sherlock** ("the last season wasn't quite as good") scored **4**, and that is hook-limited, not decay. Westworld and Upload lost *momentum* — the reveals and stakes stopped paying — which is the thing that averages down.
- **Operational test.** Drop ONE level from the peak-momentum estimate when BOTH hold: (a) the run is ≥ 4 seasons, or ≥ 3 with a notorious mid-run collapse; AND (b) the later-run complaint is about **momentum/resolution** (stalling, spinning wheels, reveals that never land, formula fatigue) rather than **quality** (weaker writing, cast changes, less prestige). If the complaint is quality-only, hold the score — that is the Crown precedent. Per-season-closed structures (anthology, one case per series) are exempt: momentum resets rather than decays.
- **Westworld is the counter-example to "withholds answers by design = 5".** It is the strongest-hook serialised mystery box in the library and it scored **3**, because the questions kept accumulating across four seasons without resolving. A mystery box earns top marks only when it *resolves* (Dark 4, Severance 5, Silo 5, Stranger Things 5) or closes per season (Black Mirror 5, White Lotus shape). An open-ended question engine is a run-average **risk**, not an automatic 5.
- **Length alone is not decay.** Seven-plus seasons still score 5 when momentum holds: Gilmore Girls 5 (7 seasons, weak S7), The West Wing 5, The Office 5, Parks and Recreation 5, The Rookie 5, Brooklyn Nine-Nine 5. Do not dock for season count — dock only for a momentum complaint.
- **The 4/5 boundary is noisy.** **The Diplomat** (binge **4**) and **The Handmaid's Tale** (binge **5**) carry near-identical notes ("five star bingeable at the end of seasons although not always at the start"). Treat a one-level difference at the top as within noise, and do not fine-tune predictions there.

### The ramp — every bingeability reason must say WHEN it picks up

User-requested, Sep 2026: *"sometimes it's helpful if I need to get through the first
few episodes before it starts to get good."* Hook and sustain are already tracked
above, but the single 1-5 score hides the thing that actually decides whether a slow
show gets watched — **how long the patience window is, and whether it pays**.

**Every `predictedBingeabilityReason` MUST end with a ramp clause in one of these four
fixed forms.** No improvising a fifth:

| Form | Use when | Example |
| ---- | -------- | ------- |
| `Grabs from ep 1.` | hook ≈ sustain, no patience needed | most comedies, procedurals |
| `Slow open — picks up from ep N; worth it.` | weak hook, real payoff waiting | Dark (binge 4, "the start took a little to get into") |
| `Slow open — picks up from ep N, but the payoff is thin.` | weak hook, no arc behind it | Monk (binge-equivalent 3, abandoned at ep 8) |
| `Front-loaded — strongest early, fades from S N.` | hook fine, run-average drags it down | Upload, Westworld (both scored 3 on exactly this) |

Rules for the clause:

- **Give a number, not an adjective.** "Picks up from ep 3" is usable; "picks up
  eventually" is not. If the real answer is a season boundary, say `picks up from S2`.
- **The ramp is about the HOOK; the verdict is about the PAYOFF.** They can disagree,
  and when they do that disagreement is the useful part — a weak hook with a real
  payoff is *commit*, a weak hook with nothing behind it is *don't force it*. This is
  the same split the stick-with-it verdict in the star reason expresses; keep the two
  consistent within a show.
- **Never dock the star rating for a slow start alone** — the ceiling rule and the
  payoff check below still govern. The ramp is navigation, not a penalty.

**Therefore: a weak hook is only a drag when there is no payoff waiting.** Never cap a prediction for slow-start alone — check the payoff signal first (jaw-drop reveals/resolution is a stated core love). This is exactly what the stick-with-it verdict in the prediction reason exists to express: "weak hook, but commit — the payoff is real" (Dark) vs "weak hook, nothing coming — don't force it" (Monk).

Observed mean star rating by level, for reference (selection-biased, do not read as weights): binge 3 → 3.83★ (n=18) · binge 4 → 4.04★ (n=26) · binge 5 → 4.33★ (n=35).

### Weights — NOT in the formula

| Predicted bingeability | Status |
|---|---|
| 5 | +0.3★ **provisional, not applied** (observed gap over binge-3 baseline: +0.42) |
| 4 | +0.2★ **provisional, not applied** (observed: +0.13) |
| 3 | 0 |
| 2 / 1 | **RETIRED** — cannot be validated (low end will not be scored); use the structural hook proxies below instead |

**Do not add a bingeability term to the prediction formula.** It would risk double-counting what the IMDB/Trakt base already captures, and that overlap is currently untestable. Bingeability's role is **diagnostic and interpretive**: it explains prediction misses and sharpens the stick-with-it verdict.

**Hook proxies (these ARE in the formula).** Low-hook risk is already carried by the structural modifiers, which is why no separate bingeability penalty is needed: the conditional 4+ seasons longevity bonus, the conditional together-procedural bonus (serialised spine required), the "nothing happens"/weak-payoffs penalty, and drop pattern 8 (quiet abandonment). Estimate `predictedBingeability` from the same structure — serialised spine vs pure case-of-the-week, episode length, cold-start back-catalogue size, momentum — and record it as commentary only.

**Ceiling rule (retained):** high bingeability alone never justifies a prediction above 4★. A 4.5★+ call needs a separate craft/payoff signal — that is the "not sufficient" half above.

---

## Rating Source Correlations

| Source | Correlation | Use |
|--------|-------------|-----|
| IMDB | 0.46 | Primary |
| Trakt | 0.47 | Primary |
| TMDB | 0.43 | Backup |
| RT Critics | 0.18 | Ignore |
| RT Audience | 0.13 | Ignore |

RT scores measure consensus, not quality. Many dropped shows had 95%+ RT scores.

### RT Critics vs Audience Divergence (when 20+ point gap)

| Genre | Side With | Record | Action |
|-------|-----------|--------|--------|
| Sci-Fi/Fantasy | Critics | 9-0 | Trust critics, ignore low audience |
| Drama | Critics | 15-7 | Usually critics |
| Action/Adventure | Critics | 6-1 | Trust critics |
| Comedy | Mixed | 3-2 | Case by case |
| **Mystery/Crime** | **Audience** | **0-4** | Low audience = real warning |

---

## Prediction Reason Format

- **Start with rating**: "Predicted X★: [reasoning]"
- **Length**: 400-600 characters with contextualized reasoning
- **Reference similar shows** with ratings: "Similar to Shrinking (4★) and Hacks (3.5★)"
- **Include series status**: COMPLETE, CANCELLED, Returning, LIMITED
- **Flag risk factors** with episode trial guidance:
  - Character-driven: "Give it 3-4 episodes"
  - Slow-burn/complex: "Commit to 4-5 episodes"
  - Procedurals/comedies: "2 episodes is enough to know"
  - Together with Helen-risk factors: "Strict 2-episode test"
- **Explain solo/together reasoning**
- **Give a stick-with-it verdict** — say whether persisting past a slow start is worth it, and why. State the patience window as an episode number where one exists ("slow until ep 3, then commit"), and keep it consistent with the ramp clause in the bingeability reason (see **The ramp**). This is separate from bingeability: a low-binge show with real payoffs earns "commit, it pays off" (Dark 4.5★, an explicit slow burn); a low-binge show with no arc earns "don't force it" (Monk 3★). Where the two disagree, say so.
- **DO NOT mention streaming platform names** (predictions are platform-agnostic)

**Example** (490 chars):
"Predicted 4★: Seth Rogen and Rose Byrne duo comedy about rekindled friendship. Similar to Hacks 3.5★ (edgier duo comedy, solo viewing). Seth Rogen's comedy style tends toward adult/crude humor - The Studio is also solo for this reason. Not a light easy-watch like Nobody Wants This 4★. The 'destabilizing lives' premise suggests messier adult situations. Duo comedies with edge land 3.5-4★ for you. RT 96% but you diverge on comedy. Season 2 returning. Solo viewing - Seth Rogen's style isn't Helen's niche."

---

## Genre Combinations

**Best:** Drama + Sci-Fi 3.86★, Comedy + Crime 3.75★, War & Politics 3.86★
**Worst:** Action + Comedy 2.50★, Action + Crime 2.83★

## Completion Risk

| Predicted Rating | Drop Risk |
|------------------|-----------|
| 3.5★+ | ~0% |
| 3★ | 17% |
| 2.5★ | 65% |
| 2★ | 100% |

If base calculation yields <3★, seriously consider whether to recommend at all.

## Platform Quality Tiers (minor consideration)

Top: Max, Paramount+, Netflix (3.70-3.75★) | Mid: Disney+, Apple TV+, Stan (3.55-3.58★) | Lower: Prime Video (3.31★)

## Prediction Accuracy (May 2026)

**25-show validated sample (Sep 2026):** MAE: 0.54★ (target ~0.5★) | Bias: -0.30★ (formula already corrects via -0.5★ term) | Within 0.5★: 76%

**Range restriction (measured Aug 2026):** 128 of 214 rated shows sit at 3.5★ or 4★ — 60% inside a half-star band, with only 5 shows ever at 5★. The star scale has ~1.5★ of usable range in practice, so an MAE of 0.57★ is worse than it looks. This is the main argument for tracking bingeability as a second, less compressed axis (see **Bingeability**).

**Key lessons:**
- Happy Valley (-2.5★): Led to "purposeful difficulty" framework
- Night Manager: predicted 4.5★, S1 felt two eps too long (3.5★), but S2 lifted it to 4★ (net -0.5★) — pacing bloat dents but doesn't sink a spy thriller that recovers
- The Pitt (-0.5★): Together procedural ceiling at 4★
- The Four Seasons (+0.5★): Slow pacing CAN work with likeable characters + light tone
- Normal People: solo prediction correct; the together attempt was a 2-episode DROP (Helen-fit fail, "nothing happening"). Its 2.5★ is a together-drop, NOT a solo verdict — Tim may still try it solo. Now marked dropped.
- Pluribus (exact): Hit psychological sci-fi sweet spot despite new-series volatility
- **Time (exact rating, watch-mode over-flip)**: predicted 3.5★ → rated 3.5★ together. Rating bang-on; but I'd flipped it to solo on bleak-risk and it worked **together** — the 3-ep length buffered the bleakness. Don't flip short bleak limiteds to solo.
- **A Man on the Inside (exact)**: Schur-warm-exception rule validated — Comedy + Crime backbone + gentle register overrode the Schur-solo default. Predicted 4★ together, rated 4★ together.
- **Daisy Jones & the Six (exact)**: predicted 4★ together → rated 4★ ("easy to binge and watch multiples"). Validates the Hello Sunshine 3.5-4★ floor (now n=6, none dropped) and refines the *why*: pure bingeable momentum + relatable leads carries it even without a mystery/thriller hook. Hits the ~4★ ceiling, not above it.
- **Rosehaven (together rec missed)**: Recommended together on "Australian + light tone"; Helen hated it (pointless/boring, annoying lead). Pure character comedy with no genre backbone = SOLO. Corrected to solo. Don't over-apply the Schur warm-exception to backbone-less comedies.
- **Wonder Man (+0.5)**: predicted 3.5★ → rated 4★ solo (call exact). Marvel completionist plus *personal relatability* (film sets, self-tapes — "felt like I was watching an acting class") lifted it above prediction; "the right amount of quirky" confirms quirky is fine SOLO — the quirky penalty is a together/Helen problem (Rosehaven), not a Tim problem.
- **Broadchurch (exact)**: predicted 4★ → rated 4★ together. Together crime-procedural sweet spot validated at its 4★ ceiling — "I would not watch it on my own but love watching with Helen" is the together-lane thesis in one quote.
- **Alice and Steve (+0.5, pref flip)**: predicted 3.5★ solo → rated 4★ **together** ("really easy binge"; Helen "laughed her head off... loves the Kiwi humor of Jemaine Clement"). Cringe/icky premise ≠ Rosehaven-quirky — the operative dial is the humor register: dry-deadpan leads + relatable midlife friendship/parent stakes + 6-ep binge momentum are together strengths. Don't let critic tone-reads ("icky", "exasperating") outrank the silliness dial and momentum signals.
- **Ghosts (-1.0, pref flip)**: predicted 4★ together → rated 3★ **solo**. Pure validation of two existing rules the Feb-2026 prediction predated: the `Sci-Fi + Comedy → SOLO` branch, and the silliness dial ("the premise is too silly for Helen" — verbatim). Second error: it justified 4★ with **Fisk, a *together* comp**, for a show that is solo. Match the comp class to the watch mode — Tim's solo-comedy bar is Parks/Office/B99, and against that bar "a little bit funny" is 3★.
- **Monk (-1.0)**: predicted 4★ → rated 3★ together, watch mode correct. Three modifiers over-fired at once (4+ seasons +0.3, established classic +0.2, procedural +0.2) on a show that is **purely episodic**. "The show doesn't seem to go anywhere… storytelling feels dated… perhaps it would have been better if we watched it when it was airing." Note the hypothesis this *refutes*: old + long-running is NOT a penalty — The West Wing 5★, Parks 5★, Office 5★, Sherlock 4.5★, Grey's 4★ (22 seasons), Gilmore Girls 4★, The Good Wife 4★ are all pre-2015 with 4+ seasons. The discriminator is the **serialised spine**, not age or length.
- **Matlock (+0.5)**: predicted 3.5★ → rated 4★ together. Same lane and same week as Monk, opposite result, and the reason is explicit in the note: "an easy binge to get straight into… we enjoy the intrigue" vs Monk's "doesn't seem to go anywhere". Also the **first counter-example to the Mystery/Crime "side with audience" rule** (RT 91 critics / 65 audience, still 4★) — record now 1-4. Noted, not overturned.
- **Star Trek: Starfleet Academy (exact)**: predicted 3.5★ → rated 3.5★ solo. Validates holding the Trek franchise floor against a cold audience signal (Trakt 6.3) rather than following it down, and the "sci-fi is never Helen's lane" default.
- **All Her Fault (exact)**: predicted 4★ together → rated 4★ **together**, both rating and watch mode right. Validates the domestic-thriller-together shape end to end: a withheld-answer abduction hook + a relatable mother lead + a contained 8-episode ENDED run, with **no bleak penalty applied** despite child-abduction content. Confirms the "dark but purposeful and contained" carve-out (Adolescence 4★, Little Fires Everywhere 4★) rather than the bleak→solo default.
- **Malcolm in the Middle: Life's Still Unfair (+0.5)**: predicted 3.5★ → rated 4★ solo, watch mode correct. Under-predicted because nothing in the modifier table rewards **nostalgia revival at very low commitment** — "Super easy binge and fun nostalgia it was very easy to watch quickly". A four-episode revival of a comfort show is closer to the comfort-rewatch register (Parks 5★, Office 5★) than to an unproven new comedy. Calibration note only, n=1 — do not add a modifier until a second revival lands.

### Library audit (May 2026)

Reviewed all 170 shows rated 3★+ against their predictions. Only ~14 rated shows had a prior prediction to score against; findings:

- **Over-prediction is concentrated in the TOGETHER lane.** Almost every negative miss was a together show: Happy Valley (-2.5), AU The Office (-1.5, solo), Bad Sisters (-1.0), The Flight Attendant (-1.0), The Pitt/Manhunt/Quiz/Night Manager (-0.5 each). The two *under*-predictions were Mad Men (+0.5) and The Four Seasons (+0.5). This is the variance finding in action — the together misses are disappointment/drop-risk we didn't catch, not a systematic scale error.
- **Watch-mode misses: Rosehaven and Time (the latter self-inflicted).** Mad Men and Normal People *vindicate* the solo call: Mad Men was watched **solo first** (pre-Helen), then enjoyed on a **together rewatch** (works both ways; rewatch = positive signal); Normal People was a **2-episode together drop** (Helen-fit fail) — solo prediction correct, the 2.5★ is a together-drop not a solo verdict. The genuine errors: **Rosehaven** (predicted together, is solo) and **Time** — which I over-flipped *to* solo on bleak-drop-risk grounds, but it landed 3.5★ **together** (the 3-ep length buffered the bleakness, see short-buffer caveat above). Lesson: solo/together is the hardest call; don't over-correct off a rule (bleak→solo) without weighing length/commitment.
- **Gentle comedy together — the deciding factor is likeable/relatable characters, not tone.** The Four Seasons 4★ together (couples relationship dramedy Helen relates to) vs Rosehaven together-fail (quirky character comedy, lead Helen found "annoying"). Warm + light ≠ together; *relatable characters* = together.
- **Minor watch-mode outliers in the data** (the user's actual choices, kept as ground truth): 30 Rock and After Life were watched **together** (3.5★ each) despite being workplace/dark comedy that normally default solo — consistent with "together is high-variance; these landed mid," not rule-breakers.
- **5★ list and core genre splits still accurate** against the live DB.

**In-progress:**
- Bad Sisters being re-watched — original 3★ rating may change.
- Rosehaven being watched **solo** by Tim — unrated (wants a few more episodes); together rec already corrected to solo.
- Mad Men recommendation left as "solo" — correct (original watch was solo); it also works as a together rewatch. Not a field to "fix".
