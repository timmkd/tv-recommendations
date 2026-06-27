/**
 * Permanently remove "Baby Einstein Classics" (tmdb=132128) — a stray sync from
 * watch history (kids watching it once). Mirrors the /api/shows DELETE handler:
 * tombstone it in deleted_shows (so a Trakt re-sync won't re-import it), then
 * remove the overlay row.
 *
 * Run with: npx tsx scripts/delete-baby-einstein.ts
 */
// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const {
  addDeletedShow,
  deleteOverlay,
  getOverlayByTmdbId,
  isShowDeleted,
} = require('../src/lib/db/queries');

const TARGET = { tmdbId: 132128, title: 'Baby Einstein Classics', year: 2010 };

async function main() {
  const existing = await getOverlayByTmdbId(TARGET.tmdbId);
  if (!existing) {
    console.log(`Not in DB (tmdb=${TARGET.tmdbId}) — nothing to delete.`);
  }

  await addDeletedShow({
    tmdbId: TARGET.tmdbId,
    title: TARGET.title,
    year: TARGET.year,
    deletedAt: new Date().toISOString(),
  });

  await deleteOverlay(TARGET.tmdbId);

  const gone = (await getOverlayByTmdbId(TARGET.tmdbId)) == null;
  const tombstoned = await isShowDeleted(TARGET.tmdbId, TARGET.title, TARGET.year);
  console.log(
    `✓ ${TARGET.title}: removed from shows=${gone}, tombstoned in deleted_shows=${tombstoned}`
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
