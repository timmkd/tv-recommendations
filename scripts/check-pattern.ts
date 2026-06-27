import { db, shows } from '../src/lib/db';

async function search() {
  const allShows = await db.select().from(shows);

  const togetherCrimeMystery = allShows.filter(s =>
    s.watchPreference === 'together' &&
    s.rating !== null &&
    (s.genres?.includes('Crime') || s.genres?.includes('Mystery'))
  ).map(s => ({
    title: s.title,
    rating: s.rating,
    genres: s.genres?.join(', '),
    hasComedy: s.genres?.includes('Comedy') ? 'YES' : 'no',
    note: s.reviewNote?.substring(0, 80)
  })).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  console.log('=== TOGETHER Crime/Mystery shows ===\n');
  for (const s of togetherCrimeMystery) {
    console.log(`${s.rating}★ ${s.title} [Comedy: ${s.hasComedy}]`);
    console.log(`   Genres: ${s.genres}`);
    if (s.note) console.log(`   Note: ${s.note}...`);
    console.log('');
  }

  // Summary
  const withComedy = togetherCrimeMystery.filter(s => s.hasComedy === 'YES');
  const withoutComedy = togetherCrimeMystery.filter(s => s.hasComedy === 'no');

  const avgWithComedy = withComedy.reduce((sum, s) => sum + (s.rating || 0), 0) / withComedy.length;
  const avgWithoutComedy = withoutComedy.reduce((sum, s) => sum + (s.rating || 0), 0) / withoutComedy.length;

  console.log('=== SUMMARY ===');
  console.log(`Crime/Mystery WITH Comedy: ${withComedy.length} shows, avg ${avgWithComedy.toFixed(2)}★`);
  console.log(`Crime/Mystery WITHOUT Comedy: ${withoutComedy.length} shows, avg ${avgWithoutComedy.toFixed(2)}★`);
}

search();
