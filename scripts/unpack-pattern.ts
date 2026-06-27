import { db, shows } from '../src/lib/db';

async function analyze() {
  const allShows = await db.select().from(shows);
  const rated = allShows.filter(s => s.rating !== null);

  console.log('=== LOOKING FOR PATTERNS IN DIFFICULT/DARK CONTENT ===\n');

  // Shows with "true story" or "based on" in notes - these often tackle difficult subjects
  console.log('--- TRUE STORY shows (often tackle difficult subjects) ---\n');
  const trueStory = rated.filter(s => {
    const text = `${s.reviewNote || ''} ${s.notes || ''} ${s.title || ''}`.toLowerCase();
    return text.includes('true') || text.includes('based on') || text.includes('real');
  }).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  for (const s of trueStory.slice(0, 15)) {
    console.log(`${s.rating}★ ${s.title} [${s.watchPreference}]`);
    if (s.reviewNote) console.log(`   "${s.reviewNote.substring(0, 100)}..."`);
    console.log('');
  }

  // Shows with words suggesting difficulty or darkness
  console.log('\n--- Shows with DARK/INTENSE/HEAVY notes ---\n');
  const darkNotes = rated.filter(s => {
    const text = `${s.reviewNote || ''} ${s.notes || ''}`.toLowerCase();
    return text.includes('dark') || text.includes('intense') || text.includes('heavy') ||
           text.includes('hard to watch') || text.includes('difficult') || text.includes('bleak') ||
           text.includes('grim') || text.includes('brutal');
  }).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  for (const s of darkNotes) {
    console.log(`${s.rating}★ ${s.title} [${s.watchPreference}]`);
    if (s.reviewNote) console.log(`   "${s.reviewNote.substring(0, 120)}..."`);
    console.log('');
  }

  // Shows that are Drama + deal with serious topics (no Comedy)
  console.log('\n--- PRESTIGE DRAMA (Drama, no Comedy) - sorted by rating ---\n');
  const prestigeDrama = rated.filter(s => {
    const genres = s.genres || [];
    return genres.includes('Drama') && !genres.includes('Comedy') && s.watchPreference === 'together';
  }).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  console.log('TOP together prestige dramas:');
  for (const s of prestigeDrama.slice(0, 10)) {
    console.log(`${s.rating}★ ${s.title} - ${s.genres?.join(', ')}`);
    if (s.reviewNote) console.log(`   "${s.reviewNote.substring(0, 100)}..."`);
  }

  console.log('\nBOTTOM together prestige dramas:');
  for (const s of prestigeDrama.slice(-10)) {
    console.log(`${s.rating}★ ${s.title} - ${s.genres?.join(', ')}`);
    if (s.reviewNote) console.log(`   "${s.reviewNote.substring(0, 100)}..."`);
  }

  // Limited series - often tackle one difficult story
  console.log('\n\n--- LIMITED SERIES (1 season, Ended) ---\n');
  const limited = rated.filter(s =>
    s.numberOfSeasons === 1 && s.showStatus === 'Ended' && s.watchPreference === 'together'
  ).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  for (const s of limited.slice(0, 15)) {
    console.log(`${s.rating}★ ${s.title} - ${s.genres?.join(', ')}`);
    if (s.reviewNote) console.log(`   "${s.reviewNote.substring(0, 100)}..."`);
  }

  // Look for shows with "boring" or "fizzled" - momentum failures
  console.log('\n\n--- MOMENTUM FAILURES (boring, fizzled, slow) ---\n');
  const momentumFail = rated.filter(s => {
    const text = `${s.reviewNote || ''}`.toLowerCase();
    return text.includes('boring') || text.includes('fizzled') || text.includes('slow') ||
           text.includes('dragged') || text.includes('didn\'t go anywhere') || text.includes('nothing happen');
  }).sort((a, b) => (a.rating || 0) - (b.rating || 0));

  for (const s of momentumFail) {
    console.log(`${s.rating}★ ${s.title} [${s.watchPreference}]`);
    console.log(`   "${s.reviewNote?.substring(0, 120)}..."`);
    console.log('');
  }

  // Character failures
  console.log('\n--- CHARACTER FAILURES (didn\'t like characters) ---\n');
  const charFail = rated.filter(s => {
    const text = `${s.reviewNote || ''}`.toLowerCase();
    return text.includes('didn\'t like') || text.includes('character') || text.includes('unlikeable') ||
           text.includes('annoying');
  }).sort((a, b) => (a.rating || 0) - (b.rating || 0));

  for (const s of charFail) {
    console.log(`${s.rating}★ ${s.title} [${s.watchPreference}]`);
    console.log(`   "${s.reviewNote?.substring(0, 120)}..."`);
    console.log('');
  }
}

analyze();
