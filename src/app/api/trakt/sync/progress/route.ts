import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getOverlays, saveOverlay } from '@/lib/db/queries';
import { isAuthenticated } from '@/lib/trakt';
import type { ShowOverlay, ShowStatus } from '@/types';

// POST: Sync progress from Trakt for a batch of shows
// Accepts { slugs: string[] } to sync specific shows, or syncs first 20 unsynced shows
export async function POST(request: NextRequest) {
  try {
    const settings = await getSettings();

    if (!settings.traktUsername) {
      return NextResponse.json(
        { error: 'Trakt username not configured' },
        { status: 400 }
      );
    }

    const hasAuth = await isAuthenticated();
    if (!hasAuth) {
      return NextResponse.json(
        { error: 'Not authenticated with Trakt' },
        { status: 401 }
      );
    }

    // Get request body for optional slug list
    let slugsToSync: string[] = [];
    try {
      const body = await request.json();
      if (body.slugs && Array.isArray(body.slugs)) {
        slugsToSync = body.slugs;
      }
    } catch {
      // No body or invalid JSON - that's fine, we'll auto-select
    }

    // Get all overlays
    const overlays = await getOverlays();

    // If no slugs provided, find shows that need syncing:
    // 1. Shows with no status (never synced)
    // 2. Shows with "watching" status (may have been completed since last sync)
    if (slugsToSync.length === 0) {
      const noStatus = overlays
        .filter(o => o.traktSlug && !o.status)
        .map(o => o.traktSlug!);
      const watching = overlays
        .filter(o => o.traktSlug && o.status === 'watching')
        .map(o => o.traktSlug!);
      // Prioritize unsynced shows, then re-check watching shows
      const needsSync = [...noStatus, ...watching].slice(0, 20);
      slugsToSync = needsSync;
    }

    if (slugsToSync.length === 0) {
      // Check total stats from stored statuses
      let watching = 0, completed = 0, watchlist = 0;
      for (const o of overlays) {
        if (o.status === 'watching') watching++;
        else if (o.status === 'completed') completed++;
        else if (o.status === 'watchlist') watchlist++;
      }

      return NextResponse.json({
        success: true,
        message: 'All shows already synced',
        updated: 0,
        remaining: 0,
        stats: { watching, completed, watchlist }
      });
    }

    // Fetch progress for each slug
    const TRAKT_API_URL = 'https://api.trakt.tv';
    const clientId = process.env.TRAKT_CLIENT_ID!;
    const accessToken = settings.traktAuth?.accessToken;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
    };

    let updated = 0;
    const slugToOverlay = new Map(overlays.filter(o => o.traktSlug).map(o => [o.traktSlug!, o]));

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < slugsToSync.length; i += batchSize) {
      const batch = slugsToSync.slice(i, i + batchSize);

      await Promise.all(batch.map(async (slug) => {
        try {
          const response = await fetch(
            `${TRAKT_API_URL}/shows/${slug}/progress/watched`,
            { headers }
          );

          if (!response.ok) return;

          const progress = await response.json();
          const overlay = slugToOverlay.get(slug);
          if (!overlay) return;

          // Determine status from progress
          // - No episodes watched = watchlist
          // - Some episodes watched = watching
          // - All episodes watched = completed
          let status: ShowStatus;
          if (progress.completed >= progress.aired && progress.aired > 0) {
            status = 'completed';
          } else if (progress.completed > 0) {
            status = 'watching';
          } else {
            // No progress = watchlist (don't default to completed!)
            status = 'watchlist';
          }

          // Update if changed
          if (overlay.status !== status) {
            await saveOverlay({
              ...overlay,
              status,
              updatedAt: new Date().toISOString(),
            });
            updated++;
          }
        } catch (err) {
          console.error(`Progress fetch failed for ${slug}:`, err);
        }
      }));

      // Small delay between batches
      if (i + batchSize < slugsToSync.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Count remaining: unsynced shows + watching shows not yet re-checked in this batch
    const remaining = overlays.filter(o => o.traktSlug && (!o.status || o.status === 'watching')).length - slugsToSync.length;

    // Count current stats
    let watching = 0, completed = 0, watchlist = 0;
    for (const o of overlays) {
      if (o.status === 'watching') watching++;
      else if (o.status === 'completed') completed++;
      else if (o.status === 'watchlist') watchlist++;
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${slugsToSync.length} shows`,
      updated,
      remaining: Math.max(0, remaining),
      stats: { watching, completed, watchlist }
    });
  } catch (error) {
    console.error('Progress sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync progress' },
      { status: 500 }
    );
  }
}
