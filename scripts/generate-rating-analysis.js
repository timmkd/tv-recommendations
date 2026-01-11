const fs = require('fs');
const stats = JSON.parse(fs.readFileSync('/tmp/rating_stats.json'));
const overlays = JSON.parse(fs.readFileSync('data/overlays.json')).overlays;

// Get rating distribution
const rated = overlays.filter(o => o.rating);
const dist = {};
for (const show of rated) {
  const r = show.rating.toString();
  dist[r] = (dist[r] || 0) + 1;
}

// Build markdown
let md = `# Rating Comparison Analysis

**Generated:** ${new Date().toISOString().split('T')[0]}
**Shows Analyzed:** ${rated.length} rated shows

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
| 1 | **Trakt** | ${stats.trakt.correlation.toFixed(3)} | ${stats.trakt.count} | Moderate - useful predictor |
| 2 | **IMDB** | ${stats.imdb.correlation.toFixed(3)} | ${stats.imdb.count} | Moderate - useful predictor |
| 3 | **TMDB** | ${stats.tmdb.correlation.toFixed(3)} | ${stats.tmdb.count} | Moderate - useful predictor |
| 4 | **RT Critics** | ${stats.rtCritics.correlation.toFixed(3)} | ${stats.rtCritics.count} | Weak - poor predictor |
| 5 | **RT Audience** | ${stats.rtAudience.correlation.toFixed(3)} | ${stats.rtAudience.count} | Weak - poor predictor |

### Correlation Guide
- **0.7+** = Strong (highly predictive)
- **0.4-0.7** = Moderate (useful predictor)
- **0.2-0.4** = Weak (some value)
- **<0.2** = Very weak (essentially random)

---

## Your Rating Tendency

| Source | Your Avg | Source Avg | Difference |
|--------|----------|------------|------------|
| IMDB | ${stats.imdb.avgMy.toFixed(2)}★ | ${stats.imdb.avgExt.toFixed(2)}★ | ${stats.imdb.avgDiff > 0 ? '+' : ''}${stats.imdb.avgDiff.toFixed(2)}★ |
| Trakt | ${stats.trakt.avgMy.toFixed(2)}★ | ${stats.trakt.avgExt.toFixed(2)}★ | ${stats.trakt.avgDiff > 0 ? '+' : ''}${stats.trakt.avgDiff.toFixed(2)}★ |
| TMDB | ${stats.tmdb.avgMy.toFixed(2)}★ | ${stats.tmdb.avgExt.toFixed(2)}★ | ${stats.tmdb.avgDiff > 0 ? '+' : ''}${stats.tmdb.avgDiff.toFixed(2)}★ |
| RT Critics | ${stats.rtCritics.avgMy.toFixed(2)}★ | ${stats.rtCritics.avgExt.toFixed(2)}★ | ${stats.rtCritics.avgDiff > 0 ? '+' : ''}${stats.rtCritics.avgDiff.toFixed(2)}★ |
| RT Audience | ${stats.rtAudience.avgMy.toFixed(2)}★ | ${stats.rtAudience.avgExt.toFixed(2)}★ | ${stats.rtAudience.avgDiff > 0 ? '+' : ''}${stats.rtAudience.avgDiff.toFixed(2)}★ |

*All normalized to 5-star scale for comparison*

**Key insight:** You rate about 0.2-0.3 stars lower than crowd aggregates across all platforms.

---

## Your Rating Distribution

| Rating | Count | Bar |
|--------|-------|-----|
| 5★ | ${dist['5'] || 0} | ${'█'.repeat(dist['5'] || 0)} |
| 4.5★ | ${dist['4.5'] || 0} | ${'█'.repeat(dist['4.5'] || 0)} |
| 4★ | ${dist['4'] || 0} | ${'█'.repeat(Math.min(dist['4'] || 0, 50))} |
| 3.5★ | ${dist['3.5'] || 0} | ${'█'.repeat(Math.min(dist['3.5'] || 0, 50))} |
| 3★ | ${dist['3'] || 0} | ${'█'.repeat(Math.min(dist['3'] || 0, 50))} |
| 2.5★ | ${dist['2.5'] || 0} | ${'█'.repeat(dist['2.5'] || 0)} |
| 2★ | ${dist['2'] || 0} | ${'█'.repeat(dist['2'] || 0)} |

---

## Biggest Disagreements

### Shows You Rated Lower Than the Public ("Overrated")

| Show | Your Rating | IMDB | Trakt | TMDB |
|------|-------------|------|-------|------|
`;

// Get unique overrated shows
const overratedSet = new Map();
for (const src of ['imdb', 'trakt', 'tmdb']) {
  for (const show of stats[src].overrated) {
    if (!overratedSet.has(show.title)) {
      const o = overlays.find(x => x.title === show.title);
      overratedSet.set(show.title, {
        title: show.title,
        myRating: show.myRating,
        imdb: o?.imdbRating?.toFixed(1) || '-',
        trakt: o?.traktRating?.toFixed(1) || '-',
        tmdb: o?.tmdbRating?.toFixed(1) || '-'
      });
    }
  }
}

for (const [title, data] of overratedSet) {
  md += `| ${data.title} | ${data.myRating}★ | ${data.imdb} | ${data.trakt} | ${data.tmdb} |\n`;
}

md += `
### Shows You Rated Higher Than the Public ("Underrated Gems")

| Show | Your Rating | IMDB | Trakt | TMDB |
|------|-------------|------|-------|------|
`;

// Get unique underrated shows
const underratedSet = new Map();
for (const src of ['imdb', 'trakt', 'tmdb']) {
  for (const show of stats[src].underrated) {
    if (!underratedSet.has(show.title)) {
      const o = overlays.find(x => x.title === show.title);
      underratedSet.set(show.title, {
        title: show.title,
        myRating: show.myRating,
        imdb: o?.imdbRating?.toFixed(1) || '-',
        trakt: o?.traktRating?.toFixed(1) || '-',
        tmdb: o?.tmdbRating?.toFixed(1) || '-'
      });
    }
  }
}

for (const [title, data] of underratedSet) {
  md += `| ${data.title} | ${data.myRating}★ | ${data.imdb} | ${data.trakt} | ${data.tmdb} |\n`;
}

md += `
### RT Critics Disagreements

*Shows where RT Critics score differs most from your opinion*

| Show | Your Rating | RT Critics | Gap |
|------|-------------|------------|-----|
`;

for (const show of stats.rtCritics.overrated.slice(0, 5)) {
  const o = overlays.find(x => x.title === show.title);
  md += `| ${show.title} | ${show.myRating}★ | ${o?.rtCriticsScore}% | -${Math.abs(show.diff).toFixed(1)}★ |\n`;
}
for (const show of stats.rtCritics.underrated.slice(0, 5)) {
  const o = overlays.find(x => x.title === show.title);
  md += `| ${show.title} | ${show.myRating}★ | ${o?.rtCriticsScore}% | +${show.diff.toFixed(1)}★ |\n`;
}

md += `
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

\`\`\`
predicted_rating = (imdb_rating / 2) - 0.3 + genre_adjustments
\`\`\`

Where genre_adjustments could be:
- +0.5★ for workplace comedy
- +0.5★ for psychological sci-fi
- +0.3★ for Australian content
- -0.5★ for slow-burn prestige drama
- +0.3★ for complete/limited series

---

## Raw Data Summary

- **Total shows with ratings:** ${rated.length}
- **IMDB coverage:** ${stats.imdb.count} shows
- **Trakt coverage:** ${stats.trakt.count} shows
- **TMDB coverage:** ${stats.tmdb.count} shows
- **RT coverage:** ${stats.rtCritics.count} shows
`;

fs.writeFileSync('docs/rating-analysis.md', md);
console.log('✓ Created docs/rating-analysis.md');
