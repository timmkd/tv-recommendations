// JustWatch GraphQL API for streaming availability
// Australia locale: en_AU

const JUSTWATCH_GRAPHQL = 'https://apis.justwatch.com/graphql';
const LOCALE = 'en_AU';
const COUNTRY = 'AU';

// Map JustWatch provider IDs to our slug format (Australia)
// IDs verified via JustWatch GraphQL API January 2026
const PROVIDER_MAP: Record<number, string> = {
  8: 'netflix',
  119: 'prime-video',
  337: 'disney-plus',
  21: 'stan',
  385: 'binge',
  134: 'foxtel-now',
  350: 'apple-tv-plus',      // Apple TV (streaming service)
  531: 'paramount-plus',
  151: 'britbox',
  135: 'abc-iview',
  132: 'sbs-on-demand',
  1899: 'max',               // HBO Max
  82: 'ten-play',             // 10 Play (free, ad-supported)
  // Additional ad-supported/channel variants (map to same slug)
  1796: 'netflix',           // Netflix Standard with Ads
  2100: 'prime-video',       // Amazon Prime Video with Ads
  2303: 'paramount-plus',    // Paramount Plus Premium
  2304: 'paramount-plus',    // Paramount Plus Basic with Ads
};

// Reverse map for lookup
const SLUG_TO_PROVIDER: Record<string, number> = {
  'netflix': 8,
  'prime-video': 119,
  'disney-plus': 337,
  'stan': 21,
  'binge': 385,
  'foxtel-now': 134,
  'apple-tv-plus': 2,
  'paramount-plus': 531,
  'britbox': 380,
  'abc-iview': 29,
  'sbs-on-demand': 132,
  'hbo-max': 384,
};

interface JustWatchOffer {
  providerId: number;
  providerName: string;
  monetizationType: 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';
  presentationType: string;
}

interface StreamingResult {
  services: string[];  // Our slug format
  allOffers: JustWatchOffer[];
  justWatchUrl?: string;
}

interface JustWatchShow {
  id: string;
  objectId: number;
  objectType: string;
  title: string;
  originalReleaseYear: number;
  tmdbId?: number;
  posterUrl?: string;
  offers: JustWatchOffer[];
}

// Search for a show on JustWatch
export async function searchJustWatch(title: string, year?: number): Promise<JustWatchShow[]> {
  const query = `
    query SearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!) {
      popularTitles(
        country: $country
        filter: $searchTitlesFilter
        first: 10
      ) {
        edges {
          node {
            id
            objectId
            objectType
            content(country: $country, language: $language) {
              title
              originalReleaseYear
              externalIds {
                tmdbId
              }
              posterUrl
            }
            offers(country: $country, platform: WEB) {
              monetizationType
              presentationType
              package {
                id
                packageId
                clearName
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    searchTitlesFilter: {
      searchQuery: title,
      objectTypes: ['SHOW'],
    },
    country: COUNTRY,
    language: 'en',
  };

  try {
    const response = await fetch(JUSTWATCH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`JustWatch search failed: ${response.status}`);
    }

    const data = await response.json();
    const edges = data?.data?.popularTitles?.edges || [];

    return edges.map((edge: any) => {
      const node = edge.node;
      const content = node.content;
      return {
        id: node.id,
        objectId: node.objectId,
        objectType: node.objectType,
        title: content?.title || '',
        originalReleaseYear: content?.originalReleaseYear,
        tmdbId: content?.externalIds?.tmdbId,
        posterUrl: content?.posterUrl,
        offers: (node.offers || []).map((offer: any) => ({
          providerId: offer.package?.packageId,
          providerName: offer.package?.clearName,
          monetizationType: offer.monetizationType?.toLowerCase(),
          presentationType: offer.presentationType,
        })),
      };
    });
  } catch (error) {
    console.error('JustWatch search error:', error);
    return [];
  }
}

// Get streaming availability for a show by TMDB ID
// Uses search to find the show and matches by TMDB ID for accuracy
export async function getStreamingAvailability(tmdbId: number, title?: string, year?: number): Promise<StreamingResult> {
  const query = `
    query SearchByTmdb($filter: TitleFilter!, $country: Country!, $language: Language!) {
      popularTitles(
        country: $country
        filter: $filter
        first: 20
      ) {
        edges {
          node {
            id
            objectId
            objectType
            content(country: $country, language: $language) {
              title
              originalReleaseYear
              fullPath
              externalIds {
                tmdbId
              }
            }
            offers(country: $country, platform: WEB) {
              monetizationType
              presentationType
              package {
                id
                packageId
                clearName
              }
            }
          }
        }
      }
    }
  `;

  // Build search filter - prefer searching by title if available
  const searchQuery = title || `tmdb:${tmdbId}`;

  const variables = {
    filter: {
      searchQuery,
      objectTypes: ['SHOW'],
    },
    country: COUNTRY,
    language: 'en',
  };

  try {
    const response = await fetch(JUSTWATCH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`JustWatch query failed: ${response.status}`);
    }

    const data = await response.json();
    const edges = data?.data?.popularTitles?.edges || [];

    // Find the show matching our TMDB ID
    let matchedNode = null;
    for (const edge of edges) {
      const node = edge.node;
      const nodeTmdbId = node.content?.externalIds?.tmdbId;

      // Match by TMDB ID (primary)
      if (nodeTmdbId && String(nodeTmdbId) === String(tmdbId)) {
        matchedNode = node;
        break;
      }

      // Match by year if no TMDB match found yet (fallback)
      if (!matchedNode && year && node.content?.originalReleaseYear === year) {
        matchedNode = node;
      }
    }

    // If no match by TMDB ID, take first result as last resort
    if (!matchedNode && edges.length > 0) {
      matchedNode = edges[0].node;
    }

    if (!matchedNode) {
      return { services: [], allOffers: [] };
    }

    const offers: JustWatchOffer[] = (matchedNode.offers || []).map((offer: any) => ({
      providerId: offer.package?.packageId,
      providerName: offer.package?.clearName,
      monetizationType: offer.monetizationType?.toLowerCase(),
      presentationType: offer.presentationType,
    }));

    // Free-tier providers (ad-supported public broadcasters)
    const FREE_PROVIDERS = new Set([135, 132]); // ABC iview, SBS On Demand

    // Filter to "flatrate" (subscription) or "free" (for public broadcasters) offers
    const subscriptionServices = offers
      .filter(o => o.monetizationType === 'flatrate' || (o.monetizationType === 'free' && FREE_PROVIDERS.has(o.providerId)))
      .map(o => PROVIDER_MAP[o.providerId])
      .filter((slug): slug is string => !!slug);

    // Dedupe
    const uniqueServices = [...new Set(subscriptionServices)];

    const fullPath = matchedNode.content?.fullPath;
    const justWatchUrl = fullPath
      ? `https://www.justwatch.com${fullPath}`
      : undefined;

    return {
      services: uniqueServices,
      allOffers: offers,
      justWatchUrl,
    };
  } catch (error) {
    console.error('JustWatch availability error:', error);
    return { services: [], allOffers: [] };
  }
}

// Search and get streaming for a show by title (fallback when no TMDB ID)
export async function getStreamingByTitle(title: string, year?: number): Promise<StreamingResult> {
  const results = await searchJustWatch(title, year);

  if (results.length === 0) {
    return { services: [], allOffers: [] };
  }

  // Find best match by year if provided
  const match = year
    ? results.find(r => r.originalReleaseYear === year) || results[0]
    : results[0];

  // Free-tier providers (ad-supported public broadcasters)
  const FREE_PROVIDERS = new Set([135, 132]); // ABC iview, SBS On Demand

  // If we have offers from search, use those
  if (match.offers.length > 0) {
    const subscriptionServices = match.offers
      .filter(o => o.monetizationType === 'flatrate' || (o.monetizationType === 'free' && FREE_PROVIDERS.has(o.providerId)))
      .map(o => PROVIDER_MAP[o.providerId])
      .filter((slug): slug is string => !!slug);

    return {
      services: [...new Set(subscriptionServices)],
      allOffers: match.offers,
    };
  }

  // Otherwise, if we got a TMDB ID, query directly
  if (match.tmdbId) {
    return getStreamingAvailability(match.tmdbId);
  }

  return { services: [], allOffers: [] };
}

// Batch get streaming availability for multiple shows
export async function batchGetStreaming(
  shows: { id: string; tmdbId?: number; title: string; year?: number }[]
): Promise<Map<string, StreamingResult>> {
  const results = new Map<string, StreamingResult>();

  for (const show of shows) {
    try {
      let result: StreamingResult;

      if (show.tmdbId) {
        result = await getStreamingAvailability(show.tmdbId);
      } else {
        result = await getStreamingByTitle(show.title, show.year);
      }

      results.set(show.id, result);

      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch {
      results.set(show.id, { services: [], allOffers: [] });
    }
  }

  return results;
}

// Get user's watchlist from JustWatch (requires profile URL parsing)
export async function getWatchlist(profileUrl: string): Promise<JustWatchShow[]> {
  // JustWatch profile URLs look like: https://www.justwatch.com/au/profile/username
  // or they might share a list URL

  // Extract username from URL
  const match = profileUrl.match(/justwatch\.com\/\w+\/(?:profile|lists)\/([^\/\?]+)/i);
  if (!match) {
    throw new Error('Invalid JustWatch profile URL. Expected format: https://www.justwatch.com/au/profile/username');
  }

  const username = match[1];

  // Unfortunately, JustWatch's watchlist API requires authentication
  // We can try the public lists endpoint
  const query = `
    query GetUserLists($userId: ID!) {
      publicLists(userId: $userId, first: 10) {
        edges {
          node {
            id
            name
            items(first: 100) {
              edges {
                node {
                  ... on Show {
                    id
                    objectId
                    objectType
                    content(country: "${COUNTRY}", language: "en") {
                      title
                      originalReleaseYear
                      externalIds {
                        tmdbId
                      }
                      posterUrl
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  // Note: This may not work without proper authentication
  // As a fallback, we can provide manual import via CSV or guide users
  // to export their watchlist

  console.log('JustWatch watchlist import is limited - profile:', username);

  // Return empty for now - JustWatch doesn't expose public watchlists easily
  return [];
}
