# Rating Comparison Analysis

**Generated:** 2026-01-10
**Shows Analyzed:** 180 rated shows

---

## Executive Summary

Your ratings show **moderate correlation** with IMDB and Trakt (~0.47), and **weak correlation** with Rotten Tomatoes (~0.15-0.18). This means:

- **IMDB/Trakt** are decent predictors of what you'll enjoy
- **RT scores** tell you very little about whether *you* will like a show
- You're about **0.3★ more critical** than the average viewer

---

## Correlation Rankings

| Rank | Source | Correlation | Sample Size | Interpretation |
|------|--------|-------------|-------------|----------------|
| 1 | **Trakt** | 0.473 | 180 | Moderate - useful predictor |
| 2 | **IMDB** | 0.463 | 180 | Moderate - useful predictor |
| 3 | **TMDB** | 0.427 | 180 | Moderate - useful predictor |
| 4 | **RT Critics** | 0.178 | 163 | Weak - poor predictor |
| 5 | **RT Audience** | 0.135 | 163 | Weak - poor predictor |

### Correlation Guide
- **0.7+** = Strong (highly predictive)
- **0.4-0.7** = Moderate (useful predictor)
- **0.2-0.4** = Weak (some value)
- **<0.2** = Very weak (essentially random)

---

## Your Rating Tendency

| Source | Your Avg | Source Avg | Difference |
|--------|----------|------------|------------|
| IMDB | 3.62★ | 3.95★ | -0.33★ |
| Trakt | 3.62★ | 3.88★ | -0.26★ |
| TMDB | 3.62★ | 3.81★ | -0.19★ |
| RT Critics | 3.64★ | 4.27★ | -0.62★ |
| RT Audience | 3.65★ | 3.96★ | -0.31★ |

*All normalized to 5-star scale for comparison*

**Key insight:** You rate about 0.2-0.3 stars lower than crowd aggregates across all platforms.

---

## Your Rating Distribution

| Rating | Count | Bar |
|--------|-------|-----|
| 5★ | 5 | █████ |
| 4.5★ | 14 | ██████████████ |
| 4★ | 68 | ██████████████████████████████████████████████████ |
| 3.5★ | 43 | ███████████████████████████████████████████ |
| 3★ | 33 | █████████████████████████████████ |
| 2.5★ | 16 | ████████████████ |
| 2★ | 1 | █ |

---

## Biggest Disagreements

### Shows You Rated Lower Than the Public ("Overrated")

| Show | Your Rating | IMDB | Trakt | TMDB |
|------|-------------|------|-------|------|
| Mindhunter | 2.5★ | 8.6 | 8.4 | 8.1 |
| Normal People | 2.5★ | 8.4 | 8.2 | 8.1 |
| MobLand | 2.5★ | 8.3 | 8.4 | 8.4 |
| War and Peace | 2.5★ | 8.1 | 7.8 | 7.6 |
| Mr. & Mrs. Smith | 2★ | 7.0 | 7.0 | 6.5 |
| A League of Their Own | 2.5★ | 7.6 | 8.1 | 6.8 |
| The Artful Dodger | 2.5★ | 8.0 | 7.9 | 8.0 |
| Lupin | 2.5★ | 7.5 | 7.6 | 7.7 |

### Shows You Rated Higher Than the Public ("Underrated Gems")

| Show | Your Rating | IMDB | Trakt | TMDB |
|------|-------------|------|-------|------|
| Murderbot | 4.5★ | 7.4 | 7.4 | 7.3 |
| Foundation | 4.5★ | 7.6 | 7.8 | 7.7 |
| Parks and Recreation | 5★ | 8.6 | 8.5 | 8.0 |
| Severance | 5★ | 8.7 | 8.6 | 8.4 |
| Star Trek: Lower Decks | 4.5★ | 7.8 | 7.9 | 7.6 |
| Ten Percent | 4★ | 7.0 | 6.6 | 5.5 |
| The Office | 5★ | 4.6 | 5.4 | 5.5 |
| Total Control | 4★ | 7.9 | 7.3 | 5.6 |
| The West Wing | 5★ | 8.9 | 8.9 | 8.3 |

### RT Critics Disagreements

*Shows where RT Critics score differs most from your opinion*

| Show | Your Rating | RT Critics | Gap |
|------|-------------|------------|-----|
| Lupin | 2.5★ | 98% | -2.4★ |
| Ms. Marvel | 2.5★ | 98% | -2.4★ |
| Mindhunter | 2.5★ | 97% | -2.3★ |
| The Tick | 2.5★ | 95% | -2.3★ |
| The Underground Railroad | 2.5★ | 95% | -2.3★ |
| Truth Be Told | 3.5★ | 15% | +2.8★ |
| All the Light We Cannot See | 4★ | 28% | +2.6★ |
| Surface | 3★ | 20% | +2.0★ |
| What If...? | 4★ | 44% | +1.8★ |
| The Newsroom | 4★ | 50% | +1.5★ |

---

## Why RT Scores Don't Work For You

Rotten Tomatoes measures **consensus**, not **quality**:
- A 95% score means 95% of critics said "it's good enough"
- It doesn't distinguish between "masterpiece" and "fine, I guess"
- Your dropped shows often have 95%+ RT scores (Mindhunter, Lupin, Ms. Marvel)

**IMDB/Trakt scale** (1-10) better captures *how much* people liked something.

---

## Patterns in Your Taste

Based on the disagreements:

### You Dislike (That Others Love)
- **Slow-burn prestige** (Mindhunter, Normal People, War and Peace)
- **Style over substance** (Lupin, Mr. & Mrs. Smith)
- **Cancelled/unresolved** (Big Door Prize, The Tick)

### You Love (More Than Others)
- **Workplace comedies** (Parks & Rec, The Office)
- **Psychological sci-fi** (Severance, Foundation, Murderbot)
- **Star Trek** (Lower Decks rated 4.5★ vs 7.8 IMDB = your +0.6★)

---

## Recommendations for Predicted Ratings

Based on this analysis:

1. **Use IMDB or Trakt** as the primary external signal (r~0.47)
2. **Apply your -0.3★ adjustment** (you're slightly more critical)
3. **Ignore RT scores** for prediction (r~0.15, unreliable)
4. **Flag slow-burn prestige** shows as risk factors
5. **Bonus for**: Workplace comedy, psychological sci-fi, Australian content, limited series

### Suggested Prediction Formula

```
predicted_rating = (imdb_rating / 2) - 0.3 + genre_adjustments
```

Where genre_adjustments could be:
- +0.5★ for workplace comedy
- +0.5★ for psychological sci-fi
- +0.3★ for Australian content
- -0.5★ for slow-burn prestige drama
- +0.3★ for complete/limited series

---

## Raw Data Summary

- **Total shows with ratings:** 180
- **IMDB coverage:** 180 shows
- **Trakt coverage:** 180 shows
- **TMDB coverage:** 180 shows
- **RT coverage:** 163 shows
