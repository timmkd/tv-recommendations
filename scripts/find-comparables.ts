// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { isNotNull, like, or, and, sql } = require('drizzle-orm');

// Helper: shows that have any of the given genres (case-insensitive substring match on JSON)
async function byGenres(genreList) {
  const rows = await db.select({
    title: shows.title,
    year: shows.year,
    rating: shows.rating,
    watchPreference: shows.watchPreference,
    genres: shows.genres,
    showStatus: shows.showStatus,
    numberOfSeasons: shows.numberOfSeasons,
    reviewNote: shows.reviewNote,
    dropped: shows.dropped,
  }).from(shows).where(isNotNull(shows.rating));
  return rows.filter(r => {
    const g = r.genres || [];
    return genreList.some(target => g.some(x => x.toLowerCase().includes(target.toLowerCase())));
  });
}

// Helper: shows matching a title pattern
async function byTitlePattern(patterns) {
  const rows = await db.select({
    title: shows.title,
    year: shows.year,
    rating: shows.rating,
    watchPreference: shows.watchPreference,
    genres: shows.genres,
    reviewNote: shows.reviewNote,
    dropped: shows.dropped,
  }).from(shows).where(isNotNull(shows.rating));
  return rows.filter(r => patterns.some(p => (r.title || '').toLowerCase().includes(p.toLowerCase())));
}

function summarize(rows, label) {
  if (!rows.length) {
    console.log(`  ${label}: no matches`);
    return;
  }
  const rated = rows.filter(r => r.rating != null);
  const avg = rated.reduce((s, r) => s + r.rating, 0) / rated.length;
  console.log(`  ${label} (n=${rated.length}, avg=${avg.toFixed(2)}★):`);
  // Sort by rating desc
  rated.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  for (const r of rated.slice(0, 15)) {
    const note = r.reviewNote ? ` — ${r.reviewNote.slice(0, 80)}` : '';
    console.log(`    ${r.rating}★ ${r.watchPreference ?? '-'}${r.dropped ? ' [DROP]' : ''}  ${r.title} (${r.year})${note}`);
  }
}

async function main() {
  console.log('\n===== 1. SCARPETTA (Nicole Kidman / forensic crime / Prime) =====');
  const nicoleKidman = await byTitlePattern(['big little lies', 'the undoing', 'nine perfect', 'expats', 'lioness']);
  summarize(nicoleKidman, 'Nicole Kidman shows');
  const crimeMystery = await byGenres(['mystery']);
  const crimeMysteryTogether = crimeMystery.filter(r => r.watchPreference === 'together');
  summarize(crimeMysteryTogether.slice(0, 25), 'Crime/Mystery together');
  const forensicProcedural = await byTitlePattern(['bones', 'csi', 'criminal minds', 'ncis', 'silent witness', 'cracker', 'wire in the blood']);
  summarize(forensicProcedural, 'Forensic procedurals');

  console.log('\n===== 2. CITADEL (Russo, action-spy, Prime) =====');
  const spyish = await byTitlePattern(['slow horses', 'americans', 'homeland', 'bureau', 'diplomat', 'bodyguard', 'spy among', 'night manager', 'jack ryan', 'reacher', 'jackal', 'tehran', 'agency']);
  summarize(spyish, 'Spy/thriller comparables');
  const actionCrime = await byGenres(['action']);
  const actionCrimeRated = actionCrime.filter(r => r.rating != null);
  summarize(actionCrimeRated.slice(0, 15), 'Anything tagged Action');

  console.log('\n===== 3. HALF MAN (Richard Gadd, BBC) =====');
  const gaddPattern = await byTitlePattern(['baby reindeer']);
  summarize(gaddPattern, 'Same writer (Gadd)');
  const darkCharacterStudy = await byTitlePattern(['mindhunter', 'fleabag', 'i may destroy you', 'normal people', 'industry', 'adolescence', 'this is going to hurt']);
  summarize(darkCharacterStudy, 'Dark BBC/Limited character studies');

  console.log('\n===== 4. SHORESY (Letterkenny spinoff, Canadian hockey comedy) =====');
  const letterkenny = await byTitlePattern(['letterkenny', 'trailer park', 'corner gas', 'kim\'s convenience']);
  summarize(letterkenny, 'Canadian niche comedies');
  const crudeComedy = await byTitlePattern(['always sunny', 'workaholics', 'eastbound', 'jackass', 'tim and eric', 'i think you should leave']);
  summarize(crudeComedy, 'Crude/dialect comedies');

  console.log('\n===== 5. WAITING FOR THE OUT (BBC drama, low TMDB) =====');
  const bbcPrison = await byTitlePattern(['time', 'top boy', 'this is england', 'happy valley', 'line of duty', 'criminal record', 'prisoner']);
  summarize(bbcPrison, 'BBC drama/prison/dark');
  const lowRatedBBC = await byGenres(['drama']);
  const lowSampleNew = lowRatedBBC.filter(r => r.year >= 2023 && r.watchPreference === 'together' && r.rating != null).sort((a,b) => (b.year||0)-(a.year||0));
  summarize(lowSampleNew.slice(0, 15), 'Recent together dramas (2023+)');

  console.log('\n===== 6. THE OTHER BENNET SISTER (BBC period dramedy) =====');
  const periodDrama = await byTitlePattern(['bridgerton', 'crown', 'gilded age', 'gentleman in moscow', 'sanditon', 'great', 'queen charlotte', 'belgravia', 'pride and prejudice', 'emma', 'jane austen', 'dickinson', 'masterpiece']);
  summarize(periodDrama, 'Period drama comparables');

  console.log('\n===== 7. MARGO\'S GOT MONEY TROUBLES (Apple TV character dramedy) =====');
  const appleTVDramedy = await byTitlePattern(['shrinking', 'lessons in chemistry', 'ted lasso', 'morning show', 'pachinko', 'severance', 'bad sisters', 'mosquito coast', 'physical', 'platonic', 'palm royale']);
  summarize(appleTVDramedy, 'Apple TV shows');
  const sliceofLifeDramedy = await byTitlePattern(['fleabag', 'gilmore', 'better things', 'reservation', 'kominsky', 'somebody somewhere', 'enlightened', 'maid']);
  summarize(sliceofLifeDramedy, 'Character dramedies');

  console.log('\n===== 8. DEXTER: RESURRECTION (serial killer crime) =====');
  const dexterFamily = await byTitlePattern(['dexter']);
  summarize(dexterFamily, 'Dexter family');
  const serialKiller = await byTitlePattern(['mindhunter', 'hannibal', 'killing eve', 'you', 'blackbird', 'criminal minds', 'the fall']);
  summarize(serialKiller, 'Serial-killer adjacent');
}
main().catch(e => { console.error(e); process.exit(1); });
