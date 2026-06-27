import { NextRequest, NextResponse } from 'next/server';
import { getAllTags, getShowsWithTag } from '@/lib/db/queries';

// GET: List all tags (for autocomplete) or shows with a specific tag
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagName = searchParams.get('tag');

    if (tagName) {
      // Get all shows with this tag
      const tmdbIds = await getShowsWithTag(tagName);
      return NextResponse.json({ tag: tagName, tmdbIds });
    }

    // Return all tags for autocomplete
    const tags = await getAllTags();
    return NextResponse.json({ tags });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get tags' },
      { status: 500 }
    );
  }
}
