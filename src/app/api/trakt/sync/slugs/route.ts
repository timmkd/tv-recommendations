import { NextRequest, NextResponse } from 'next/server';
import { getOverlays, saveOverlay } from '@/lib/db/queries';

const TRAKT_API_URL = 'https://api.trakt.tv';

// POST: Backfill missing traktSlugs by looking up shows via TMDB ID
export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.TRAKT_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'TRAKT_CLIENT_ID not configured' },
        { status: 500 }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
    };

    // Get all overlays missing traktSlug
    const overlays = await getOverlays();
    const needsSlugs = overlays.filter(o => !o.traktSlug && o.tmdbId);

    // Get batch size from request (default 20)
    let batchSize = 20;
    try {
      const body = await request.json();
      if (body.batchSize && typeof body.batchSize === 'number') {
        batchSize = Math.min(body.batchSize, 50); // Cap at 50
      }
    } catch {
      // No body - use defaults
    }

    const toProcess = needsSlugs.slice(0, batchSize);

    if (toProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All shows have slugs',
        updated: 0,
        remaining: 0,
        total: overlays.length
      });
    }

    let updated = 0;
    const errors: string[] = [];

    // Process in parallel batches of 5 to respect rate limits
    const parallelBatchSize = 5;
    for (let i = 0; i < toProcess.length; i += parallelBatchSize) {
      const batch = toProcess.slice(i, i + parallelBatchSize);

      await Promise.all(batch.map(async (overlay) => {
        try {
          // Look up show by TMDB ID
          const response = await fetch(
            `${TRAKT_API_URL}/search/tmdb/${overlay.tmdbId}?type=show`,
            { headers }
          );

          if (!response.ok) {
            if (response.status === 429) {
              errors.push(`Rate limited at ${overlay.title}`);
              return;
            }
            errors.push(`Failed to find ${overlay.title}: ${response.status}`);
            return;
          }

          const results = await response.json();
          if (results.length === 0) {
            errors.push(`No Trakt match for ${overlay.title} (tmdbId: ${overlay.tmdbId})`);
            return;
          }

          // Get the slug from the first result
          const traktSlug = results[0]?.show?.ids?.slug;
          if (!traktSlug) {
            errors.push(`No slug in response for ${overlay.title}`);
            return;
          }

          // Save the slug
          await saveOverlay({
            ...overlay,
            traktSlug,
            updatedAt: new Date().toISOString(),
          });
          updated++;
        } catch (err) {
          errors.push(`Error processing ${overlay.title}: ${err}`);
        }
      }));

      // Small delay between batches
      if (i + parallelBatchSize < toProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const remaining = needsSlugs.length - toProcess.length;

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} of ${toProcess.length} shows`,
      updated,
      processed: toProcess.length,
      remaining,
      errors: errors.length > 0 ? errors : undefined,
      total: overlays.length
    });
  } catch (error) {
    console.error('Slug sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync slugs' },
      { status: 500 }
    );
  }
}

// GET: Check how many shows are missing slugs
export async function GET() {
  try {
    const overlays = await getOverlays();
    const missingSlugs = overlays.filter(o => !o.traktSlug && o.tmdbId);
    const hasSlugs = overlays.filter(o => o.traktSlug);

    return NextResponse.json({
      total: overlays.length,
      hasSlugs: hasSlugs.length,
      missingSlugs: missingSlugs.length,
      sampleMissing: missingSlugs.slice(0, 10).map(o => ({
        title: o.title,
        tmdbId: o.tmdbId,
        year: o.year
      }))
    });
  } catch (error) {
    console.error('Slug check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check slugs' },
      { status: 500 }
    );
  }
}
