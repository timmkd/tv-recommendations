/**
 * Permanently remove a show by tmdbId. Mirrors the /api/shows DELETE handler:
 * tombstone it in deleted_shows (so a Trakt re-sync won't re-import it), then
 * remove the overlay row. Generalizes delete-baby-einstein.ts.
 *
 * Run with: npx tsx scripts/delete-show.ts <tmdbId>
 * Prints the row and requires --confirm to actually delete.
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  addDeletedShow,
  deleteOverlay,
  getOverlayByTmdbId,
  isShowDeleted,
} = require('../src/lib/db/queries');

async function main() {
  const tmdbId = parseInt(process.argv[2] || '', 10);
  const confirm = process.argv.includes('--confirm');
  if (!Number.isInteger(tmdbId)) {
    console.error('Usage: npx tsx scripts/delete-show.ts <tmdbId> [--confirm]');
    process.exit(1);
  }

  const existing = await getOverlayByTmdbId(tmdbId);
  if (!existing) {
    console.log(`Not in DB (tmdb=${tmdbId}) — nothing to delete.`);
    return;
  }

  console.log(
    `tmdb=${tmdbId}  title=${existing.title ?? 'null'} (${existing.year ?? '?'})  status=${existing.status ?? '?'}  rating=${existing.rating ?? '-'}  pred=${existing.predictedRating ?? '-'}`
  );
  if (existing.rating != null) {
    console.log('WARNING: this show has a user rating — deleting loses taste data.');
  }
  if (!confirm) {
    console.log('Dry run. Re-run with --confirm to tombstone + delete.');
    return;
  }

  await addDeletedShow({
    tmdbId,
    title: existing.title ?? `tmdb-${tmdbId}`,
    year: existing.year ?? undefined,
    deletedAt: new Date().toISOString(),
  });
  await deleteOverlay(tmdbId);

  const gone = (await getOverlayByTmdbId(tmdbId)) == null;
  const tombstoned = await isShowDeleted(tmdbId, existing.title ?? '', existing.year ?? undefined);
  console.log(`✓ removed from shows=${gone}, tombstoned in deleted_shows=${tombstoned}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
