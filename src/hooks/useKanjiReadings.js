import { useEffect, useMemo, useState } from 'react';
import { isKanji, loadKanji } from '../lib/kanji';
import { buildStudyReadings } from '../lib/kanji-readings';

/** 필요한 글자만 기존 사전 캐시에서 읽는다. 일부 묶음이 없어도 단어 전체 읽기는 유지한다. */
export function useKanjiReadings(character, data, words) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!data) return;
    let active = true;
    const chars = [...new Set(words.flatMap(word => [...word.word].filter(isKanji)))];
    Promise.all(chars.map(async c => {
      try { return [c, c === character ? data : await loadKanji(c)]; }
      catch { return [c, null]; }
    })).then(entries => {
      if (active) setResult({ character, data, words, dictionary: Object.fromEntries(entries) });
    });
    return () => { active = false; };
  }, [character, data, words]);
  const current = result?.character === character && result?.data === data && result?.words === words;
  return useMemo(() => ({
    ...buildStudyReadings(character, words, current ? result.dictionary : { [character]: data }),
    loading: !!data && !current && words.length > 0,
  }), [character, data, words, current, result]);
}
