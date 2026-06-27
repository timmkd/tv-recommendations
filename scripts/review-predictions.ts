/**
 * Overnight Prediction Review Script
 *
 * Triggered by Happy Valley miss (predicted 4.5★, actual 2★)
 *
 * Reviews all predictions for similar issues:
 * - Dark character studies mislabeled as mysteries
 * - "Prestige" but not entertaining
 * - Bleak content without hope/intrigue
 * - Unlikeable characters without redemption
 *
 * Run with: npx tsx scripts/review-predictions.ts
 */

import { db, shows } from '../src/lib/db';
import { eq, isNotNull, isNull } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// HAPPY VALLEY UPDATE
// ============================================

async function updateHappyValley() {
  console.log('\n=== UPDATING HAPPY VALLEY ===\n');

  const happyValley = await db.select().from(shows).where(eq(shows.title, 'Happy Valley'));

  if (happyValley.length === 0) {
    // Try partial match
    const allShows = await db.select().from(shows);
    const match = allShows.find(s => s.title?.toLowerCase().includes('happy valley'));

    if (!match) {
      console.log('ERROR: Happy Valley not found in database');
      return null;
    }

    await db.update(shows).set({
      rating: 2,
      dropped: true,
      watchPreference: 'together',
      reviewNote: 'Dropped after 1 episode. Too dark and bleak - not entertaining. The kidnapping scene was awful to watch. Tommy Lee Royce is deliberately repulsive with no redemption. This is a dark character study, NOT a mystery - you watch the crime unfold with no intrigue. Similar to Mindhunter (2.5★) - prestige darkness without entertainment value. Acting was good but that\'s not enough.',
      ratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(shows.tmdbId, match.tmdbId));

    console.log(`✓ Updated ${match.title} to 2★ dropped`);
    console.log(`  Previous prediction: ${match.predictedRating}★`);
    console.log(`  Prediction error: ${(match.predictedRating || 0) - 2}★`);
    return match;
  }

  const show = happyValley[0];
  await db.update(shows).set({
    rating: 2,
    dropped: true,
    watchPreference: 'together',
    reviewNote: 'Dropped after 1 episode. Too dark and bleak - not entertaining. The kidnapping scene was awful to watch. Tommy Lee Royce is deliberately repulsive with no redemption. This is a dark character study, NOT a mystery - you watch the crime unfold with no intrigue. Similar to Mindhunter (2.5★) - prestige darkness without entertainment value. Acting was good but that\'s not enough.',
    ratedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(shows.tmdbId, show.tmdbId));

  console.log(`✓ Updated ${show.title} to 2★ dropped`);
  console.log(`  Previous prediction: ${show.predictedRating}★`);
  console.log(`  Prediction error: ${(show.predictedRating || 0) - 2}★`);
  return show;
}

// ============================================
// RISK PATTERNS (learned from Happy Valley)
// ============================================

interface RiskPattern {
  name: string;
  description: string;
  check: (show: any) => { triggered: boolean; reason?: string };
  adjustment: number;
}

const RISK_PATTERNS: RiskPattern[] = [
  {
    name: 'dark-character-study',
    description: 'Dark character study without mystery intrigue',
    check: (show) => {
      const darkStudyShows = [
        'happy valley', 'mindhunter', 'ozark', 'breaking bad',
        'the killing', 'top of the lake', 'mare of easttown',
        'true detective', 'sharp objects', 'the sinner'
      ];
      const title = (show.title || '').toLowerCase();
      const triggered = darkStudyShows.some(s => title.includes(s));
      return {
        triggered,
        reason: triggered ? 'Known dark character study - verify it has mystery intrigue, not just bleakness' : undefined
      };
    },
    adjustment: -1.0,
  },
  {
    name: 'bleak-british-crime',
    description: 'British crime drama that may be bleak rather than entertaining',
    check: (show) => {
      const bleakBritish = [
        'broadchurch', 'luther', 'marcella', 'unforgotten',
        'line of duty', 'the fall', 'collateral', 'riviera',
        'vigil', 'the capture', 'recognition', 'the investigation'
      ];
      const title = (show.title || '').toLowerCase();
      const origin = show.origin;
      const genres = show.genres || [];

      const isKnownBleak = bleakBritish.some(s => title.includes(s));
      const isBritishCrime = origin === 'british' && genres.includes('Crime');

      return {
        triggered: isKnownBleak || isBritishCrime,
        reason: isKnownBleak
          ? 'Known bleak British crime drama - may prioritize darkness over entertainment'
          : isBritishCrime
            ? 'British crime drama - verify it\'s engaging mystery not bleak character study'
            : undefined
      };
    },
    adjustment: -0.5,
  },
  {
    name: 'prestige-trap',
    description: 'High critical acclaim but potentially style over substance',
    check: (show) => {
      const imdb = show.imdbRating || 0;
      const rtCritics = show.rtCriticsScore || 0;
      const rtAudience = show.rtAudienceScore || 0;

      // High critics, lower audience = potential pretension
      const criticAudienceGap = rtCritics - rtAudience;
      const highCriticsLowerAudience = rtCritics > 85 && criticAudienceGap > 15;

      // Very high IMDB (8.5+) but user historically rates lower
      const veryHighImdb = imdb >= 8.5;

      return {
        triggered: highCriticsLowerAudience || veryHighImdb,
        reason: highCriticsLowerAudience
          ? `Critics ${rtCritics}% vs Audience ${rtAudience}% gap - may be pretentious`
          : veryHighImdb
            ? `Very high IMDB (${imdb}) - verify not inflated by prestige bias`
            : undefined
      };
    },
    adjustment: -0.3,
  },
  {
    name: 'watch-the-crime-unfold',
    description: 'Shows where you watch the crime happen (no mystery)',
    check: (show) => {
      // These are shows where you see the crime/villain from the start
      const watchCrimeShows = [
        'breaking bad', 'ozark', 'the americans', 'you',
        'dexter', 'hannibal', 'the fall', 'killing eve'
      ];
      const title = (show.title || '').toLowerCase();
      const triggered = watchCrimeShows.some(s => title.includes(s));

      return {
        triggered,
        reason: triggered
          ? 'You see the crime/villain from the start - not a whodunit mystery'
          : undefined
      };
    },
    adjustment: -0.5,
  },
  {
    name: 'repulsive-central-character',
    description: 'Shows centered on deliberately unlikeable characters',
    check: (show) => {
      const repulsiveLeadShows = [
        'you', 'dexter', 'hannibal', 'house of cards',
        'succession', 'the morning show', 'inventing anna'
      ];
      const title = (show.title || '').toLowerCase();
      const triggered = repulsiveLeadShows.some(s => title.includes(s));

      return {
        triggered,
        reason: triggered
          ? 'Features deliberately unlikeable characters - character investment may fail'
          : undefined
      };
    },
    adjustment: -0.5,
  },
  {
    name: 'trauma-focused',
    description: 'Shows focused on trauma without redemption/hope',
    check: (show) => {
      const traumaShows = [
        'the handmaid\'s tale', 'when they see us', 'unbelievable',
        '13 reasons why', 'sharp objects', 'the act', 'the staircase'
      ];
      const title = (show.title || '').toLowerCase();
      const triggered = traumaShows.some(s => title.includes(s));

      return {
        triggered,
        reason: triggered
          ? 'Trauma-focused content - may be too heavy without entertainment payoff'
          : undefined
      };
    },
    adjustment: -0.5,
  },
  {
    name: 'together-but-dark',
    description: 'Predicted together but content too dark for Helen',
    check: (show) => {
      const recommendedPref = show.recommendedWatchPreference;
      const contentFlags = show.contentFlags || [];
      const genres = show.genres || [];

      const isDark = contentFlags.includes('intense') ||
                     contentFlags.includes('dark') ||
                     genres.includes('Thriller');

      return {
        triggered: recommendedPref === 'together' && isDark,
        reason: isDark && recommendedPref === 'together'
          ? 'Predicted together but has dark/intense content - Helen may not enjoy'
          : undefined
      };
    },
    adjustment: -0.5,
  },
];

// ============================================
// SHOW ANALYSIS
// ============================================

interface ShowAnalysis {
  show: any;
  currentPrediction: number | null;
  triggeredRisks: { pattern: string; reason: string; adjustment: number }[];
  totalAdjustment: number;
  suggestedPrediction: number | null;
  needsReview: boolean;
  reviewNotes: string[];
}

function analyzeShow(show: any): ShowAnalysis {
  const triggeredRisks: { pattern: string; reason: string; adjustment: number }[] = [];
  const reviewNotes: string[] = [];

  for (const pattern of RISK_PATTERNS) {
    const result = pattern.check(show);
    if (result.triggered) {
      triggeredRisks.push({
        pattern: pattern.name,
        reason: result.reason || pattern.description,
        adjustment: pattern.adjustment,
      });
    }
  }

  // Calculate total adjustment (cap at -2.0)
  const totalAdjustment = Math.max(
    triggeredRisks.reduce((sum, r) => sum + r.adjustment, 0),
    -2.0
  );

  const currentPrediction = show.predictedRating;
  let suggestedPrediction: number | null = null;

  if (currentPrediction !== null && totalAdjustment < 0) {
    suggestedPrediction = Math.max(currentPrediction + totalAdjustment, 2.0);
    // Round to nearest 0.5
    suggestedPrediction = Math.round(suggestedPrediction * 2) / 2;
  }

  // Determine if needs review
  const needsReview = triggeredRisks.length > 0 &&
    (currentPrediction !== null && currentPrediction >= 4.0);

  if (needsReview) {
    reviewNotes.push(`Originally predicted ${currentPrediction}★ but has ${triggeredRisks.length} risk factors`);
    if (suggestedPrediction !== null && suggestedPrediction !== currentPrediction) {
      reviewNotes.push(`Consider adjusting to ${suggestedPrediction}★`);
    }
  }

  return {
    show,
    currentPrediction,
    triggeredRisks,
    totalAdjustment,
    suggestedPrediction,
    needsReview,
    reviewNotes,
  };
}

// ============================================
// MAIN REVIEW PROCESS
// ============================================

async function reviewAllPredictions() {
  console.log('\n=== REVIEWING ALL PREDICTIONS ===\n');

  const allShows = await db.select().from(shows);
  console.log(`Total shows in database: ${allShows.length}`);

  const withPredictions = allShows.filter(s => s.predictedRating !== null);
  console.log(`Shows with predictions: ${withPredictions.length}`);

  const unrated = withPredictions.filter(s => s.rating === null);
  console.log(`Unrated shows with predictions: ${unrated.length}`);

  const analyses: ShowAnalysis[] = [];

  for (const show of withPredictions) {
    const analysis = analyzeShow(show);
    analyses.push(analysis);
  }

  // Sort by severity
  const flagged = analyses
    .filter(a => a.needsReview)
    .sort((a, b) => a.totalAdjustment - b.totalAdjustment);

  console.log(`\nFlagged for review: ${flagged.length} shows\n`);

  return { analyses, flagged };
}

// ============================================
// REPORT GENERATION
// ============================================

function generateReport(happyValley: any, analyses: ShowAnalysis[], flagged: ShowAnalysis[]) {
  const timestamp = new Date().toISOString();

  let report = `# Prediction Review Report

**Generated:** ${timestamp}
**Trigger:** Happy Valley prediction miss (predicted ${happyValley?.predictedRating}★, actual 2★)

---

## Executive Summary

Happy Valley was predicted at 4.5★ for "together" viewing but received 2★ and was dropped after one episode.

**What went wrong:**
1. Confused "acclaimed British crime drama" with "engaging mystery"
2. Over-indexed on high IMDB/RT scores and acting acclaim
3. Missed the "dark character study" vs "whodunit mystery" distinction
4. Didn't flag the bleak, trauma-focused content as a dealbreaker
5. Tommy Lee Royce (central antagonist) is deliberately repulsive - character investment failure

**Key lesson:** "Prestige crime drama" ≠ "Mystery you'll enjoy." Need to distinguish between:
- **Engaging mysteries:** Sherlock, Slow Horses, Only Murders - intrigue and momentum
- **Dark character studies:** Happy Valley, Mindhunter - watching suffering unfold

---

## Happy Valley Entry Updated

\`\`\`
Title: Happy Valley
Rating: 2★ (was predicted ${happyValley?.predictedRating}★)
Status: Dropped
Watch Preference: Together
Review Note: "${happyValley ? 'Dropped after 1 episode. Too dark and bleak...' : 'N/A'}"
\`\`\`

---

## Risk Patterns Implemented

These patterns will now be checked for all predictions:

| Pattern | Description | Adjustment |
|---------|-------------|------------|
| dark-character-study | Dark character study without mystery intrigue | -1.0★ |
| bleak-british-crime | British crime that may prioritize darkness over entertainment | -0.5★ |
| prestige-trap | High critics but lower audience (pretention risk) | -0.3★ |
| watch-the-crime-unfold | You see the crime happen (no whodunit) | -0.5★ |
| repulsive-central-character | Deliberately unlikeable characters | -0.5★ |
| trauma-focused | Focused on trauma without hope/redemption | -0.5★ |
| together-but-dark | Predicted together but too dark for Helen | -0.5★ |

---

## Flagged Shows (${flagged.length} total)

These shows were predicted 4★+ but trigger risk patterns similar to Happy Valley:

`;

  // Group by severity
  const critical = flagged.filter(f => f.totalAdjustment <= -1.0);
  const warning = flagged.filter(f => f.totalAdjustment > -1.0 && f.totalAdjustment <= -0.5);
  const minor = flagged.filter(f => f.totalAdjustment > -0.5);

  if (critical.length > 0) {
    report += `### 🔴 Critical (adjustment -1.0★ or more)\n\n`;
    report += `| Show | Current | Suggested | Risks | Notes |\n`;
    report += `|------|---------|-----------|-------|-------|\n`;
    for (const f of critical) {
      const risks = f.triggeredRisks.map(r => r.pattern).join(', ');
      report += `| ${f.show.title} | ${f.currentPrediction}★ | ${f.suggestedPrediction}★ | ${risks} | ${f.triggeredRisks[0]?.reason || ''} |\n`;
    }
    report += '\n';
  }

  if (warning.length > 0) {
    report += `### 🟡 Warning (adjustment -0.5★ to -1.0★)\n\n`;
    report += `| Show | Current | Suggested | Risks | Notes |\n`;
    report += `|------|---------|-----------|-------|-------|\n`;
    for (const f of warning) {
      const risks = f.triggeredRisks.map(r => r.pattern).join(', ');
      report += `| ${f.show.title} | ${f.currentPrediction}★ | ${f.suggestedPrediction}★ | ${risks} | ${f.triggeredRisks[0]?.reason || ''} |\n`;
    }
    report += '\n';
  }

  if (minor.length > 0) {
    report += `### 🟢 Minor (adjustment less than -0.5★)\n\n`;
    report += `| Show | Current | Suggested | Risks |\n`;
    report += `|------|---------|-----------|-------|\n`;
    for (const f of minor) {
      const risks = f.triggeredRisks.map(r => r.pattern).join(', ');
      report += `| ${f.show.title} | ${f.currentPrediction}★ | ${f.suggestedPrediction}★ | ${risks} |\n`;
    }
    report += '\n';
  }

  report += `---

## Detailed Analysis of Critical Shows

`;

  for (const f of critical) {
    report += `### ${f.show.title}\n\n`;
    report += `**Current prediction:** ${f.currentPrediction}★ (${f.show.recommendedWatchPreference || 'unknown'})\n`;
    report += `**Suggested:** ${f.suggestedPrediction}★\n`;
    report += `**IMDB:** ${f.show.imdbRating || 'N/A'}\n`;
    report += `**RT Critics/Audience:** ${f.show.rtCriticsScore || 'N/A'}% / ${f.show.rtAudienceScore || 'N/A'}%\n`;
    report += `**Genres:** ${(f.show.genres || []).join(', ')}\n\n`;
    report += `**Triggered risks:**\n`;
    for (const risk of f.triggeredRisks) {
      report += `- **${risk.pattern}** (${risk.adjustment}★): ${risk.reason}\n`;
    }
    report += '\n';
  }

  report += `---

## Recommendations

1. **Immediate action:** Review the ${critical.length} critical shows before recommending them
2. **Update taste profile:** Add explicit pattern for "dark character study vs engaging mystery"
3. **Together filter:** Add stronger checks for Helen-unfriendly content
4. **British crime distinction:** Not all British crime is Sherlock - some is bleak suffering

---

## Next Steps

1. Review this report in the morning
2. Decide which predictions to adjust in the database
3. Update CLAUDE.md taste profile with Happy Valley learnings
4. Consider re-running predictions for all flagged shows

`;

  return report;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('========================================');
  console.log('PREDICTION REVIEW - OVERNIGHT ANALYSIS');
  console.log('========================================');
  console.log(`Started: ${new Date().toISOString()}`);

  // Step 1: Update Happy Valley
  const happyValley = await updateHappyValley();

  // Step 2: Review all predictions
  const { analyses, flagged } = await reviewAllPredictions();

  // Step 3: Generate report
  console.log('\n=== GENERATING REPORT ===\n');
  const report = generateReport(happyValley, analyses, flagged);

  // Save report
  const reportPath = path.join(process.cwd(), 'docs', 'prediction-review-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`✓ Report saved to: ${reportPath}`);

  // Step 4: Summary output
  console.log('\n=== SUMMARY ===\n');
  console.log(`Total shows analyzed: ${analyses.length}`);
  console.log(`Shows flagged for review: ${flagged.length}`);

  const critical = flagged.filter(f => f.totalAdjustment <= -1.0);
  const warning = flagged.filter(f => f.totalAdjustment > -1.0 && f.totalAdjustment <= -0.5);

  console.log(`  - Critical (≥1.0★ adjustment needed): ${critical.length}`);
  console.log(`  - Warning (0.5-1.0★ adjustment needed): ${warning.length}`);

  if (critical.length > 0) {
    console.log('\nCritical shows to review:');
    for (const c of critical) {
      console.log(`  - ${c.show.title}: ${c.currentPrediction}★ → ${c.suggestedPrediction}★`);
    }
  }

  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

main()
  .then(() => {
    console.log('\n✓ Prediction review complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nERROR:', err);
    process.exit(1);
  });
