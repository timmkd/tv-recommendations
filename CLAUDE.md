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
- `TRAKT_CLIENT_ID` - Trakt API client ID for show sync and ratings
- `TRAKT_CLIENT_SECRET` - Trakt API client secret for OAuth

Optional:
- `OPENAI_API_KEY` - OpenAI API key for AI-powered recommendations (via `src/lib/openai.ts`)
- `OMDB_API_KEY` - OMDB API key for IMDB ratings (free at omdbapi.com, 1000 requests/day)

## Architecture

This is a Next.js 16 app using the App Router with file-based JSON storage (no database).

### Data Flow

All data is stored in `data/*.json` files:
- `overlays.json` - User ratings, notes, predictions, and show metadata (synced from Trakt)
- `episodes.json` - Episode watch tracking
- `settings.json` - Streaming service subscriptions and API keys
- `recommendations.json` - Curated recommendations for solo/together contexts (subscribed services only)

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
  "status": "watching" | "completed" | "watchlist",
  "dropped": false,
  "watchPreference": "solo" | "together",
  "watchPreferenceNote": "Too intense for watching together",
  "rating": 4.5,
  "reviewNote": "Incredible tension, amazing character arc",
  "notes": "General notes"
}
```

**Note on `dropped`:** Shows with `dropped: true` are hidden from all views but kept in the data for taste analysis. Use these to understand what the user doesn't like.

---

## Generating Recommendations

### Two Types of Predictions

1. **Predictions (in `overlays.json`)** - Rating predictions for ALL shows regardless of subscription status
   - Used to show predicted ratings in the UI for any show
   - When user changes subscriptions, they can see what's good on each service
   - Do NOT mention platform names in prediction reasons (e.g., don't say "On Netflix")

2. **Recommendations (in `recommendations.json`)** - Curated picks for SUBSCRIBED services only
   - The "what to watch now" list
   - Only includes shows available on currently subscribed services
   - Can mention platform names since these are actionable

### Workflow

1. **Read the shows data** from `data/overlays.json` to understand viewing history and preferences
2. **Check subscribed services** in `data/settings.json`
3. **For predictions**: Add `predictedRating` and `predictedRatingReason` to shows in overlays.json
4. **For recommendations**: Write top picks to `data/recommendations.json` (subscribed services only)

### Prediction Format (in overlays.json)

Add these fields to show entries:
```json
{
  "tmdbId": 12345,
  "predictedRating": 4,
  "predictedRatingReason": "Predicted 4★: [Why based on taste profile]. COMPLETE 4 seasons.",
  "recommendedWatchPreference": "solo" | "together",
  // ... other show data
}
```

**Prediction reason guidelines:**
- Start with "Predicted X★:"
- Reference similar shows from their history with ratings
- Note if COMPLETE/LIMITED series (reduces cancellation anxiety)
- Note RT scores if notable (90%+)
- Do NOT mention streaming platform names

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
- `paramount-plus`, `apple-tv-plus`, `max`
- `foxtel-now`, `britbox`, `abc-iview`, `sbs-on-demand`

### Current Subscriptions
Check `data/settings.json` for current subscriptions. As of last update: Stan, Prime Video, Max, ABC iview, SBS On Demand.

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
   - 5★ = Exceptional, all-time favorite
   - 4-4.5★ = Strong signal - would recommend, use heavily for taste matching
   - 3-3.5★ = Enjoyed it, still a good show - use for general patterns
   - 2-2.5★ = Dropped or disappointed - signal of what to avoid

**General tips:**
- Reference specific shows from their history to explain recommendations
- Don't assume genre preferences - let the preference notes guide you
- Match energy/tone based on what's rated highly, not stereotypes

---

## Taste Profile

### Rating Distribution (178 rated shows)
| Rating | Count | Meaning |
|--------|-------|---------|
| 5★ | 5 | Exceptional - all-time favorites, actively recommend |
| 4.5★ | 14 | Loved it - strong signal of preferences |
| 4★ | 67 | Good solid show - would recommend |
| 3.5★ | 43 | Enjoy but don't love every moment |
| 3★ | 33 | Still good - will stick with it |
| 2-2.5★ | 16 | Dropped or disappointed |

### The 5★ Shows (Reference Points)
- **Severance** (solo) - psychological sci-fi, mind-bending
- **Parks and Recreation** (solo) - comfort workplace comedy
- **The Office** (solo) - comfort workplace comedy
- **Chernobyl** (together) - WWII-era true story, prestige limited series
- **The West Wing** (together) - prestige political drama

### Solo Profile
**Core tastes:** Psychological depth, mind-bending narratives, exceptional acting. Sci-fi that makes you think.

**Loves:**
- Psychological sci-fi (Severance 5★, Black Mirror 4.5★, Dark 4.5★, Silo 4.5★, Foundation 4.5★, Stranger Things 4.5★)
- Comfort workplace comedies (Parks & Rec 5★, The Office 5★, Brooklyn Nine-Nine 4.5★, Abbott Elementary 4★)
- Star Trek universe (Lower Decks 4.5★, Strange New Worlds 4★, Discovery 4★)
- Marvel/superhero completionist (Loki 4.5★, WandaVision 4★, What If...? 4★)
- Great acting and pacing (Murderbot 4.5★ - "great pacing, acting")
- Sharp satire/dark comedy (The Great 4.5★, Barry 4★, Fleabag 4★)
- True story dramas (Dopesick 4★ - "love based on true stories")
- Australian content bonus (Newsreader 3.5★ - "great acting and love australian stuff")

**Avoids:**
- Cancelled unresolved shows (Big Door Prize 2.5★ - "I hate when cancelled unresolved", Wheel of Time 4★ - "So gutted this was cancelled")
- Declining quality (Arrested Development 4★ - "s05 was rubbish")
- Slow/dragging (Daredevil 3★ - "episodes dragged a little")
- Weak Marvel entries (Ms. Marvel 2.5★ - "not that great")
- Too intense AND slow (Mindhunter 2.5★ - "too intense and a bit boring")

### Together Profile (with Helen)
**Core tastes:** Spy thrillers, period dramas, prestige true stories, light mysteries, easy watches.

**Loves:**
- Spy thrillers (Slow Horses 4.5★, Bodyguard 4★, The Americans 4★, Homeland 4★, The Diplomat 4★)
- Period dramas (The Crown 4.5★, Bridgerton 4★, The Gilded Age 4★, A Gentleman in Moscow 4★)
- Prestige true stories (Chernobyl 5★, Lessons in Chemistry 4.5★, Unorthodox 4★)
- Prestige limited series with exceptional acting/cinematography (Adolescence 4★ - "Beautifully shot and brilliantly acted. So well scripted.")
- Light mystery-comedy (Only Murders 4★, Shrinking 4★)
- Easy watch rom-coms (Nobody Wants This 4★ - "Love a good easy watch")
- WWII + True Story + Uplifting = near-guaranteed hit (A Small Light 4★, All the Light We Cannot See 4★)

**Helen dislikes:**
- Superhero content ("helen doesn't like superhero shows")
- Crude humor (The Boys 4★, What We Do in the Shadows 3★ - "too crude for Helen")
- Slow pacing (Severance - "too slow for helen", Fargo - "bit slow paced for Helen")
- Shows that get boring (Elsbeth 3★ - "got boring", Night Agent 3★ - "so boring in 2nd season")
- Drawn out mysteries (The Agency 3.5★ - "a little slow paced", Paradise 3.5★ - "a little drawn out")
- Very slow literary dramas (War and Peace 2.5★ - "got bored, gave up")

### Dropped Shows (Learn From These)
| Show | Rating | Reason |
|------|--------|--------|
| Mr. & Mrs. Smith | 2★ | Slow pacing, not funny |
| Mindhunter | 2.5★ | Too intense AND boring |
| War and Peace | 2.5★ | Got bored, gave up |
| Disclaimer | 2.5★ | Didn't like anyone in the show |
| Big Door Prize | 2.5★ | Cancelled unresolved |
| Underground Railroad | 2.5★ | Too many other shows, ditched |
| Ms. Marvel | 2.5★ | Weak Marvel entry |
| MobLand | 2.5★ | Dropped (together) |
| A League of Their Own | 2.5★ | Fizzled after first few episodes |
| Home Before Dark | 2.5★ | Didn't go anywhere |
| The Tick | 2.5★ | Got bored after a couple episodes |

### Rating Source Correlations

Based on analysis of 180 rated shows (see `docs/rating-analysis.md`):

| Source | Correlation | Use For Predictions |
|--------|-------------|---------------------|
| **IMDB** | 0.46 | ✅ Primary signal |
| **Trakt** | 0.47 | ✅ Primary signal |
| **TMDB** | 0.43 | ✅ Useful backup |
| **RT Critics** | 0.18 | ❌ Ignore for predictions |
| **RT Audience** | 0.13 | ❌ Ignore for predictions |

**Key insight:** RT scores measure consensus ("was it good enough?"), not quality. Many dropped shows had 95%+ RT scores.

### Prediction Formula

```
predicted_rating = (IMDB / 2) - 0.3★ + modifiers
```

**Base:** IMDB rating divided by 2, minus 0.3★ (user is slightly more critical than average)

**Positive Modifiers:**
| Pattern | Adjustment |
|---------|------------|
| Australian content | +0.5★ |
| Psychological complexity (Severance-like) | +0.5★ |
| Workplace comedy | +0.5★ |
| True story | +0.3★ |
| Limited/complete series | +0.3★ |
| WWII setting (for together) | +0.3★ |

**Negative Modifiers:**
| Pattern | Adjustment |
|---------|------------|
| Cancelled/unresolved | -0.5★ |
| Slow-burn/experimental | -0.5★ |
| Dark without hope | -0.5★ |
| Style over substance risk | -0.5★ |

**Context Rules:**
- Slow pacing risk → Consider solo instead of together
- Alt-history vs true story → True story preferred
- Helen dislikes: superhero, crude humor, slow pacing, sci-fi

### Reference Documents

- `docs/rating-analysis.md` - Full correlation analysis with disagreement patterns
- `docs/prediction-updates.md` - All current predictions with reasoning
