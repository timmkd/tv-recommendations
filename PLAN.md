# TV Recommendations App - Implementation Plan

## Overview
A personalized TV tracking and recommendation app:
- Episode-level watch tracking
- **Watch preference** (Solo vs Together) with contextual notes
- Australian streaming availability via JustWatch
- Rotten Tomatoes ratings (critic + audience/popcorn)
- AI-powered recommendations filtered by preference
- Personal notes and reviews on saved shows

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), Tailwind CSS
- **Storage**: JSON files (simple, easy to edit/backup)
- **Data Sources**: JustWatch (scrape), Trakt (API), TMDB (API), Claude AI

---

## Current Status

### Completed
- [x] Phase 1: Project Setup (Next.js, Tailwind, JSON storage)
- [x] Phase 2: Trakt Import (210 shows imported)
- [x] Phase 4: Core UI Pages (Shows List, Add Show, Show Detail, Preferences)
- [x] Recommendations page with poster images
- [x] NavBar with all routes

### In Progress
- [ ] Simplify rating system (see discussion below)
- [ ] Enrich shows.json with TMDB poster paths

### Not Started
- [ ] JustWatch scraping for Australian streaming availability
- [ ] OpenAI/Claude API for automated recommendations
- [ ] Rotten Tomatoes integration
- [ ] Episode-level tracking
- [ ] TMDB API key setup

---

## Data Schema Discussion

### Current Schema (Complex)
```json
{
  "id": "uuid",
  "title": "Show Name",
  "status": "completed",
  "watchingContext": "solo",
  "soloRating": { "rating": 4.5, "notes": "Great for solo" },
  "withWifeRating": { "rating": 3, "notes": "Too intense" },
  "notes": "General notes"
}
```

### Final Schema
```json
{
  "id": "uuid",
  "tmdbId": 12345,
  "title": "Show Name",
  "year": 2020,
  "posterPath": "/abc123.jpg",
  "status": "completed",           // watching, completed, watchlist, dropped

  // Watch preference (binary choice)
  "watchPreference": "solo",       // "solo" | "together"
  "watchPreferenceNote": "Too intense for watching together",

  // Rating & review
  "rating": 4.5,                   // 0.5 to 5 stars (or null if not rated)
  "reviewNote": "Incredible tension, amazing character arc",

  // General
  "notes": "Optional general notes",

  // Metadata
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Field Explanations

| Field | Purpose | AI Use |
|-------|---------|--------|
| `watchPreference` | "solo" or "together" | Filters recommendations by context |
| `watchPreferenceNote` | WHY this preference | Learns context patterns |
| `rating` | 0.5-5 stars | Weights show importance |
| `reviewNote` | What you liked/disliked, or why you dropped | Learns taste preferences |
| `notes` | General notes | Not used for AI |

### Status Values

| Status | Description |
|--------|-------------|
| `watching` | Currently watching |
| `completed` | Finished watching |
| `watchlist` | Want to watch |
| `dropped` | Started but stopped (use `reviewNote` to explain why) |

### Examples

**Completed show (loved it):**
```json
{
  "title": "The Bear",
  "status": "completed",
  "watchPreference": "solo",
  "watchPreferenceNote": "Too stressful for relaxing together",
  "rating": 5,
  "reviewNote": "Incredible intensity, amazing cinematography, loved the kitchen chaos"
}
```

**Dropped show:**
```json
{
  "title": "Some Show",
  "status": "dropped",
  "watchPreference": "together",
  "watchPreferenceNote": null,
  "rating": 2,
  "reviewNote": "Started but pacing was too slow, lost interest after episode 3"
}
```

**Watchlist (haven't seen yet):**
```json
{
  "title": "Industry",
  "status": "watchlist",
  "watchPreference": "solo",
  "watchPreferenceNote": "Heard it's intense, probably solo material",
  "rating": null,
  "reviewNote": null
}
```

---

## Decisions Made

1. **`watchPreference` is binary**: `'solo' | 'together'` — no "both" option
2. **No separate `dropReason`**: Use `reviewNote` for drop reasons
3. **Two note fields**: `watchPreferenceNote` (context reasoning) + `reviewNote` (taste/quality)

---

## Implementation Phases

### Phase 1: Project Setup ✅
1. Initialize Next.js project with TypeScript, Tailwind, App Router
2. Create JSON data files structure
3. Create utility functions for reading/writing JSON files
4. Initialize settings with Australian streaming services

### Phase 2: Import ✅
1. Trakt API integration for importing watch history
2. Import page with preview and confirmation
3. Map Trakt shows to TMDB IDs

### Phase 3: AI Recommendations
1. **Recommendations API** (`/api/recommendations`)
   - Analyze shows by `watchPreference`
   - Use `watchPreferenceNote` and `reviewNote` to understand patterns
   - Filter by subscribed streaming services
   - Call Claude/OpenAI with context-aware prompt

2. **Recommendations Page** (`/recommendations`)
   - Toggle between Solo / Together recommendations
   - Display suggestions with reasoning
   - Quick add to watchlist

### Phase 4: Core CRUD & UI ✅
1. Shows List Page (`/shows`)
2. Add Show Page (`/add`)
3. Show Detail Page (`/show/[id]`)
4. Preferences Analysis Page (`/preferences`)

### Phase 5: Rotten Tomatoes Integration
1. RT scraping for critic + audience scores
2. Cache results in show JSON
3. Display on show detail page

### Phase 6: Settings & Polish
1. Settings page for streaming services, API keys
2. Responsive design
3. Loading states and error handling

---

## File Structure

```
tv-recommendations/
├── data/
│   ├── shows.json
│   ├── episodes.json
│   ├── settings.json
│   └── recommendations.json
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home
│   │   ├── shows/page.tsx        # Shows list
│   │   ├── add/page.tsx          # Add new show
│   │   ├── import/page.tsx       # Import from Trakt
│   │   ├── show/[id]/page.tsx    # Show detail
│   │   ├── recommendations/page.tsx
│   │   ├── preferences/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/...
│   ├── components/
│   ├── lib/
│   └── types/
├── CLAUDE.md                     # AI assistant instructions
├── PLAN.md                       # This file
└── .env.local                    # API keys
```

---

## API Keys Required

1. **TMDB** - Free, register at themoviedb.org (needed for poster images)
2. **OpenAI/Anthropic** - For AI recommendations
3. **Trakt** - Already configured

---

## Notes

- Trakt username: timmkd
- Subscribed streaming services: Stan, HBO Max
- 210 shows imported from Trakt
