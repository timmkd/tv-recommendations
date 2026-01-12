import { promises as fs } from 'fs';
import path from 'path';
import type { Settings, DeletedShow, ShowOverlay, OverlaysData } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');

// Generic JSON file operations
async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(DATA_DIR, filename);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Overlays - custom data that merges with Trakt
export async function getOverlays(): Promise<ShowOverlay[]> {
  try {
    const data = await readJsonFile<OverlaysData>('overlays.json');
    return data.overlays;
  } catch {
    return [];
  }
}

export async function getOverlayByTmdbId(tmdbId: number): Promise<ShowOverlay | undefined> {
  const overlays = await getOverlays();
  return overlays.find(o => o.tmdbId === tmdbId);
}

export async function getOverlaysMap(): Promise<Map<number, ShowOverlay>> {
  const overlays = await getOverlays();
  return new Map(overlays.map(o => [o.tmdbId, o]));
}

export async function saveOverlay(overlay: ShowOverlay): Promise<void> {
  let data: OverlaysData;
  try {
    data = await readJsonFile<OverlaysData>('overlays.json');
  } catch {
    data = { overlays: [] };
  }

  const existingIndex = data.overlays.findIndex(o => o.tmdbId === overlay.tmdbId);

  if (existingIndex >= 0) {
    // MERGE with existing data instead of replacing - preserves fields not in the update
    data.overlays[existingIndex] = {
      ...data.overlays[existingIndex],
      ...overlay,
      updatedAt: new Date().toISOString()
    };
  } else {
    data.overlays.push({ ...overlay, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  await writeJsonFile('overlays.json', data);
}

export async function deleteOverlay(tmdbId: number): Promise<void> {
  let data: OverlaysData;
  try {
    data = await readJsonFile<OverlaysData>('overlays.json');
  } catch {
    return;
  }

  data.overlays = data.overlays.filter(o => o.tmdbId !== tmdbId);
  await writeJsonFile('overlays.json', data);
}

// Settings
export async function getSettings(): Promise<Settings> {
  return readJsonFile<Settings>('settings.json');
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJsonFile('settings.json', settings);
}

export async function getSubscribedServices(): Promise<string[]> {
  const settings = await getSettings();
  return settings.streamingServices
    .filter(s => s.isSubscribed)
    .map(s => s.slug);
}

// Deleted Shows - track shows user has deleted to prevent re-import from Trakt
export async function getDeletedShows(): Promise<DeletedShow[]> {
  const settings = await getSettings();
  return settings.deletedShows || [];
}

export async function addDeletedShow(deletedShow: DeletedShow): Promise<void> {
  const settings = await getSettings();
  if (!settings.deletedShows) {
    settings.deletedShows = [];
  }

  // Avoid duplicates - check by tmdbId or title+year
  const exists = settings.deletedShows.some(d =>
    (deletedShow.tmdbId && d.tmdbId === deletedShow.tmdbId) ||
    (d.title.toLowerCase() === deletedShow.title.toLowerCase() && d.year === deletedShow.year)
  );

  if (!exists) {
    settings.deletedShows.push(deletedShow);
    await saveSettings(settings);
  }
}

export async function isShowDeleted(tmdbId?: number, title?: string, year?: number): Promise<boolean> {
  const deletedShows = await getDeletedShows();

  return deletedShows.some(d =>
    (tmdbId && d.tmdbId === tmdbId) ||
    (title && d.title.toLowerCase() === title.toLowerCase() && d.year === year)
  );
}

export async function clearDeletedShow(tmdbId?: number, title?: string, year?: number): Promise<void> {
  const settings = await getSettings();
  if (!settings.deletedShows) return;

  settings.deletedShows = settings.deletedShows.filter(d =>
    !((tmdbId && d.tmdbId === tmdbId) ||
      (title && d.title.toLowerCase() === title.toLowerCase() && d.year === year))
  );

  await saveSettings(settings);
}

// Helper to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
