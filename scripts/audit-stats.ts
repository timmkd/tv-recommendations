// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');

const avg = (xs) => xs.length ? (xs.reduce((a,s)=>a+s.rating,0)/xs.length).toFixed(2) : 'n/a';

async function main() {
  const all = await db.select().from(shows);
  const rated = all.filter(s => s.rating != null);
  const kept = rated.filter(s => !s.dropped);
  const dropped = rated.filter(s => s.dropped);

  const by = (set, pref) => set.filter(s => s.watchPreference === pref);

  console.log('================ RATING STATS ================');
  console.log(`Total rated rows: ${rated.length}  (kept: ${kept.length}, dropped: ${dropped.length})\n`);

  console.log('--- KEPT only (excl dropped) ---');
  console.log(`  solo:     n=${by(kept,'solo').length}  avg=${avg(by(kept,'solo'))}`);
  console.log(`  together: n=${by(kept,'together').length}  avg=${avg(by(kept,'together'))}`);
  console.log(`  all kept: n=${kept.length}  avg=${avg(kept)}`);

  console.log('\n--- INCL dropped (matches old profile methodology) ---');
  console.log(`  solo:     n=${by(rated,'solo').length}  avg=${avg(by(rated,'solo'))}`);
  console.log(`  together: n=${by(rated,'together').length}  avg=${avg(by(rated,'together'))}`);
  console.log(`  all:      n=${rated.length}  avg=${avg(rated)}`);

  console.log('\n--- dropped breakdown ---');
  console.log(`  solo dropped:     n=${by(dropped,'solo').length} avg=${avg(by(dropped,'solo'))}`);
  console.log(`  together dropped: n=${by(dropped,'together').length} avg=${avg(by(dropped,'together'))}`);

  // Full distribution (incl dropped) for the profile table
  console.log('\n--- distribution (all rated incl dropped) ---');
  const tiers = {};
  for (const s of rated) tiers[s.rating] = (tiers[s.rating]||0)+1;
  for (const k of Object.keys(tiers).sort((a,b)=>b-a)) console.log(`  ${k}★: ${tiers[k]}`);
}
main().catch(e => { console.error(e); process.exit(1); });
