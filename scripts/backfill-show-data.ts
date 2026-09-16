// @ts-nocheck
/**
 * Fill in whatever external data a show is MISSING, so a prediction is never made
 * against a half-populated row and an imported show never sits in the library
 * without streaming availability.
 *
 * Fills (only when the field is currently empty — never overwrites):
 *   - TMDB metadata (genres/overview/seasons/poster) for stub rows
 *   - streamingServices + justWatchUrl   (JustWatch by TMDB id, then by title)
 *   - rtCriticsScore / rtAudienceScore   (Rotten Tomatoes scrape)
 *
 * REPORTS but cannot fill (needs credentials that are currently unavailable):
 *   - traktSlug / traktRating / imdbId — Trakt app registration is gone (403 on
 *     every call). Capture them from a logged-in browser session and write them
 *     with scripts/backfill-trakt-meta.ts.
 *   - imdbRating — needs OMDB_API_KEY in .env.local.
 *
 * Targets (pick one):
 *   default        shows with no prediction and no rating (the /predict-new-shows set)
 *   --tmdb a,b,c   explicit tmdb ids
 *   --all-missing  every non-dropped show missing streaming or RT
 *
 * Run: npx tsx scripts/backfill-show-data.ts [target] [--dry-run] [--refresh]
 *   --refresh  also re-fetch fields that already have a value
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { db, shows } = require('../src/lib/db');
const { eq } = require('drizzle-orm');
const { getStreamingAvailability, getStreamingByTitle } = require('../src/lib/justwatch');
const { getRTRatings } = require('../src/lib/rottentomatoes');
const { enrichShowWithTMDB } = require('../src/lib/tmdb');

const isEmptyList = (v) => {
  if (!v) return true;
  try {
    const a = typeof v === 'string' ? JSON.parse(v) : v;
    return !Array.isArray(a) || a.length === 0;
  } catch {
    return true;
  }
};

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const refresh = argv.includes('--refresh');
  const tmdbIdx = argv.indexOf('--tmdb');
  const allMissing = argv.includes('--all-missing');

  const all = await db.select().from(shows);
  let targets;
  if (tmdbIdx > -1) {
    const ids = String(argv[tmdbIdx + 1] || '')
      .split(',')
      .map((x) => Number(x.trim()))
      .filter(Boolean);
    if (!ids.length) {
      console.error('RESULT: FAIL — --tmdb needs a comma-separated list of ids');
      process.exit(1);
    }
    targets = all.filter((s) => ids.includes(s.tmdbId));
    const found = new Set(targets.map((s) => s.tmdbId));
    for (const id of ids) if (!found.has(id)) console.log(`  MISS tmdb=${id} — not in DB`);
  } else if (allMissing) {
    targets = all.filter(
      (s) => !s.dropped && (isEmptyList(s.streamingServices) || s.rtCriticsScore == null)
    );
  } else {
    targets = all.filter((s) => !s.dropped && s.predictedRating == null && s.rating == null);
  }

  console.log(`=== BACKFILL ${targets.length} show(s)${dryRun ? ' (DRY RUN)' : ''} ===\n`);

  let filledStreaming = 0,
    filledRT = 0,
    filledMeta = 0,
    rtAttempted = 0;
  const needTrakt = [],
    needImdb = [];

  for (const s of targets) {
    const set = {};
    const notes = [];

    // --- TMDB metadata, only for stub rows ---
    const metaMissing =
      isEmptyList(s.genres) ||
      !s.overview ||
      !s.posterPath ||
      !s.numberOfSeasons ||
      !s.year ||
      !s.showStatus ||
      s.tmdbRating == null;
    if (refresh || metaMissing) {
      try {
        const t = await enrichShowWithTMDB(s.tmdbId);
        if (t) {
          if (t.genres && (refresh || isEmptyList(s.genres))) set.genres = t.genres;
          if (t.overview && (refresh || !s.overview)) set.overview = t.overview;
          if (t.posterPath && (refresh || !s.posterPath)) set.posterPath = t.posterPath;
          if (t.numberOfSeasons && (refresh || !s.numberOfSeasons))
            set.numberOfSeasons = t.numberOfSeasons;
          if (t.year && (refresh || !s.year)) set.year = t.year;
          if (t.showStatus && (refresh || !s.showStatus)) set.showStatus = t.showStatus;
          if (t.tmdbRating != null && (refresh || s.tmdbRating == null))
            set.tmdbRating = t.tmdbRating;
          if (t.tmdbVoteCount != null && (refresh || s.tmdbVoteCount == null))
            set.tmdbVoteCount = t.tmdbVoteCount;
          if (Object.keys(set).length) {
            notes.push('tmdb-meta');
            filledMeta++;
          }
        }
      } catch (e) {
        notes.push(`tmdb-ERR(${e.message})`);
      }
    }

    // --- streaming ---
    if (refresh || isEmptyList(s.streamingServices)) {
      let services = [],
        url;
      try {
        const r1 = await getStreamingAvailability(s.tmdbId, s.title, s.year);
        services = r1.services;
        url = r1.justWatchUrl;
        if (!services.length) {
          const r2 = await getStreamingByTitle(s.title, s.year);
          services = r2.services;
        }
      } catch (e) {
        notes.push(`jw-ERR(${e.message})`);
      }
      set.streamingFetchedAt = new Date().toISOString();
      if (services.length) {
        set.streamingServices = services;
        if (url) set.justWatchUrl = url;
        notes.push(`streaming=[${services.join(',')}]`);
        filledStreaming++;
      } else {
        notes.push('streaming=none-in-AU');
      }
    }

    // --- Rotten Tomatoes ---
    if (refresh || s.rtCriticsScore == null) {
      rtAttempted++;
      try {
        const rt = await getRTRatings(s.title, s.year);
        if (rt && (rt.criticsScore != null || rt.audienceScore != null)) {
          if (rt.criticsScore != null) set.rtCriticsScore = rt.criticsScore;
          if (rt.audienceScore != null) set.rtAudienceScore = rt.audienceScore;
          set.rtFetchedAt = new Date().toISOString();
          notes.push(`rt=${rt.criticsScore ?? '-'}/${rt.audienceScore ?? '-'}`);
          filledRT++;
        } else {
          notes.push('rt=not-found');
        }
      } catch (e) {
        notes.push(`rt-ERR(${e.message})`);
      }
    }

    // --- report what we cannot fill here ---
    if (!s.traktSlug || s.traktRating == null) needTrakt.push(s.title);
    if (s.imdbRating == null) needImdb.push(s.title);

    console.log(`${s.title} (${s.year})  ${notes.length ? notes.join('  ') : 'nothing missing'}`);

    if (!dryRun && Object.keys(set).length) {
      set.updatedAt = new Date().toISOString();
      await db.update(shows).set(set).where(eq(shows.tmdbId, s.tmdbId));
    }
  }

  // A per-show "rt=not-found" looks like the show simply isn't on RT. When EVERY
  // lookup misses, the scraper is broken instead — say so loudly rather than let a
  // site-wide failure read as a pile of absent shows (the Trakt-403 lesson).
  if (rtAttempted >= 5 && filledRT === 0) {
    console.log(
      `\n⚠️  RT SCRAPER LIKELY BROKEN — ${rtAttempted} lookups, 0 scores returned.`
    );
    console.log(
      '  getRTRatings() is returning {} for titles that definitely have RT pages'
    );
    console.log(
      '  (verified: Severance, Andor, Slow Horses). Treat every "rt=not-found" above'
    );
    console.log(
      '  as UNKNOWN, not as absent, and fix src/lib/rottentomatoes.ts before trusting it.'
    );
    console.log(
      '  Low urgency: RT correlates 0.18 critics / 0.13 audience — the profile says ignore it.'
    );
  }

  if (needTrakt.length) {
    console.log(
      `\nCANNOT FILL — Trakt slug/rating missing for ${needTrakt.length}: ${needTrakt.slice(0, 8).join(', ')}${needTrakt.length > 8 ? ', ...' : ''}`
    );
    console.log(
      '  Trakt app registration is gone (403). Capture from a logged-in browser session,'
    );
    console.log('  then write with: npx tsx scripts/backfill-trakt-meta.ts');
  }
  if (needImdb.length) {
    console.log(
      `\nCANNOT FILL — imdbRating missing for ${needImdb.length} show(s): needs OMDB_API_KEY in .env.local`
    );
  }

  console.log(
    `\nSUMMARY: targets=${targets.length} filledStreaming=${filledStreaming} filledRT=${filledRT}/${rtAttempted} filledMeta=${filledMeta} needTrakt=${needTrakt.length} needImdb=${needImdb.length} rtScraperBroken=${rtAttempted >= 5 && filledRT === 0}`
  );
  console.log(`RESULT: ${dryRun ? 'DRY-RUN OK' : 'OK'}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`RESULT: FAIL — ${e.message}`);
  process.exit(1);
});
