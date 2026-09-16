/**
 * Validated, all-or-nothing write path for show predictions.
 * THE ONLY approved way to write predictions to the DB.
 *
 * Reads a JSON file containing an array of 1-50 rows:
 *   {
 *     "tmdbId": 12345,
 *     "title": "Show Name",                        // must match DB title (guards tmdbId mix-ups)
 *     "predictedRating": 4,                        // 0.5-5 in 0.5 steps
 *     "predictedRatingReason": "Predicted 4★: ...", // 400-600 chars, no platform names
 *     "recommendedWatchPreference": "solo",        // or "together"
 *     "predictedBingeability": 4,                  // OPTIONAL 1-5 integer, how easily binged
 *     "predictedBingeabilityReason": "Binge 4/5: ...", // OPTIONAL 120-400 chars, required with the above
 *
 *   BINGEABILITY-ONLY rows: omit predictedRating / predictedRatingReason /
 *   recommendedWatchPreference and supply only the two bingeability fields. The
 *   show must already carry a star prediction, which is left untouched. This
 *   avoids re-emitting long existing reasons just to attach a binge score.
 *     "changeNote": "optional, <=120 chars, shown in the prediction-updates.md log"
 *   }
 *
 * Validates EVERY row and reports ALL errors in one pass. If any row fails,
 * NOTHING is written (exit 1, `RESULT: FAILED`). On success, writes via
 * saveOverlay keyed on tmdbId (idempotent) and prints a ready-to-paste
 * markdown table for docs/prediction-updates.md.
 *
 * Run with: npx tsx scripts/apply-predictions.ts <file.json> [--dry-run] [--allow-rated]
 *   --dry-run     validate + show the diff table, write nothing (`RESULT: DRY-RUN OK`)
 *   --allow-rated permit rows for shows that already have a user rating
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';

// Import after env is loaded
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveOverlay, getOverlayByTmdbId } = require('../src/lib/db/queries');

// Platform names must never appear in prediction reasons (predictions are
// platform-agnostic). Case-insensitive hard errors:
const PLATFORM_ERROR =
  /\b(netflix|hulu|hbo|disney(\s*(plus|\+))?|apple\s*tv(\+|\s*plus)?|prime\s*video|amazon|paramount(\+|\s*plus)?|peacock|britbox|foxtel|iview|sbs\s*on\s*demand|ten\s*play|showtime|starz)\b/i;
// These collide with common words/names ("Stan" the name, "bingeable", maximum),
// so capitalized-word matches only WARN — a human must eyeball them:
const PLATFORM_WARN = /\b(Max|Stan|Binge)\b/;

// The four fixed ramp forms a predictedBingeabilityReason may end with.
// Em dash or hyphen accepted; N/S N must be a number, never "eventually".
const RAMP_FORMS = [
  /Grabs from ep 1\.$/,
  /Slow open [—-] picks up from (ep|S) ?\d+; worth it\.$/,
  /Slow open [—-] picks up from (ep|S) ?\d+, but the payoff is thin\.$/,
  /Front-loaded [—-] strongest early, fades from S ?\d+\.$/,
];

function starLabel(rating: number, pref: string | null | undefined): string {
  const stars = `${rating}★`;
  const suffix = pref === 'together' ? ' T' : pref === 'solo' ? ' S' : '';
  return stars + suffix;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const allowRated = args.includes('--allow-rated');
  const file = args.find((a) => !a.startsWith('--'));

  if (!file) {
    console.error('Usage: npx tsx scripts/apply-predictions.ts <file.json> [--dry-run] [--allow-rated]');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`ERROR: file not found: ${file}`);
    console.log('RESULT: FAILED (1 errors, 0 written)');
    process.exit(1);
  }

  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`ERROR: invalid JSON in ${file}: ${e.message}`);
    console.log('RESULT: FAILED (1 errors, 0 written)');
    process.exit(1);
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50) {
    console.error(`ERROR: expected a JSON array of 1-50 rows, got ${Array.isArray(rows) ? rows.length + ' rows' : typeof rows}`);
    console.log('RESULT: FAILED (1 errors, 0 written)');
    process.exit(1);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set();
  const resolved = []; // { row, existing }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label = `row ${i + 1} (${r?.title ?? 'no title'})`;

    // --- structural ---
    if (!Number.isInteger(r?.tmdbId)) errors.push(`${label}: tmdbId must be an integer, got ${JSON.stringify(r?.tmdbId)}`);
    if (typeof r?.title !== 'string' || !r.title.trim()) errors.push(`${label}: title must be a non-empty string`);
    if (seenIds.has(r?.tmdbId)) errors.push(`${label}: duplicate tmdbId ${r.tmdbId} in this batch`);
    seenIds.add(r?.tmdbId);
    const rating = r?.predictedRating;
    // A row that carries only bingeability leaves the stored star prediction alone.
    const bingeOnly =
      rating === undefined &&
      r?.predictedRatingReason === undefined &&
      r?.recommendedWatchPreference === undefined &&
      r?.predictedBingeability != null;
    r.__bingeOnly = bingeOnly;
    const ratingOk = typeof rating === 'number' && Number.isInteger(rating * 2) && rating * 2 >= 1 && rating * 2 <= 10;
    if (!bingeOnly) {
      if (!ratingOk) errors.push(`${label}: predictedRating must be 0.5-5 in 0.5 steps, got ${JSON.stringify(rating)}`);
      if (r?.recommendedWatchPreference !== 'solo' && r?.recommendedWatchPreference !== 'together')
        errors.push(`${label}: recommendedWatchPreference must be "solo" or "together", got ${JSON.stringify(r?.recommendedWatchPreference)}`);
    }
    if (r?.changeNote != null && (typeof r.changeNote !== 'string' || r.changeNote.length > 120))
      errors.push(`${label}: changeNote must be a string of <=120 chars`);
    // Optional. 1-5 integers only: 0 would be swallowed by the `|| null` truthiness
    // conventions used elsewhere for this field.
    const binge = r?.predictedBingeability;
    if (binge != null && !(Number.isInteger(binge) && binge >= 1 && binge <= 5))
      errors.push(`${label}: predictedBingeability must be an integer 1-5 (or omitted), got ${JSON.stringify(binge)}`);
    const bingeReason = r?.predictedBingeabilityReason;
    if (binge != null && typeof bingeReason !== 'string')
      errors.push(`${label}: predictedBingeabilityReason is required when predictedBingeability is set`);
    if (typeof bingeReason === 'string') {
      const bm = bingeReason.match(/^Binge (\d)\/5: /);
      if (!bm) errors.push(`${label}: predictedBingeabilityReason must start with "Binge X/5: ", got "${bingeReason.slice(0, 30)}..."`);
      else if (binge != null && Number(bm[1]) !== binge)
        errors.push(`${label}: reason says "Binge ${bm[1]}/5" but predictedBingeability is ${binge}`);
      if (bingeReason.length < 120 || bingeReason.length > 400)
        errors.push(`${label}: predictedBingeabilityReason must be 120-400 chars, got ${bingeReason.length}`);
      // The ramp clause: four fixed forms, each ending the reason, each naming a
      // NUMBER rather than "eventually". Enforced here because it is a documented
      // MUST (CLAUDE.md + the worksheet Step 6) that was previously unchecked.
      if (!RAMP_FORMS.some((re) => re.test(bingeReason)))
        errors.push(
          `${label}: predictedBingeabilityReason must END with one of the four ramp clauses — ` +
            `"Grabs from ep 1." | "Slow open — picks up from ep N; worth it." | ` +
            `"Slow open — picks up from ep N, but the payoff is thin." | ` +
            `"Front-loaded — strongest early, fades from S N." ` +
            `(N must be a number). Got: "...${bingeReason.slice(-60)}"`
        );
    }

    // --- reason ---
    const reason = r?.predictedRatingReason;
    if (bingeOnly) {
      // nothing to check: the stored reason is untouched
    } else if (typeof reason !== 'string') {
      errors.push(`${label}: predictedRatingReason must be a string`);
    } else {
      const m = reason.match(/^Predicted (\d(?:\.5)?)★: /);
      if (!m) {
        errors.push(`${label}: reason must start with "Predicted X★: " (X like "4" or "3.5"), got "${reason.slice(0, 40)}..."`);
      } else if (ratingOk && m[1] !== String(rating)) {
        errors.push(`${label}: reason says "Predicted ${m[1]}★" but predictedRating is ${rating}`);
      }
      if (reason.length < 400 || reason.length > 600)
        errors.push(`${label}: reason must be 400-600 chars, got ${reason.length}`);
      if (!/\b(solo|together)\b/i.test(reason))
        errors.push(`${label}: reason must explain the solo/together call (mention "solo" or "together")`);
      const platform = reason.match(PLATFORM_ERROR);
      if (platform)
        errors.push(`${label}: reason mentions platform "${platform[0]}" — predictions are platform-agnostic, remove it`);
      const warn = reason.match(PLATFORM_WARN);
      if (warn)
        warnings.push(`${label}: reason contains "${warn[0]}" — if this refers to the streaming service (not a person/word like "bingeable"), remove it`);
    }

    // --- DB cross-checks ---
    if (Number.isInteger(r?.tmdbId)) {
      const existing = await getOverlayByTmdbId(r.tmdbId);
      if (!existing) {
        errors.push(`${label}: no show with tmdbId ${r.tmdbId} in the DB`);
      } else {
        if (typeof r?.title === 'string' && existing.title && existing.title.trim().toLowerCase() !== r.title.trim().toLowerCase())
          errors.push(`${label}: title mismatch — DB has "${existing.title}" for tmdbId ${r.tmdbId} (likely a tmdbId mix-up)`);
        if (r.__bingeOnly && existing.predictedRating == null)
          errors.push(`${label}: bingeability-only row but the show has no existing star prediction`);
        if (existing.rating != null && !allowRated)
          errors.push(`${label}: show already rated ${existing.rating}★ by the user — predictions for rated shows need --allow-rated`);
        if (existing.dropped) errors.push(`${label}: show is DROPPED — do not predict dropped shows`);
        if (existing.hidden) errors.push(`${label}: show is HIDDEN — do not predict hidden shows`);
        resolved.push({ row: r, existing });
      }
    }
  }

  for (const w of warnings) console.log(`WARNING: ${w}`);

  if (errors.length > 0) {
    console.log(`\n${errors.length} validation error(s):\n`);
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    console.log(`\nRESULT: FAILED (${errors.length} errors, 0 written)`);
    process.exit(1);
  }

  // --- diff table ---
  console.log('\n=== CHANGES ===\n');
  for (const { row, existing } of resolved) {
    const oldLabel = existing.predictedRating != null
      ? starLabel(existing.predictedRating, existing.recommendedWatchPreference)
      : '—';
    if (row.__bingeOnly) {
      console.log(
        `tmdb=${row.tmdbId}  ${existing.title}: ${oldLabel} (unchanged)  binge ${existing.predictedBingeability ?? '—'}->${row.predictedBingeability}`
      );
      continue;
    }
    console.log(
      `tmdb=${row.tmdbId}  ${existing.title}: ${oldLabel} -> ${starLabel(row.predictedRating, row.recommendedWatchPreference)}${
        row.predictedBingeability != null
          ? `  binge ${existing.predictedBingeability ?? '—'}->${row.predictedBingeability}`
          : ''
      }${row.changeNote ? `  (${row.changeNote})` : ''}`
    );
  }

  if (dryRun) {
    console.log(`\nRESULT: DRY-RUN OK (${resolved.length} rows validated, 0 written)`);
    return;
  }

  // --- write ---
  const now = new Date().toISOString();
  for (const { row, existing } of resolved) {
    await saveOverlay({
      ...existing,
      tmdbId: row.tmdbId,
      ...(row.__bingeOnly
        ? {}
        : {
            predictedRating: row.predictedRating,
            predictedRatingReason: row.predictedRatingReason,
            recommendedWatchPreference: row.recommendedWatchPreference,
          }),
      ...(row.predictedBingeability != null
        ? {
            predictedBingeability: row.predictedBingeability,
            predictedBingeabilityReason: row.predictedBingeabilityReason,
          }
        : {}),
      predictionsUpdatedAt: now,
    });
    console.log(`saved tmdb=${row.tmdbId} ${existing.title}`);
  }

  // --- ready-to-paste log table for docs/prediction-updates.md ---
  console.log('\n=== PASTE INTO docs/prediction-updates.md ===\n');
  console.log('| Show | Old | New | Reason for Change |');
  console.log('| ---- | --- | --- | ----------------- |');
  for (const { row, existing } of resolved) {
    const oldLabel = existing.predictedRating != null
      ? starLabel(existing.predictedRating, existing.recommendedWatchPreference)
      : '—';
    const note = row.changeNote || (existing.predictedRating == null ? 'new prediction' : '');
    if (row.__bingeOnly) {
      console.log(`| **${existing.title}** | ${oldLabel} | ${oldLabel} + B${row.predictedBingeability} | ${row.changeNote || 'bingeability prediction added'} |`);
      continue;
    }
    console.log(`| **${existing.title}** | ${oldLabel} | ${starLabel(row.predictedRating, row.recommendedWatchPreference)} | ${note} |`);
  }

  console.log(`\nRESULT: OK (${resolved.length} written)`);
}

main().catch((e) => {
  console.error(e);
  console.log('RESULT: FAILED (unexpected error, writes may be partial — verify with scripts/lookup-show.ts)');
  process.exit(1);
});
