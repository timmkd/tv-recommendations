import { NextRequest, NextResponse } from 'next/server';
import {
  addDeletedShow,
  deleteOverlay,
  getOverlayByTmdbId,
  saveOverlay,
  clearDeletedShow
} from '@/lib/db/queries';
import { overlayToShow, tmdbIdFromShowId } from '@/lib/showMapper';
import { enrichShowWithTMDB, getShowDetails } from '@/lib/tmdb';
import type { ShowOverlay, ShowStatus } from '@/types';

// Fields TMDB owns. Used on add/enrich so we never null out existing data, and
// never touch user fields (rating/ratedAt/reviewNote/watchPreference/bingeability).
const TMDB_FIELDS = [
  'title', 'year', 'posterPath', 'overview', 'genres',
  'numberOfSeasons', 'showStatus', 'tmdbRating', 'tmdbVoteCount'
] as const;

// The show detail page passes a synthetic `overlay-<tmdbId>` id; scripts and
// other callers pass a bare tmdbId. Accept either.
function resolveTmdbId(request: NextRequest): number | null {
  const p = request.nextUrl.searchParams;
  return tmdbIdFromShowId(p.get('tmdbId')) ?? tmdbIdFromShowId(p.get('id'));
}

// GET a single show by id (`overlay-<tmdbId>`) or tmdbId.
export async function GET(request: NextRequest) {
  try {
    const tmdbId = resolveTmdbId(request);
    if (!tmdbId) {
      return NextResponse.json({ error: 'id or tmdbId is required' }, { status: 400 });
    }

    const overlay = await getOverlayByTmdbId(tmdbId);
    if (!overlay || !overlay.title) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

    return NextResponse.json(overlayToShow(overlay));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load show' },
      { status: 500 }
    );
  }
}

// POST — add a show by tmdbId, metadata from TMDB only (no Trakt).
// Mirrors scripts/add-show-by-tmdb.ts: idempotent, enriches an existing row in
// place, never overwrites with nulls, never touches user fields.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tmdbId = Number(body.tmdbId);
    const status: ShowStatus = body.status ?? 'watchlist';

    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 });
    }
    if (!['watchlist', 'watching', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be watchlist, watching or completed' },
        { status: 400 }
      );
    }

    // enrichShowWithTMDB swallows errors and omits the title, so fetch details
    // first — that is what surfaces a bad or movie id as a real failure rather
    // than silently writing a stub row.
    let details, tmdbData;
    try {
      details = await getShowDetails(tmdbId);
      tmdbData = await enrichShowWithTMDB(tmdbId);
    } catch {
      return NextResponse.json(
        { error: `TMDB lookup failed for ${tmdbId} (a movie id will 404 here — TV ids only)` },
        { status: 502 }
      );
    }
    if (!details?.name) {
      return NextResponse.json(
        { error: `TMDB returned no name for ${tmdbId}; is that a TV id?` },
        { status: 400 }
      );
    }

    const existing = await getOverlayByTmdbId(tmdbId);
    const next: ShowOverlay = {
      ...(existing || {}),
      tmdbId,
      title: details.name,
      updatedAt: new Date().toISOString(),
      ...(existing ? {} : { status, createdAt: new Date().toISOString() })
    };
    const writable = next as unknown as Record<string, unknown>;
    const source = tmdbData as unknown as Record<string, unknown>;
    for (const f of TMDB_FIELDS) {
      const v = source[f];
      if (v !== undefined && v !== null) writable[f] = v;
    }
    // Title comes from getShowDetails, which is the authoritative one.
    next.title = details.name;

    await saveOverlay(next);
    // Re-adding a show the user previously deleted must lift the tombstone,
    // otherwise it is filtered straight back out of the library.
    await clearDeletedShow(tmdbId);

    return NextResponse.json(overlayToShow(next), { status: existing ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add show' },
      { status: 500 }
    );
  }
}

// DELETE a show (adds to deleted list so it won't reappear from Trakt)
export async function DELETE(request: NextRequest) {
  try {
    const tmdbId = resolveTmdbId(request);
    const titleParam = request.nextUrl.searchParams.get('title');

    if (!tmdbId) {
      return NextResponse.json({ error: 'id or tmdbId is required' }, { status: 400 });
    }

    // Fall back to the stored title so a caller that only knows the id still
    // writes a readable tombstone.
    const existing = await getOverlayByTmdbId(tmdbId);
    const title = titleParam || existing?.title || 'Unknown';

    // Add to deleted list so it won't reappear from Trakt
    await addDeletedShow({
      tmdbId,
      title,
      deletedAt: new Date().toISOString()
    });

    // Also remove any overlay data
    await deleteOverlay(tmdbId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete show' },
      { status: 500 }
    );
  }
}
