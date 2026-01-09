import { NextRequest, NextResponse } from 'next/server';
import { addDeletedShow, deleteOverlay } from '@/lib/data';

// DELETE a show (adds to deleted list so it won't reappear from Trakt)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tmdbId = searchParams.get('tmdbId');
    const title = searchParams.get('title') || 'Unknown';

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 });
    }

    const tmdbIdNum = parseInt(tmdbId);

    // Add to deleted list so it won't reappear from Trakt
    await addDeletedShow({
      tmdbId: tmdbIdNum,
      title,
      deletedAt: new Date().toISOString()
    });

    // Also remove any overlay data
    await deleteOverlay(tmdbIdNum);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete show' },
      { status: 500 }
    );
  }
}
