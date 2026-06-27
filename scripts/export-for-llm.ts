import { db, shows } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function exportForLLM() {
  const allShows = await db.select().from(shows);

  // Get unrated shows with predictions
  const unratedWithPredictions = allShows
    .filter(s => s.predictedRating !== null && s.rating === null);

  // Top 20 overall
  const top20 = unratedWithPredictions
    .sort((a, b) => (b.predictedRating || 0) - (a.predictedRating || 0))
    .slice(0, 20);

  // Helper to get top 10 for a service
  const getTopForService = (serviceSlug: string) => {
    return unratedWithPredictions
      .filter(s => s.streamingServices?.includes(serviceSlug))
      .sort((a, b) => (b.predictedRating || 0) - (a.predictedRating || 0))
      .slice(0, 10);
  };

  const appleTV = getTopForService('apple-tv-plus');
  const stan = getTopForService('stan');
  const max = getTopForService('max');

  console.log('Top 20 Overall:');
  for (const s of top20) {
    console.log(`  ${s.predictedRating}★ ${s.title} (${s.recommendedWatchPreference})`);
  }

  console.log('\nTop 10 Apple TV+:');
  for (const s of appleTV) {
    console.log(`  ${s.predictedRating}★ ${s.title} (${s.recommendedWatchPreference})`);
  }

  console.log('\nTop 10 Stan:');
  for (const s of stan) {
    console.log(`  ${s.predictedRating}★ ${s.title} (${s.recommendedWatchPreference})`);
  }

  console.log('\nTop 10 Max (HBO):');
  for (const s of max) {
    console.log(`  ${s.predictedRating}★ ${s.title} (${s.recommendedWatchPreference})`);
  }

  // Read the taste profile from CLAUDE.md
  const claudeMd = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');

  // Extract the Taste Profile section
  const tasteProfileMatch = claudeMd.match(/## Taste Profile[\s\S]*?(?=\n## [A-Z]|$)/);
  const tasteProfile = tasteProfileMatch ? tasteProfileMatch[0] : '';

  // Helper to format a show entry
  const formatShow = (s: typeof top20[0]) => `### ${s.title}

| Field | Value |
|-------|-------|
| **Predicted Rating** | ${s.predictedRating}★ |
| **Watch Preference** | ${s.recommendedWatchPreference || 'Not specified'} |
| **Genres** | ${(s.genres || []).join(', ')} |
| **IMDB** | ${s.imdbRating || 'N/A'} |
| **RT Critics/Audience** | ${s.rtCriticsScore || 'N/A'}% / ${s.rtAudienceScore || 'N/A'}% |
| **Seasons** | ${s.numberOfSeasons || 'N/A'} |
| **Status** | ${s.showStatus || 'N/A'} |
| **Streaming** | ${(s.streamingServices || []).join(', ') || 'N/A'} |

**Current Prediction Reason:**
${s.predictedRatingReason || 'No reason provided'}

**Your Assessment:**
[Review this prediction against the taste profile]

---

`;

  // Build the output
  let output = `# TV Recommendation Review Prompt

## Instructions for LLM

You are reviewing TV show predictions for a user named Tim who watches shows both solo and together with his wife Helen.

**Your task:**
1. Review each predicted show below
2. Based on the detailed taste profile provided, evaluate whether the predicted rating and watch preference (solo/together) are accurate
3. For each show, provide:
   - Your assessment of the predicted rating (agree, or suggest adjustment with reasoning)
   - Your assessment of the solo/together recommendation
   - Any red flags based on the taste profile patterns
4. Pay special attention to:
   - The "Happy Valley effect" (dark character studies predicted too high)
   - The "comedy buffer" pattern for crime/mystery shows
   - Helen's tolerance for dark content (lower than Tim's)
   - The "purposeful difficulty" framework for challenging content
   - Tim's love of jaw-drop reveals and twists
   - The "together veto" dynamic (both Tim and Helen need to enjoy it)

---

## Top 20 Predicted Shows (Overall)

`;

  for (const s of top20) {
    output += formatShow(s);
  }

  // Add Apple TV+ section
  output += `
---

## Top 10 Apple TV+ Shows

`;

  // Deduplicate - don't include shows already in top 20
  const top20Ids = new Set(top20.map(s => s.tmdbId));
  const appleUnique = appleTV.filter(s => !top20Ids.has(s.tmdbId));

  if (appleUnique.length === 0) {
    output += `*All top Apple TV+ shows are already in the Top 20 above.*\n\n`;
  } else {
    for (const s of appleUnique) {
      output += formatShow(s);
    }
  }

  // Add Stan section
  output += `
---

## Top 10 Stan Shows

`;

  const stanUnique = stan.filter(s => !top20Ids.has(s.tmdbId));

  if (stanUnique.length === 0) {
    output += `*All top Stan shows are already in the Top 20 above.*\n\n`;
  } else {
    for (const s of stanUnique) {
      output += formatShow(s);
    }
  }

  // Add Max/HBO section
  output += `
---

## Top 10 Max (HBO) Shows

`;

  const maxUnique = max.filter(s => !top20Ids.has(s.tmdbId));

  if (maxUnique.length === 0) {
    output += `*All top Max/HBO shows are already in the Top 20 above.*\n\n`;
  } else {
    for (const s of maxUnique) {
      output += formatShow(s);
    }
  }

  output += `
---

${tasteProfile}
`;

  // Write the output file
  const outputPath = path.join(process.cwd(), 'docs', 'llm-review-prompt.md');
  fs.writeFileSync(outputPath, output);
  console.log(`\nExported to: ${outputPath}`);
}

exportForLLM();
