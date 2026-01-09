import * as cheerio from 'cheerio';

interface RTRatings {
  criticsScore?: number;
  audienceScore?: number;
  criticsConsensus?: string;
}

// Search for a TV show on Rotten Tomatoes and get its ratings
export async function getRTRatings(showTitle: string, year?: number): Promise<RTRatings> {
  // Normalize the title for search
  const searchQuery = showTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');

  // Try to find the show page
  const searchUrl = `https://www.rottentomatoes.com/tv/${searchQuery}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      // Try alternative URL format
      return await searchRT(showTitle, year);
    }

    const html = await response.text();
    return parseRTPage(html);
  } catch (error) {
    console.error('RT fetch error:', error);
    // Try search as fallback
    return await searchRT(showTitle, year);
  }
}

// Search Rotten Tomatoes and find the show
async function searchRT(title: string, year?: number): Promise<RTRatings> {
  const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return {};
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find TV shows in search results
    const tvResults = $('search-page-media-row[data-type="tvSeries"]');

    if (tvResults.length === 0) {
      return {};
    }

    // Find the best match (by year if provided)
    let bestMatchScore: number | undefined;

    tvResults.each((_, el) => {
      const $el = $(el);
      const resultYear = parseInt($el.attr('releaseyear') || '0');
      const score = parseInt($el.attr('tomatometerscore') || '') || undefined;

      if (bestMatchScore === undefined) {
        bestMatchScore = score;
      } else if (year && resultYear === year && score !== undefined) {
        bestMatchScore = score;
      }
    });

    if (bestMatchScore !== undefined) {
      return { criticsScore: bestMatchScore };
    }

    return {};
  } catch {
    return {};
  }
}

// Parse a Rotten Tomatoes show page
function parseRTPage(html: string): RTRatings {
  const $ = cheerio.load(html);
  const ratings: RTRatings = {};

  // New RT structure (2024+): media-scorecard with rt-text slots
  const criticsScoreNew = $('rt-text[slot="criticsScore"]').text().trim();
  if (criticsScoreNew) {
    const score = parseInt(criticsScoreNew);
    if (!isNaN(score)) {
      ratings.criticsScore = score;
    }
  }

  const audienceScoreNew = $('rt-text[slot="audienceScore"]').text().trim();
  if (audienceScoreNew) {
    const score = parseInt(audienceScoreNew);
    if (!isNaN(score)) {
      ratings.audienceScore = score;
    }
  }

  // Fallback: Try legacy selectors
  if (!ratings.criticsScore) {
    const criticsScoreEl = $('[data-qa="tomatometer-score"]');
    if (criticsScoreEl.length > 0) {
      const score = parseInt(criticsScoreEl.text().trim());
      if (!isNaN(score)) {
        ratings.criticsScore = score;
      }
    }
  }

  if (!ratings.criticsScore) {
    const altCritics = $('score-board').attr('tomatometerscore');
    if (altCritics) {
      ratings.criticsScore = parseInt(altCritics);
    }
  }

  if (!ratings.audienceScore) {
    const audienceScoreEl = $('[data-qa="audience-score"]');
    if (audienceScoreEl.length > 0) {
      const score = parseInt(audienceScoreEl.text().trim());
      if (!isNaN(score)) {
        ratings.audienceScore = score;
      }
    }
  }

  if (!ratings.audienceScore) {
    const altAudience = $('score-board').attr('audiencescore');
    if (altAudience) {
      ratings.audienceScore = parseInt(altAudience);
    }
  }

  // Get critics consensus
  const consensusEl = $('[data-qa="critics-consensus"]');
  if (consensusEl.length > 0) {
    ratings.criticsConsensus = consensusEl.text().trim();
  }

  return ratings;
}

// Batch fetch ratings for multiple shows
export async function batchGetRTRatings(
  shows: { id: string; title: string; year?: number }[]
): Promise<Map<string, RTRatings>> {
  const results = new Map<string, RTRatings>();

  // Process in batches with rate limiting
  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];
    try {
      const ratings = await getRTRatings(show.title, show.year);
      results.set(show.id, ratings);

      // Rate limit: wait 1 second between requests
      if (i < shows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch {
      results.set(show.id, {});
    }
  }

  return results;
}
