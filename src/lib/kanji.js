const HAN_CHARACTER = /^\p{Unified_Ideograph}$/u;
const chunks = new Map();

export function isKanji(character) {
  return typeof character === 'string' && HAN_CHARACTER.test(character);
}

export function kanjiChunkName(character) {
  if (!isKanji(character)) return null;
  return (character.codePointAt(0) >> 8).toString(16).padStart(3, '0');
}

export function formatKanjiReading(reading) {
  const [stem, ending] = reading.split('.');
  return ending ? `${stem}（${ending}）` : reading;
}

/** Data is served from our origin; the PWA caches successfully loaded chunks. */
export async function loadKanji(character) {
  const chunk = kanjiChunkName(character);
  if (!chunk) return null;
  if (!chunks.has(chunk)) {
    const request = fetch(`${import.meta.env.BASE_URL}data/kanji/${chunk}.json`)
      .then(async response => {
        if (response.status === 404) return {};
        if (!response.ok) throw new Error('한자 정보를 불러오지 못했어요.');
        const data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('올바르지 않은 한자 데이터입니다.');
        return data;
      })
      .catch(error => {
        // A transient failure must not poison later opens/retries.
        chunks.delete(chunk);
        throw error;
      });
    chunks.set(chunk, request);
  }
  const data = await chunks.get(chunk);
  const entry = Object.hasOwn(data, character) ? data[character] : null;
  if (!entry) return null;
  if (!Array.isArray(entry.strokes) || !entry.strokes.length ||
      entry.strokes.some(path => typeof path !== 'string') ||
      ['meaningsKo', 'meaningsEn', 'on', 'kun'].some(key =>
        !Array.isArray(entry[key]) || entry[key].some(value => typeof value !== 'string'))) {
    chunks.delete(chunk);
    throw new Error('올바르지 않은 한자 데이터입니다.');
  }
  return entry;
}
