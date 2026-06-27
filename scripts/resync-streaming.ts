// @ts-nocheck
// Force re-sync streaming for all non-dropped shows via JustWatch (accurate source;
// Trakt watchnow/au currently returns empty). Logs changes to .streaming-resync-log.txt
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { writeFileSync, appendFileSync } from 'fs';
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { getStreamingAvailability, getStreamingByTitle } = require('../src/lib/justwatch');
const { getShowStreaming } = require('../src/lib/trakt');

const LOG = '.streaming-resync-log.txt';
const sameSet = (a, b) => {
  const A = [...new Set(a||[])].sort(), B = [...new Set(b||[])].sort();
  return A.length === B.length && A.every((x,i)=>x===B[i]);
};

async function main() {
  writeFileSync(LOG, `Streaming re-sync started\n`);
  const all = await db.select().from(shows);
  const targets = all.filter(s => s.title && !s.dropped);
  let processed = 0, changed = 0, nowEmpty = 0, filled = 0;
  const changes = [];

  for (const s of targets) {
    let services = [], url = undefined;
    try {
      // 1) JustWatch by TMDB id (filters flatrate/free correctly)
      const r1 = await getStreamingAvailability(s.tmdbId, s.title, s.year);
      services = r1.services; url = r1.justWatchUrl;
      // 2) JustWatch by title
      if (services.length === 0) {
        const r2 = await getStreamingByTitle(s.title, s.year);
        services = r2.services;
      }
      // 3) Trakt (last resort)
      if (services.length === 0 && s.traktSlug) {
        services = await getShowStreaming(s.traktSlug, 'au');
      }
    } catch (e) {
      appendFileSync(LOG, `ERR ${s.title}: ${e.message}\n`);
    }

    const before = s.streamingServices || [];
    if (!sameSet(before, services)) {
      changed++;
      if (before.length && !services.length) nowEmpty++;
      if (!before.length && services.length) filled++;
      const line = `CHANGED ${s.title}: [${before.join(',')}] -> [${services.join(',')}]`;
      changes.push(line); appendFileSync(LOG, line + '\n');
    }

    await db.update(shows).set({
      streamingServices: services.length ? services : null,
      streamingFetchedAt: new Date().toISOString(),
      justWatchUrl: url ?? s.justWatchUrl ?? null,
      updatedAt: new Date().toISOString(),
    }).where(eq(shows.tmdbId, s.tmdbId));

    processed++;
    if (processed % 25 === 0) appendFileSync(LOG, `...processed ${processed}/${targets.length}\n`);
    await new Promise(r => setTimeout(r, 130));
  }

  const summary = `\nDONE. processed=${processed} changed=${changed} (filled empty=${filled}, went empty=${nowEmpty})`;
  appendFileSync(LOG, summary + '\n');
  console.log(summary);
}
main().catch(e => { console.error(e); process.exit(1); });
