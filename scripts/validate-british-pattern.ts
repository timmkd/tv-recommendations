import { db, shows } from '../src/lib/db';

async function analyze() {
  const allShows = await db.select().from(shows);
  const rated = allShows.filter(s => s.rating !== null && s.watchPreference === 'together');

  // Find crime/mystery shows
  const crimeMystery = rated.filter(s => {
    const genres = s.genres || [];
    return genres.includes('Crime') || genres.includes('Mystery');
  });

  console.log('=== CRIME/MYSTERY TOGETHER SHOWS BY ORIGIN ===\n');

  // Group by origin
  const byOrigin: Record<string, typeof crimeMystery> = {};
  for (const show of crimeMystery) {
    const origin = show.origin || 'unknown';
    if (!byOrigin[origin]) byOrigin[origin] = [];
    byOrigin[origin].push(show);
  }

  for (const [origin, shows] of Object.entries(byOrigin)) {
    const avg = shows.reduce((sum, s) => sum + (s.rating || 0), 0) / shows.length;
    console.log(`\n--- ${origin.toUpperCase()} (${shows.length} shows, avg ${avg.toFixed(2)}★) ---`);

    const sorted = shows.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    for (const s of sorted) {
      const hasComedy = s.genres?.includes('Comedy') ? '(+comedy)' : '';
      console.log(`${s.rating}★ ${s.title} ${hasComedy}`);
      if (s.reviewNote) console.log(`   "${s.reviewNote.substring(0, 80)}..."`);
    }
  }

  // Now let's look at bleak/dark shows regardless of origin
  console.log('\n\n=== BLEAK/DARK CRIME SHOWS (any origin) ===\n');

  const bleakCrime = crimeMystery.filter(s => {
    const note = (s.reviewNote || '').toLowerCase();
    const hasComedy = s.genres?.includes('Comedy');
    // No comedy and either low rating or dark notes
    return !hasComedy && (
      s.rating! <= 3 ||
      note.includes('dark') ||
      note.includes('bleak') ||
      note.includes('boring') ||
      note.includes('fizzled') ||
      note.includes('didn\'t like')
    );
  }).sort((a, b) => (a.rating || 0) - (b.rating || 0));

  for (const s of bleakCrime) {
    console.log(`${s.rating}★ ${s.title} [${s.origin || 'unknown'}]`);
    if (s.reviewNote) console.log(`   "${s.reviewNote.substring(0, 100)}..."`);
  }

  // Summary comparison
  console.log('\n\n=== SUMMARY: Is "British" a factor? ===\n');

  const british = crimeMystery.filter(s => s.origin === 'british');
  const american = crimeMystery.filter(s => s.origin === 'american' || s.origin === 'other');
  const australian = crimeMystery.filter(s => s.origin === 'australian');

  const britishNoComedy = british.filter(s => !s.genres?.includes('Comedy'));
  const americanNoComedy = american.filter(s => !s.genres?.includes('Comedy'));

  const avgBritishNoComedy = britishNoComedy.length > 0
    ? britishNoComedy.reduce((sum, s) => sum + (s.rating || 0), 0) / britishNoComedy.length
    : 0;
  const avgAmericanNoComedy = americanNoComedy.length > 0
    ? americanNoComedy.reduce((sum, s) => sum + (s.rating || 0), 0) / americanNoComedy.length
    : 0;

  console.log(`British crime (no comedy): ${britishNoComedy.length} shows, avg ${avgBritishNoComedy.toFixed(2)}★`);
  console.log(`American/unknown crime (no comedy): ${americanNoComedy.length} shows, avg ${avgAmericanNoComedy.toFixed(2)}★`);

  if (britishNoComedy.length > 0) {
    console.log('\nBritish crime without comedy:');
    for (const s of britishNoComedy.sort((a, b) => (b.rating || 0) - (a.rating || 0))) {
      console.log(`  ${s.rating}★ ${s.title}`);
    }
  }
}

analyze();
