// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

const NORMAL_PEOPLE = 89905;

async function main() {
  const now = new Date().toISOString();

  // ---- Mad Men: solo originally (pre-Helen), enjoyed together on rewatch ----
  const mm = await db.select().from(shows).where(eq(shows.title, 'Mad Men'));
  if (mm.length !== 1) { console.log(`WARN: ${mm.length} matches for 'Mad Men' — aborting MM update`); }
  else {
    const m = mm[0];
    console.log(`Mad Men tmdb=${m.tmdbId} (before): rating=${m.rating} watchPref=${m.watchPreference} rec=${m.recommendedWatchPreference}`);
    await db.update(shows).set({
      watchPreferenceNote: 'Works both ways. Originally watched SOLO (before living with Helen) — prestige slow-burn character drama, the solo register. Re-watched TOGETHER and we enjoyed it together. The "solo" prediction matched the original watch; the together rewatch was a bonus.',
      reviewNote: 'Watched solo originally, then re-watched with Helen and we both enjoyed it together. Don Draper character study with great period detail — holds up on a rewatch.',
      updatedAt: now,
    }).where(eq(shows.tmdbId, m.tmdbId));
    console.log('Mad Men: notes updated (rating/watchPref left as-is — together is correct for the current rewatch).');
  }

  // ---- Normal People: 2-episode together DROP (Helen-fit), Tim open to solo ----
  const [np] = await db.select().from(shows).where(eq(shows.tmdbId, NORMAL_PEOPLE));
  console.log(`\nNormal People (before): rating=${np.rating} watchPref=${np.watchPreference} dropped=${np.dropped} status=${np.status}`);
  await db.update(shows).set({
    dropped: true,
    watchPreferenceNote: 'Together attempt: dropped after ~2 episodes. Helen wasn’t enjoying it — too slow, "nothing happening". Solo is the right register for this (slow, intimate Irish romance).',
    reviewNote: 'Dropped after 2 episodes watched TOGETHER — Helen wasn’t into it (too slow, nothing happening). Was a long time ago. The 2.5★ reflects the together drop / Helen-fit, NOT a considered verdict — Tim suspects he’d enjoy it solo and may try it alone someday.',
    updatedAt: now,
  }).where(eq(shows.tmdbId, NORMAL_PEOPLE));
  console.log('Normal People: marked dropped=true (together drop), notes updated, 2.5★ kept as a Helen-fit data point.');

  // ---- Verify ----
  const [np2] = await db.select().from(shows).where(eq(shows.tmdbId, NORMAL_PEOPLE));
  console.log(`\nNormal People (after): rating=${np2.rating} dropped=${np2.dropped} watchPref=${np2.watchPreference}`);
}
main().catch(e => { console.error(e); process.exit(1); });
