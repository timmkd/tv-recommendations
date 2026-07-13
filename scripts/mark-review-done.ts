/**
 * Update the review-state markers in docs/profile-changelog.md.
 * The ONLY approved way to touch the markers/checkboxes — never hand-edit them.
 *
 * Run with:
 *   npx tsx scripts/mark-review-done.ts ratings
 *     -> sets "**Last ratings review:**" to now
 *   npx tsx scripts/mark-review-done.ts rescan [--check-all]
 *     -> sets "**Last prediction rescan:**" to now
 *        --check-all also flips every "- [ ]" pending entry to "- [x]"
 */
// @ts-nocheck
import fs from 'fs';

const CHANGELOG_PATH = 'docs/profile-changelog.md';

function main() {
  const mode = process.argv[2];
  const checkAll = process.argv.includes('--check-all');

  if (mode !== 'ratings' && mode !== 'rescan') {
    console.error('Usage: npx tsx scripts/mark-review-done.ts <ratings|rescan> [--check-all]');
    process.exit(1);
  }
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error(`ERROR: ${CHANGELOG_PATH} not found. Run from the repo root.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const marker =
    mode === 'ratings' ? /^\*\*Last ratings review:\*\* .+$/m : /^\*\*Last prediction rescan:\*\* .+$/m;
  const label = mode === 'ratings' ? 'Last ratings review' : 'Last prediction rescan';

  const text = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const matches = text.match(new RegExp(marker.source, 'gm')) ?? [];
  if (matches.length !== 1) {
    console.error(
      `ERROR: expected exactly one "**${label}:**" marker line in ${CHANGELOG_PATH}, found ${matches.length}. Fix the file by hand first.`
    );
    process.exit(1);
  }

  let updated = text.replace(marker, `**${label}:** ${now}`);
  console.log(`- ${matches[0]}`);
  console.log(`+ **${label}:** ${now}`);

  if (mode === 'rescan' && checkAll) {
    const pending = updated.split('\n').filter((l) => /^- \[ \] /.test(l));
    updated = updated
      .split('\n')
      .map((l) => (/^- \[ \] /.test(l) ? l.replace('- [ ] ', '- [x] ') : l))
      .join('\n');
    for (const p of pending) {
      console.log(`- ${p}`);
      console.log(`+ ${p.replace('- [ ] ', '- [x] ')}`);
    }
    console.log(`Checked off ${pending.length} pending entr${pending.length === 1 ? 'y' : 'ies'}.`);
  }

  fs.writeFileSync(CHANGELOG_PATH, updated);
  console.log('RESULT: OK');
}

main();
