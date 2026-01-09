# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Build for production
npm run lint     # Run ESLint
```

## Environment Variables

Required in `.env.local`:
- `TMDB_API_KEY` - The Movie Database API key for show search and metadata
- `OPENAI_API_KEY` - OpenAI API key for AI-powered recommendations (via `src/lib/openai.ts`)

## Architecture

This is a Next.js 16 app using the App Router with file-based JSON storage (no database).

### Data Flow

All data is stored in `data/*.json` files:
- `shows.json` - User's TV show library with ratings and watch status
- `episodes.json` - Episode watch tracking
- `settings.json` - Streaming service subscriptions and API keys
- `recommendations.json` - Generated recommendations for solo/with-wife contexts

Data access is centralized through `src/lib/data.ts` which provides typed CRUD functions for all JSON files.

### Key Libraries

- `src/lib/tmdb.ts` - TMDB API client for show search, metadata, and poster images
- `src/lib/openai.ts` - OpenAI integration for AI-powered recommendations
- `src/lib/trakt.ts` - Trakt.tv API for importing watch history
- `src/lib/rottentomatoes.ts` - Rotten Tomatoes scraper for critic scores

### API Routes

All under `src/app/api/`:
- `/api/shows` - CRUD operations for show library
- `/api/ratings` - Update show ratings
- `/api/settings` - Manage settings and subscriptions
- `/api/recommendations` - Generate AI recommendations
- `/api/tmdb/search` - Proxy for TMDB show search
- `/api/trakt` - Import from Trakt.tv

### Types

All TypeScript types are in `src/types/index.ts`. Key types: `Show`, `Episode`, `Settings`, `WatchPreference`.

---

## Rating System

Each show has a simple rating structure:

| Field | Purpose | AI Use |
|-------|---------|--------|
| `watchPreference` | "solo" or "together" | Filters recommendations by context |
| `watchPreferenceNote` | WHY this preference | Learns context patterns |
| `rating` | 0.5-5 stars | Weights show importance |
| `reviewNote` | What you liked/disliked, or why you dropped | Learns taste preferences |
| `notes` | General notes | Not used for AI |

### Show Data Format

```json
{
  "id": "uuid",
  "tmdbId": 12345,
  "title": "Show Name",
  "status": "watching" | "completed" | "watchlist" | "dropped",
  "watchPreference": "solo" | "together",
  "watchPreferenceNote": "Too intense for watching together",
  "rating": 4.5,
  "reviewNote": "Incredible tension, amazing character arc",
  "notes": "General notes"
}
```

---

## Generating Recommendations

When the user asks for TV recommendations, generate them by:

1. **Read the shows data** from `data/shows.json` to understand their viewing history and preferences
2. **Check subscribed services** in `data/settings.json` - only recommend shows available on those services
3. **Update recommendations** by writing to `data/recommendations.json`

### Recommendation Format

```json
{
  "generatedAt": "ISO date string",
  "subscribedServices": ["service-slugs"],
  "solo": [
    {
      "title": "Show Name",
      "year": 2024,
      "tmdbId": 12345,
      "posterPath": "/abc123.jpg",
      "reason": "Why they'd like it based on their history",
      "streamingServices": ["service-slug"],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "together": [
    // Same format - shows good for watching together
  ]
}
```

**Required fields**: Include `tmdbId` and `posterPath` when possible so poster images display on the recommendations page.

### Service Slugs
- `netflix`, `stan`, `binge`, `disney-plus`, `prime-video`
- `paramount-plus`, `apple-tv-plus`, `hbo-max`
- `foxtel-now`, `britbox`, `abc-iview`, `sbs-on-demand`

### Guidelines

**What NOT to recommend:**
- Shows with status "completed" (no rewatches unless explicitly asked)
- Shows with status "dropped" (already decided against these)

**OK to recommend:**
- Shows from the watchlist - these are good suggestions to prioritize
- Shows with status "watching" - can remind me about these
- New shows not in the library (preferred alongside watchlist items)

**How to determine Solo vs Together recommendations:**

1. **Filter by `watchPreference`:**
   - Shows with `watchPreference: "solo"` inform solo recommendations
   - Shows with `watchPreference: "together"` inform together recommendations

2. **Use `watchPreferenceNote` to understand patterns:**
   - "Too intense for together" → similar intense shows go to solo
   - "Great for relaxing together" → similar chill shows go to together

3. **Use `reviewNote` to understand taste:**
   - "Loved the cinematography and pacing" → recommend shows with similar qualities
   - "Dropped - too slow after ep 3" → avoid similar pacing issues

4. **Use `rating` to weight importance:**
   - 3-5 stars = shows I liked (use these to inform recommendations)
   - 4-5 stars = strong signal of preferences
   - 3 stars = liked but not a favorite
   - 1-2 stars = signal of what to avoid

**General tips:**
- Reference specific shows from their history to explain recommendations
- Don't assume genre preferences - let the preference notes guide you
- Match energy/tone based on what's rated highly, not stereotypes
