# Prediction Worksheet — the canonical per-show procedure

This is the ONLY procedure for producing a show prediction. It is followed by the
`/predict-new-shows`, `/rescan-predictions`, and `/review-ratings` skills.
Prerequisite: read `docs/taste-profile.md` in full BEFORE starting the first show.

For EVERY show, write the worksheet out in your response (all 6 steps, visibly).
Do not shortcut, even for shows that seem obvious.

## Step 1 — Base rating source

Use the first available, and state which one you used:

1. `imdbRating`
2. `traktRating` (if imdbRating is null)
3. `tmdbRating` (if both above are null)

If all three are null, research the show on imdb.com or Wikipedia (WebFetch is
allowed for these domains). If you still can't find a rating, STOP and ask the
user — never invent a base.

## Step 2 — Base calculation

```
base = (source_rating / 2) - 0.5
```

Example: IMDB 7.8 → base = 3.9 − 0.5 = 3.4.

## Step 3 — Modifier walk

Walk BOTH modifier tables in `docs/taste-profile.md` ("Positive Modifiers" and
"Negative Modifiers") **top to bottom**. For each row, decide: does it apply?
List every modifier that applies with a one-line justification tied to the show's
genres, overview, seasons, showStatus, or your research. Do not apply a modifier
you cannot justify in one line. Also check the "Context Rules" under the formula
(spy-thriller pacing, together procedural ceiling at 4★, short limited series,
dark prestige → solo, show status).

Research (WebFetch imdb.com / wikipedia.org) is encouraged for: premise, creator/
studio (see "Creator & Studio Signals" — Hello Sunshine, Schur/Daniels lineage),
tone (heartwarming vs zany — the Helen silliness dial), and whether the show was
cancelled unresolved.

## Step 4 — Sum, round, clamp

```
predicted = base + sum(modifiers)
```

- Round to the nearest 0.5.
- Clamp to the range 0.5–5.
- If the result is below 3★: apply the "Completion Risk" table from the taste
  profile, say so explicitly in the reason, and seriously consider whether the
  show should keep a recommendation-worthy prediction at all.

## Step 5 — Solo or together

Decide `recommendedWatchPreference` by citing the SPECIFIC rule from the
"Solo vs Together Decision Logic" section of `docs/taste-profile.md` that decides
this show (e.g. "Pure Comedy = Solo", the comedy silliness dial, "Dark content →
solo unless...", the short-buffer caveat for 3-6 ep bleak limiteds, "Mystery/spy/
crime → together"). Name the rule — don't decide on vibes. When two rules
conflict, say which one wins and why, and check the "Key lessons" /
"Library audit" sections for a precedent.

## Step 6 — Write the reason

The reason must satisfy ALL of these (scripts/apply-predictions.ts enforces most):

1. Starts exactly `Predicted X★: ` where X matches the predicted rating
   ("4", not "4.0"; "3.5" for halves).
2. Total length 400–600 characters.
3. References at least one comparable show WITH its rating, e.g.
   "Similar to Slow Horses (4.5★)". Comps must match the watch mode you're
   predicting: solo predictions use solo comps (a together-drop tells you about
   Helen-fit, not the show).
4. States series status: COMPLETE, CANCELLED, Returning, or LIMITED.
5. Flags the main risk factor with episode-trial guidance:
   character-driven → "Give it 3-4 episodes" · slow-burn/complex → "Commit to 4-5
   episodes" · procedurals/comedies → "2 episodes is enough to know" · together
   with Helen-risk → "Strict 2-episode test".
6. Explains the solo/together call.
7. NEVER mentions streaming platform names (predictions are platform-agnostic).

Reference example (490 chars):

> Predicted 4★: Seth Rogen and Rose Byrne duo comedy about rekindled friendship.
> Similar to Hacks 3.5★ (edgier duo comedy, solo viewing). Seth Rogen's comedy
> style tends toward adult/crude humor - The Studio is also solo for this reason.
> Not a light easy-watch like Nobody Wants This 4★. The 'destabilizing lives'
> premise suggests messier adult situations. Duo comedies with edge land 3.5-4★
> for you. RT 96% but you diverge on comedy. Season 2 returning. Solo viewing -
> Seth Rogen's style isn't Helen's niche.

## Output — JSON batch row

Each completed worksheet becomes one row in the batch file
(`data/prediction-batches/YYYY-MM-DD-<slug>.json`):

```json
{
  "tmdbId": 12345,
  "title": "Show Name",
  "predictedRating": 4,
  "predictedRatingReason": "Predicted 4★: ...",
  "recommendedWatchPreference": "solo",
  "changeNote": "short reason for the change log, <=120 chars"
}
```

`title` must match the DB title exactly — it's the guard against tmdbId mix-ups.

## Hard rules

- Commit to ONE final rating per show. Never a range, never options. Surface
  risks and tensions in the reason instead.
- The batch is written to the DB ONLY via
  `npx tsx scripts/apply-predictions.ts <file> [--dry-run]`. No other write path.
