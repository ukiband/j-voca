import { useEffect, useState } from 'react';
import { loadKanji } from '../lib/kanji';

export function useKanjiData(character) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!character) return;
    let active = true;
    loadKanji(character).then(data => {
      if (active) setResult({ character, attempt, data, status: data ? 'ready' : 'missing' });
    }).catch(() => {
      if (active) setResult({ character, attempt, data: null, status: 'error' });
    });
    return () => { active = false; };
  }, [character, attempt]);

  // 카드가 바뀌는 렌더부터 이전 한자의 정보를 숨긴다.
  const current = result != null && result.character === character && result.attempt === attempt;
  return {
    data: current ? result.data : null,
    status: !character ? 'idle' : current ? result.status : 'loading',
    retry: () => setAttempt(value => value + 1),
  };
}
