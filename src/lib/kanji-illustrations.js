import illustrations from '../data/kanji-illustrations.json';

export const KANJI_ILLUSTRATIONS_KEY = 'kanji-illustrations-enabled';
const listeners = new Set();
let temporaryPreference = null;

export function getKanjiIllustrationsEnabled() {
  if (temporaryPreference !== null) return temporaryPreference;
  try { return localStorage.getItem(KANJI_ILLUSTRATIONS_KEY) === 'true'; }
  catch { return false; }
}

export function setKanjiIllustrationsEnabled(enabled) {
  const next = Boolean(enabled);
  try {
    localStorage.setItem(KANJI_ILLUSTRATIONS_KEY, String(next));
    temporaryPreference = null;
  } catch {
    // 저장이 막혀 있어도 이번 실행에서는 그림을 켜고 끌 수 있다.
    temporaryPreference = next;
  }
  listeners.forEach(listener => listener());
}

export function subscribeToKanjiIllustrations(listener) {
  listeners.add(listener);
  const onStorage = event => {
    if (event.key !== KANJI_ILLUSTRATIONS_KEY && event.key !== null) return;
    temporaryPreference = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// 검수해서 저장한 글자만 제공한다. 부수나 단어를 보고 그림을 추측하지 않는다.
export function getKanjiIllustration(character) {
  if (!Object.hasOwn(illustrations, character)) return null;
  return {
    ...illustrations[character],
    src: `${import.meta.env.BASE_URL}images/kanji/${character.codePointAt(0).toString(16)}.svg`,
  };
}
