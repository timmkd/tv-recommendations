/**
 * Script to auto-populate metadata fields from existing data
 *
 * Detects:
 * - origin: from notes mentioning country/region
 * - format: from genres and notes mentioning format
 * - contentFlags: from notes and showStatus
 *
 * Run with: npx tsx scripts/populate-metadata.ts
 */

import { db, shows } from '../src/lib/db';
import { eq } from 'drizzle-orm';
import type { ShowOrigin, ShowFormat } from '../src/types';

// Pattern definitions for detection
const ORIGIN_PATTERNS: Record<ShowOrigin, RegExp[]> = {
  australian: [/\baustralian\b/i, /\baussie\b/i, /\babc iview\b/i, /\bsbs\b/i],
  british: [/\bbritish\b/i, /\bbbc\b/i, /\buk show\b/i, /\bitvx?\b/i, /\bchannel 4\b/i],
  korean: [/\bkorean\b/i, /\bk-?drama\b/i],
  japanese: [/\bjapanese\b/i, /\bjapan\b/i, /\banime\b/i],
  canadian: [/\bcanadian\b/i, /\bcbc\b/i],
  american: [], // Default - don't auto-detect
  other: [],
};

// Shows we know are Australian (hardcoded list based on user data)
const KNOWN_AUSTRALIAN_SHOWS = [
  'Colin from Accounts',
  'Deadloch',
  'The Letdown',
  'Please Like Me',
  'Boy Swallows Universe',
  'The Newsreader',
  'Total Control',
  'The Paper',
  'Fisk',
  'Harrow',
];

// Shows we know are British
const KNOWN_BRITISH_SHOWS = [
  'Slow Horses',
  'Sherlock',
  'Fleabag',
  'After Life',
  'The Office', // UK version is 2001
  'Staged',
  'The Great British Bake Off',
  'Downton Abbey',
  'The Crown',
  'Broadchurch',
  'Doctor Who',
  'Black Mirror',
  'Bodyguard',
  'Line of Duty',
];

const FORMAT_PATTERNS: Record<ShowFormat, { genres?: string[], keywords?: RegExp[], check?: (show: any) => boolean }> = {
  workplace: {
    keywords: [/\bworkplace\b/i, /\boffice comedy\b/i],
    check: (show) => {
      const workplaceShows = ['The Office', 'Parks and Recreation', 'Brooklyn Nine-Nine', 'Abbott Elementary', 'Superstore', 'Mythic Quest', 'Silicon Valley', 'Scrubs', 'The Bear'];
      return workplaceShows.some(ws => show.title?.toLowerCase().includes(ws.toLowerCase()));
    }
  },
  procedural: {
    keywords: [/\bprocedural\b/i, /\bcase-of-the-week\b/i, /\bepisodic\b/i],
    check: (show) => {
      const proceduralShows = ['The Rookie', 'Elsbeth', 'Law & Order', 'NCIS', 'CSI', 'Bones', 'House', 'Elementary', 'Fringe'];
      return proceduralShows.some(ps => show.title?.toLowerCase().includes(ps.toLowerCase()));
    }
  },
  anthology: {
    keywords: [/\banthology\b/i],
    check: (show) => {
      const anthologyShows = ['Black Mirror', 'Love, Death & Robots', 'American Horror Story', 'Fargo'];
      return anthologyShows.some(as => show.title?.toLowerCase().includes(as.toLowerCase()));
    }
  },
  'limited-series': {
    keywords: [/\blimited series\b/i, /\bmini-?series\b/i],
    check: (show) => show.numberOfSeasons === 1 && show.showStatus === 'Ended',
  },
  sitcom: {
    genres: ['Comedy'],
    check: (show) => {
      const genres = show.genres || [];
      return genres.includes('Comedy') && !genres.includes('Drama') && !genres.includes('Crime');
    }
  },
  mockumentary: {
    keywords: [/\bmockumentary\b/i, /\bdocumentary style\b/i],
    check: (show) => {
      const mockumentaryShows = ['The Office', 'Parks and Recreation', 'Modern Family', 'Abbott Elementary', 'What We Do in the Shadows', 'Jury Duty'];
      return mockumentaryShows.some(ms => show.title?.toLowerCase().includes(ms.toLowerCase()));
    }
  },
  'family-sitcom': {
    check: (show) => {
      const familySitcoms = ['Modern Family', 'The Big Bang Theory', 'Schitt\'s Creek', 'Arrested Development'];
      return familySitcoms.some(fs => show.title?.toLowerCase().includes(fs.toLowerCase()));
    }
  },
  'prestige-drama': {
    keywords: [/\bprestige\b/i, /\bhbo\b/i],
    check: (show) => {
      const prestigeShows = ['The Crown', 'Succession', 'The Americans', 'Chernobyl', 'Severance', 'The West Wing'];
      return prestigeShows.some(ps => show.title?.toLowerCase().includes(ps.toLowerCase()));
    }
  },
  other: {},
};

// Content flag patterns
const FLAG_PATTERNS: Record<string, RegExp[]> = {
  'true-story': [/\btrue story\b/i, /\bbased on\b/i, /\breal events\b/i, /\btrue crime\b/i],
  'slow-burn': [/\bslow[- ]?burn\b/i, /\bslow paced\b/i, /\btoo slow\b/i],
  'cancelled': [/\bcancelled\b/i, /\bcanceled\b/i, /\bunresolved\b/i],
  'crude-humor': [/\bcrude\b/i, /\braunchy\b/i, /\bgraphic\b/i],
  'comfort-rewatch': [/\brewatch/i, /\bcomfort\b/i],
  'binge-worthy': [/\bbinge/i, /\bbingeworthy\b/i, /\beasy watch\b/i],
  'intense': [/\bintense\b/i, /\bheavy\b/i, /\bdark\b/i],
  'wwii': [/\bwwii\b/i, /\bworld war (ii|2|two)\b/i, /\bww2\b/i],
  'feel-good': [/\bfeel[- ]?good\b/i, /\buplifting\b/i, /\bheartwarming\b/i],
};

async function populateMetadata() {
  console.log('Fetching all shows...');
  const allShows = await db.select().from(shows);
  console.log(`Found ${allShows.length} shows\n`);

  let updatedCount = 0;

  for (const show of allShows) {
    const updates: Partial<typeof show> = {};
    const allText = `${show.reviewNote || ''} ${show.notes || ''} ${show.watchPreferenceNote || ''}`.toLowerCase();

    // === ORIGIN DETECTION ===
    if (!show.origin) {
      // Check hardcoded lists first
      if (KNOWN_AUSTRALIAN_SHOWS.some(name => show.title?.toLowerCase().includes(name.toLowerCase()))) {
        updates.origin = 'australian';
      } else if (KNOWN_BRITISH_SHOWS.some(name => show.title?.toLowerCase().includes(name.toLowerCase()))) {
        updates.origin = 'british';
      } else {
        // Check patterns in notes
        for (const [origin, patterns] of Object.entries(ORIGIN_PATTERNS)) {
          if (patterns.some(p => p.test(allText))) {
            updates.origin = origin as ShowOrigin;
            break;
          }
        }
      }
    }

    // === FORMAT DETECTION ===
    if (!show.format) {
      for (const [format, config] of Object.entries(FORMAT_PATTERNS)) {
        const keywordMatch = config.keywords?.some(k => k.test(allText));
        const checkMatch = config.check?.(show);

        if (keywordMatch || checkMatch) {
          updates.format = format as ShowFormat;
          break;
        }
      }
    }

    // === CONTENT FLAGS DETECTION ===
    if (!show.contentFlags || show.contentFlags.length === 0) {
      const flags: string[] = [];

      for (const [flag, patterns] of Object.entries(FLAG_PATTERNS)) {
        if (patterns.some(p => p.test(allText))) {
          flags.push(flag);
        }
      }

      // Check showStatus for cancelled
      if (show.showStatus === 'Canceled') {
        flags.push('cancelled');
      }

      if (flags.length > 0) {
        updates.contentFlags = flags;
      }
    }

    // Save if any updates
    if (Object.keys(updates).length > 0) {
      await db.update(shows).set(updates).where(eq(shows.tmdbId, show.tmdbId));
      console.log(`Updated: ${show.title}`);
      if (updates.origin) console.log(`  - origin: ${updates.origin}`);
      if (updates.format) console.log(`  - format: ${updates.format}`);
      if (updates.contentFlags) console.log(`  - contentFlags: ${updates.contentFlags.join(', ')}`);
      updatedCount++;
    }
  }

  console.log(`\n✓ Updated ${updatedCount} shows`);
}

populateMetadata()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
