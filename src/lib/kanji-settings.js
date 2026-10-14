export const KANJI_DRAW_SPEEDS = [
  { id: 'slow', label: '느리게', timeScale: 1.5 },
  { id: 'medium', label: '중간', timeScale: 1 },
  { id: 'fast', label: '빠르게', timeScale: 0.5 },
];

const STORAGE_KEY = 'kanji-drawing-settings';

export function normalizeKanjiDrawingSettings(value) {
  return {
    autoDraw: typeof value?.autoDraw === 'boolean' ? value.autoDraw : true,
    speed: KANJI_DRAW_SPEEDS.some(option => option.id === value?.speed) ? value.speed : 'medium',
  };
}

export function loadKanjiDrawingSettings() {
  try { return normalizeKanjiDrawingSettings(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return normalizeKanjiDrawingSettings(null); }
}

export function saveKanjiDrawingSettings(value) {
  const settings = normalizeKanjiDrawingSettings(value);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
  catch {}
  return settings;
}

export function kanjiDrawingTimeScale(speed) {
  return KANJI_DRAW_SPEEDS.find(option => option.id === speed)?.timeScale ?? 1;
}
