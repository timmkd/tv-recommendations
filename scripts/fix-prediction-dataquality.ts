// @ts-nocheck
// Fix data-quality issues found while verifying the 121 "adequate-reason" predictions.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');

const UP = [
  // Tulsa King — prior reason described the WRONG show (Five Days at Memorial).
  { id: 33235421, title: 'Tulsa King', r: 3.5, p: 'together', reason: `Predicted 3.5★: Taylor Sheridan crime-drama — Sylvester Stallone as a just-out NYC mafia capo exiled to build an operation in Tulsa (IMDB ~8.0). Sheridan's track record runs together for you (Lioness 4★, Landman 3.5★), and Stallone's fish-out-of-water charisma plus the crime backbone keep Helen's momentum up. Held at 3.5★ by sprawling subplots and a tonal wobble between mob drama and broad comedy. Returning series. Together viewing. Give it 2-3 episodes; Stallone is the hook — if the meandering ensemble loses Helen, that's the drop risk. (Corrected: prior reason described the wrong show.)` },
  // Patriot — reason prefix said 4★ but stored 3★; reconcile at 3★.
  { id: -1, title: 'Patriot', r: 3, p: 'solo', reason: `Predicted 3★: Amazon dark comedy-thriller — a depressed intelligence officer juggles black-ops with a folk-singing side life (IMDB ~8.1). Deadpan, melancholic, off-beat = SOLO (your dry/dark comedy lane, not Helen's). Cult-adored and distinctive, which argues higher, but it was cancelled after 2 seasons without resolution — and you hate cancelled-unresolved (-0.5★), pulling a ~3.5 base to 3★. 2 seasons, open ending. Commit to 3-4 episodes; the singular tone is an acquired taste — if the deadpan melancholy clicks it's a hidden gem, if not it won't convert.` },
  // True Detective — reason prefix said 4★ but stored 4.5★; clarify it's S1-anchored.
  { id: -1, title: 'True Detective', r: 4.5, p: 'solo', reason: `Predicted 4.5★ (Season 1): HBO anthology crime drama — S1 (McConaughey & Harrelson) is exceptional, a philosophical Louisiana serial-killer character study with the dread and dense interiority of your top solo dramas. Dark crime + Rust Cohle's existential monologues = SOLO. The 4.5★ is S1-specific; later seasons are mixed (3-3.5★), so treat each season on its own. S1 is a self-contained 8-episode arc. Commit to 3-4 episodes — the dual-timeline structure and slow dread build to a strong payoff; the vibe is the point as much as the case.` },
  // Platonic — stored 'together' contradicted its own reason ("Solo viewing"); fix to solo.
  { id: -1, title: 'Platonic', r: 3.5, p: 'solo', reason: `Predicted 3.5★: Seth Rogen and Rose Byrne comedy about a rekindled platonic friendship 'destabilizing their lives' (RT ~96%). Rogen's adult/crude comedic style is SOLO for you (same call as The Studio) — corrects the prior 'together' tag and matches this prediction's own conclusion. Edgy duo comedies land 3.5-4★ (Hacks 3.5★). Not a light easy-watch like Nobody Wants This 4★ — messier and more abrasive. Returning series. SOLO. 2 episodes is enough; if the Rogen/Byrne chemistry carries the discomfort it sustains, if the cringe outweighs it stalls.` },
];

async function main() {
  const now = new Date().toISOString();
  for (const u of UP) {
    // match by title (ids here are placeholders); guard on single match
    const rows = await db.select().from(shows).where(eq(shows.title, u.title));
    if (rows.length !== 1) { console.log(`SKIP ${u.title}: ${rows.length} matches`); continue; }
    const cur = rows[0];
    console.log(`${u.title}: pred ${cur.predictedRating}->${u.r}, pref ${cur.recommendedWatchPreference}->${u.p}`);
    await db.update(shows).set({
      predictedRating: u.r,
      recommendedWatchPreference: u.p,
      predictedRatingReason: u.reason,
      predictionsUpdatedAt: now,
      updatedAt: now,
    }).where(eq(shows.tmdbId, cur.tmdbId));
  }
  console.log('Done.');
}
main().catch(e => { console.error(e); process.exit(1); });
