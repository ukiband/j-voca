import { describe, it, expect } from 'vitest';
import {
  parseHighlight,
  stripHighlight,
  matchesSource,
  filterUsableSentences,
  pickSentence,
  validateSentence,
  getRecentWords,
  pruneSentences,
  selectTargets,
} from '../sentence-utils';

const word = { id: 953, word: '歌を歌う', reading: 'うたをうたう', meaning: '노래를 부르다' };
const source = { word: '歌を歌う', reading: 'うたをうたう', meaning: '노래를 부르다' };

function makeSentence(date, overrides = {}) {
  return {
    wordId: 953,
    date,
    source,
    sentence: `友だちと[[歌を歌います]]。${date}`,
    reading: 'ともだちと [[うたを うたいます]]。',
    meaning: '친구와 노래를 불러요.',
    ...overrides,
  };
}

describe('parseHighlight', () => {
  it('[[ ]] 안팎을 세그먼트로 나누고 강조 여부를 표시한다', () => {
    expect(parseHighlight('友だちと[[歌を歌います]]。')).toEqual([
      { text: '友だちと', highlight: false },
      { text: '歌を歌います', highlight: true },
      { text: '。', highlight: false },
    ]);
  });

  it('표식이 없으면 전체가 일반 세그먼트 하나', () => {
    expect(parseHighlight('こんにちは')).toEqual([{ text: 'こんにちは', highlight: false }]);
  });

  it('문장 맨 앞·맨 뒤 표식과 여러 개 표식도 처리한다', () => {
    expect(parseHighlight('[[水]]を飲む')).toEqual([
      { text: '水', highlight: true },
      { text: 'を飲む', highlight: false },
    ]);
    expect(parseHighlight('[[a]] [[b]]')).toEqual([
      { text: 'a', highlight: true },
      { text: ' ', highlight: false },
      { text: 'b', highlight: true },
    ]);
  });

  it('짝이 없는 표식은 일반 텍스트로 남기고, 빈 값은 빈 배열', () => {
    expect(parseHighlight('[[水を飲む')).toEqual([{ text: '[[水を飲む', highlight: false }]);
    expect(parseHighlight('')).toEqual([]);
    expect(parseHighlight(null)).toEqual([]);
  });
});

describe('stripHighlight', () => {
  it('표식만 떼고 안쪽 글자는 남긴다', () => {
    expect(stripHighlight('友だちと[[歌を歌います]]。')).toBe('友だちと歌を歌います。');
    expect(stripHighlight(undefined)).toBe('');
  });
});

describe('matchesSource / filterUsableSentences', () => {
  it('word·reading·meaning 세 필드가 모두 같을 때만 일치', () => {
    expect(matchesSource(makeSentence('2026-09-01'), word)).toBe(true);
    expect(matchesSource(makeSentence('2026-09-01'), { ...word, meaning: '노래하다' })).toBe(false);
    expect(matchesSource(makeSentence('2026-09-01'), { ...word, reading: 'うた' })).toBe(false);
    expect(matchesSource({ wordId: 1 }, word)).toBe(false);
    expect(matchesSource(makeSentence('2026-09-01'), null)).toBe(false);
  });

  it('현재 단어와 맞지 않는 예문(뜻 수정 후)과 다른 단어의 예문은 제외한다', () => {
    const rows = [
      makeSentence('2026-09-01'),
      makeSentence('2026-09-02', { source: { ...source, meaning: '옛 뜻' } }),
      makeSentence('2026-09-03', { wordId: 1 }),
    ];
    expect(filterUsableSentences(rows, word).map(s => s.date)).toEqual(['2026-09-01']);
  });

  it('단어가 없거나(삭제됨) 입력이 배열이 아니면 빈 배열', () => {
    expect(filterUsableSentences([makeSentence('2026-09-01')], null)).toEqual([]);
    expect(filterUsableSentences(undefined, word)).toEqual([]);
  });
});

describe('pickSentence', () => {
  const rows = [makeSentence('2026-09-03'), makeSentence('2026-09-01'), makeSentence('2026-09-02')];

  it('예문이 없으면 null', () => {
    expect(pickSentence([], '2026-09-06')).toBeNull();
    expect(pickSentence(undefined, '2026-09-06')).toBeNull();
  });

  it('오늘 생성한 예문이 있으면 순환과 상관없이 그것을 고른다', () => {
    expect(pickSentence(rows, '2026-09-02').date).toBe('2026-09-02');
  });

  it('오늘 것이 없으면 date 오름차순 정렬 후 (epoch-day % n) 번째를 고른다', () => {
    // 2026-09-06 = epoch-day 20702, 20702 % 3 = 2 → 정렬 후 세 번째(2026-09-03)
    expect(pickSentence(rows, '2026-09-06').date).toBe('2026-09-03');
    // 다음 날은 20703 % 3 = 0 → 첫 번째
    expect(pickSentence(rows, '2026-09-07').date).toBe('2026-09-01');
    expect(pickSentence(rows, '2026-09-08').date).toBe('2026-09-02');
  });

  it('입력 순서가 달라도 같은 날에는 같은 문장을 고른다 (입력 배열은 바꾸지 않음)', () => {
    const shuffled = [rows[2], rows[0], rows[1]];
    const before = shuffled.map(s => s.date);
    expect(pickSentence(shuffled, '2026-09-06').date).toBe(pickSentence(rows, '2026-09-06').date);
    expect(shuffled.map(s => s.date)).toEqual(before);
  });
});

describe('validateSentence', () => {
  const good = {
    sentence: '友だちと[[歌を歌います]]。',
    reading: 'ともだちと [[うたを うたいます]]。',
    meaning: '친구와 노래를 불러요.',
  };

  it('정상 후보는 null', () => {
    expect(validateSentence(good)).toBeNull();
  });

  it('sentence/reading/meaning 이 비어 있으면 거부', () => {
    expect(validateSentence({ ...good, sentence: '' })).toMatch(/sentence/);
    expect(validateSentence({ ...good, reading: '   ' })).toMatch(/reading/);
    expect(validateSentence({ ...good, meaning: undefined })).toMatch(/meaning/);
    expect(validateSentence(null)).not.toBeNull();
  });

  it('reading 에 한자가 남아 있으면 거부, 가타카나는 허용', () => {
    expect(validateSentence({ ...good, reading: 'ともだちと [[歌を うたいます]]。' })).toMatch(/한자/);
    expect(validateSentence({ ...good, reading: 'コーヒーを [[のみます]]。' })).toBeNull();
  });

  it('sentence 와 reading 각각 [[ ]] 가 정확히 1개여야 한다', () => {
    expect(validateSentence({ ...good, sentence: '友だちと歌を歌います。' })).toMatch(/sentence/);
    expect(validateSentence({ ...good, sentence: '[[友だち]]と[[歌を歌います]]。' })).toMatch(/sentence/);
    expect(validateSentence({ ...good, reading: 'ともだちと うたを うたいます。' })).toMatch(/reading/);
    expect(validateSentence({ ...good, reading: '[[ともだち]]と [[うたを うたいます]]。' })).toMatch(/reading/);
  });

  it('짝이 깨진 표식은 거부', () => {
    expect(validateSentence({ ...good, sentence: '友だちと[[歌を歌います]]。]]' })).not.toBeNull();
  });

  it('같은 단어의 기존 예문과 (표식을 뗀) 문장이 같으면 거부', () => {
    const existing = [{ sentence: '友だちと歌を[[歌います]]。' }];
    expect(validateSentence(good, existing)).toMatch(/기존/);
    expect(validateSentence({ ...good, sentence: '母と[[歌を歌います]]。' }, existing)).toBeNull();
  });
});

describe('getRecentWords', () => {
  const today = '2026-09-08';

  it('등록일이 오늘로부터 7일 안인 단어만 id 순으로 고른다', () => {
    const words = [
      { id: 5, createdAt: '2026-09-01' }, // 7일 전 → 포함
      { id: 1, createdAt: '2026-08-31' }, // 8일 전 → 제외
      { id: 3, createdAt: today },
      { id: 2, createdAt: '2026-09-05' },
    ];
    expect(getRecentWords(words, today).map(w => w.id)).toEqual([2, 3, 5]);
  });

  it('등록일이 없거나 형식이 다르거나 미래인 단어는 제외한다', () => {
    const words = [{ id: 1 }, { id: 2, createdAt: '2026/09/07' }, { id: 3, createdAt: '2026-09-09' }];
    expect(getRecentWords(words, today)).toEqual([]);
  });
});

describe('pruneSentences', () => {
  const words = [
    { id: 10, step: 1, chapter: 1, word: 'a', reading: 'a', meaning: '옛' },
    { id: 20, step: 2, chapter: 1, word: 'b', reading: 'b', meaning: '새' },
  ];
  const activeIds = new Set([20]);
  const row = (wordId, meaning, date = '2026-09-01') => ({
    wordId, date, source: { word: wordId === 10 ? 'a' : 'b', reading: wordId === 10 ? 'a' : 'b', meaning },
    sentence: '[[x]]', reading: '[[x]]', meaning: 'x',
  });

  it('삭제된 wordId 는 모두 제거한다', () => {
    const kept = pruneSentences([row(99, 'x'), row(20, '새')], words, activeIds);
    expect(kept.map(s => s.wordId)).toEqual([20]);
  });

  it('생성 대상 단어의 source 불일치는 제거하고, 그 외 단어의 source 불일치는 유지한다', () => {
    const kept = pruneSentences([row(10, '다른 뜻'), row(20, '다른 뜻'), row(20, '새')], words, activeIds);
    expect(kept.map(s => [s.wordId, s.source.meaning])).toEqual([[10, '다른 뜻'], [20, '새']]);
  });
});

describe('selectTargets', () => {
  const today = '2026-09-08';

  it('예문이 없는 단어와 오늘 만들지 않은 단어는 대상, 오늘 이미 만든 단어는 제외한다', () => {
    const recentWords = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const byWord = new Map([
      [1, [{ date: '2026-09-07' }]],
      [2, [{ date: today }]],
    ]);
    expect(selectTargets(recentWords, byWord, today).map(w => w.id)).toEqual([1, 3]);
  });

  it('여러 건이 남아 있으면 가장 최근 날짜로 판단한다', () => {
    const byWord = new Map([[1, [{ date: '2026-08-01' }, { date: today }]]]);
    expect(selectTargets([{ id: 1 }], byWord, today)).toEqual([]);
  });
});
