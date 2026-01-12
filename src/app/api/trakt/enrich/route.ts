import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getOverlayByTmdbId, saveOverlay, getOverlaysMap } from '@/lib/db/queries';
import { getUserShows } from '@/lib/trakt';
import { enrichShowWithTMDB } from '@/lib/tmdb';

// POST to enrich shows with TMDB metadata (posters, genres, overview, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbIds, forceRefresh = false } = body as {
      tmdbIds?: number[];
      forceRefresh?: boolean;
    };

    const settings = await getSettings();
    if (!settings.traktUsername) {
      return NextResponse.json(
        { error: 'Trakt username not configured' },
        { status: 400 }
      );
    }

    // Get all user shows from Trakt
    const traktShows = await getUserShows(settings.traktUsername);
    const overlaysMap = await getOverlaysMap();

    // Filter to shows that need metadata
    const showsToEnrich: { tmdbId: number; title: string }[] = [];

    for (const show of traktShows) {
      // If specific IDs provided, only fetch those
      if (tmdbIds && tmdbIds.length > 0 && !tmdbIds.includes(show.tmdbId)) {
        continue;
      }

      const overlay = overlaysMap.get(show.tmdbId);

      // Skip if we have complete metadata (unless force refresh)
      if (!forceRefresh && overlay?.posterPath && overlay?.overview && overlay?.genres?.length) {
        continue;
      }

      showsToEnrich.push({ tmdbId: show.tmdbId, title: show.title });
    }

    if (showsToEnrich.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All metadata is up to date',
        updated: 0,
        total: 0
      });
    }

    // Fetch metadata from TMDB
    let updated = 0;
    const results: Record<number, { posterPath?: string; genres?: string[] }> = {};

    for (const show of showsToEnrich) {
      try {
        const metadata = await enrichShowWithTMDB(show.tmdbId);

        // Get existing overlay and update metadata
        const existing = await getOverlayByTmdbId(show.tmdbId);

        await saveOverlay({
          tmdbId: show.tmdbId,
          ...existing,
          title: show.title,
          posterPath: metadata.posterPath || existing?.posterPath,
          overview: metadata.overview || existing?.overview,
          genres: metadata.genres.length > 0 ? metadata.genres : existing?.genres,
          year: metadata.year || existing?.year,
          numberOfSeasons: metadata.numberOfSeasons || existing?.numberOfSeasons,
          showStatus: metadata.showStatus || existing?.showStatus,
          tmdbRating: metadata.tmdbRating ?? existing?.tmdbRating,
          tmdbVoteCount: metadata.tmdbVoteCount ?? existing?.tmdbVoteCount
        });

        results[show.tmdbId] = {
          posterPath: metadata.posterPath,
          genres: metadata.genres
        };
        updated++;

        // Rate limit - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to enrich ${show.title}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: showsToEnrich.length,
      results
    });
  } catch (error) {
    console.error('Enrich error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enrich shows' },
      { status: 500 }
    );
  }
}

// GET to check how many shows need metadata
export async function GET() {
  try {
    const settings = await getSettings();
    if (!settings.traktUsername) {
      return NextResponse.json({ needsEnrichment: 0, total: 0 });
    }

    const traktShows = await getUserShows(settings.traktUsername);
    const overlaysMap = await getOverlaysMap();
    let needsEnrichment = 0;
    let missingPosters = 0;
    let missingGenres = 0;
    let missingOverview = 0;

    for (const show of traktShows) {
      const overlay = overlaysMap.get(show.tmdbId);

      let needsData = false;
      if (!overlay?.posterPath) {
        missingPosters++;
        needsData = true;
      }
      if (!overlay?.genres?.length) {
        missingGenres++;
        needsData = true;
      }
      if (!overlay?.overview) {
        missingOverview++;
        needsData = true;
      }

      if (needsData) {
        needsEnrichment++;
      }
    }

    return NextResponse.json({
      needsEnrichment,
      missingPosters,
      missingGenres,
      missingOverview,
      total: traktShows.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check enrichment status' },
      { status: 500 }
    );
  }
}
