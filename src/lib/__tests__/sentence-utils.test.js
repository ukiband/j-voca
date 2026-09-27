import { describe, it, expect } from 'vitest';
import {
  parseHighlight,
  stripHighlight,
  matchesSource,
  filterUsableSentences,
  pickSentence,
  validateSentence,
  getRecentWords,
  shouldRefreshSentences,
  SENTENCE_REFRESH_MIN_MS,
  pruneSentences,
  selectTargets,
  selectCheckTargets,
  validateCheckFix,
  applyCheckResults,
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

  it('검사에서 틀렸다고 판정해 숨긴 예문은 제외하고, 통과했거나 검사 전인 예문은 남긴다', () => {
    const rows = [
      makeSentence('2026-09-01', { check: { date: '2026-09-02', ok: false, problem: '번역이 반말' } }),
      makeSentence('2026-09-02', { check: { date: '2026-09-02', ok: true } }),
      makeSentence('2026-09-03'),
    ];
    expect(filterUsableSentences(rows, word).map(s => s.date)).toEqual(['2026-09-02', '2026-09-03']);
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
    expect(validateSentence({ ...good, sentence: 'コーヒーを[[飲みます]]。', reading: 'コーヒーを [[のみます]]。' })).toBeNull();
  });

  it('가타카나는 강조 안팎 모두 원문 그대로 유지한다', () => {
    const piano = { ...good, sentence: '妹は[[ピアノを弾きます]]。', reading: 'いもうとは [[ピアノを ひきます]]。' };
    expect(validateSentence(piano)).toBeNull();
    expect(validateSentence({ ...piano, reading: 'いもうとは [[ぴあのを ひきます]]。' })).toMatch(/표기/);
    const coffee = { ...good, sentence: '[[時々]]コーヒーを飲みます。', reading: '[[ときどき]] コーヒーを のみます。' };
    expect(validateSentence(coffee)).toBeNull();
    expect(validateSentence({ ...coffee, reading: '[[ときどき]] こーひーを のみます。' })).toMatch(/표기/);
    expect(validateSentence({ ...coffee, reading: '[[ときどき]] コヒーを のみます。' })).toMatch(/표기/);
  });

  it('원문과 다른 조사·어미·불필요한 글자·문장부호를 거부한다', () => {
    const cases = [
      ['この人は私の[[息子]]です。', 'このひとわ わたしの [[むすこ]]です。'],
      ['[[最初]]は分かりません。', '[[さいしょ]]は わからないです。'],
      ['昔の事を[[思い出しました]]。', 'むかしの ことをつ [[おもいだしました]]。'],
      ['これは[[ペン]]ですか？', 'これは [[ペン]]ですか。'],
    ];
    for (const [sentence, reading] of cases) {
      expect(validateSentence({ ...good, sentence, reading })).toMatch(/표기/);
    }
  });

  it('문장이 같아도 읽기의 강조 위치가 다른 부분이면 거부한다', () => {
    expect(validateSentence({ ...good, reading: '[[ともだち]]と うたを うたいます。' })).toMatch(/강조 위치/);
  });

  it('한자와 숫자·조수사의 읽기, 띄어쓰기 차이는 허용한다', () => {
    const cases = [
      ['このパンは[[300円]]です。', 'この パンは [[さんびゃくえん]]です。'],
      ['[[3日]]に会います。', '[[みっか]]に あいます。'],
      ['[[時々]]本を読みます。', '[[ときどき]] ほんを よみます。'],
      ['[[行ったり来たり]]します。', '[[いったり きたり]] します。'],
      ['[[お茶]]を飲みます。', '[[おちゃ]]を のみます。'],
      ['[[3人]]います。', '[[3にん]] います。'],
      ['[[3月4日]]です。', '[[3がつ よっか]]です。'],
    ];
    for (const [sentence, reading] of cases) {
      expect(validateSentence({ ...good, sentence, reading })).toBeNull();
    }
  });

  it('한자를 숫자로 바꾸거나 원문 숫자를 다른 숫자로 바꾸면 거부한다', () => {
    expect(validateSentence({ ...good, sentence: '[[猫]]がいます。', reading: '[[123]]が います。' })).toMatch(/표기/);
    expect(validateSentence({ ...good, sentence: '[[3人]]います。', reading: '[[4にん]]います。' })).toMatch(/표기/);
  });

  it('탁점의 유니코드 결합 방식이 달라도 같은 표기로 인정한다', () => {
    const candidate = { ...good, sentence: '学校で[[ゴミ]]を拾います。', reading: 'がっこうで [[ゴミ]]を ひろいます。'.normalize('NFD') };
    expect(validateSentence(candidate)).toBeNull();
  });

  it('일본어 원문 또는 읽기에 한국어가 섞이면 거부한다', () => {
    expect(validateSentence({ ...good, sentence: '외출할 때 [[帽子をかぶります]]。' })).toMatch(/한국어/);
    expect(validateSentence({ ...good, reading: '친구와 [[うたをうたいます]]。' })).toMatch(/한국어/);
  });

  it('정규식에 쓰이는 기호도 원문 그대로 비교한다', () => {
    const candidate = { ...good, sentence: '[[ペン]]（赤）を買います。', reading: '[[ペン]]（あか）を かいます。' };
    expect(validateSentence(candidate)).toBeNull();
    expect(validateSentence({ ...good, sentence: '[[ペン]](赤)を買います。', reading: '[[ペン]](あか)を かいます。' })).toBeNull();
    expect(validateSentence({ ...good, sentence: '[[ペン]](赤)を買います。', reading: '[[ペン]]あかを かいます。' })).not.toBeNull();
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

  it('빈 강조 표식은 거부', () => {
    expect(validateSentence({ ...good, sentence: '友だちと[[]]歌を歌います。' })).toMatch(/비어/);
    expect(validateSentence({ ...good, reading: 'ともだちと [[ ]]うたをうたいます。' })).toMatch(/비어/);
  });

  it('같은 단어의 기존 예문과 (표식을 뗀) 문장이 같으면 거부', () => {
    const existing = [{ sentence: '友だちと歌を[[歌います]]。' }];
    expect(validateSentence(good, existing)).toMatch(/기존/);
    expect(validateSentence({ ...good, sentence: '母と[[歌を歌います]]。', reading: 'ははと [[うたを うたいます]]。' }, existing)).toBeNull();
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

describe('selectCheckTargets', () => {
  const today = '2026-09-08';
  const words = [1, 2, 3, 4, 5, 6].map(id => ({ id, word: `w${id}`, reading: `r${id}`, meaning: `m${id}` }));
  const hidden = { check: { date: '2026-09-07', ok: false, problem: '사물에 いる 를 씀' } };
  const entry = (wordId, date, overrides = {}) => ({
    wordId, date, source: { word: `w${wordId}`, reading: `r${wordId}`, meaning: `m${wordId}` },
    sentence: '[[x]]', reading: '[[x]]', meaning: 'x', ...overrides,
  });

  it('최근 7일 안에 만든 검사 전 예문과, 날짜와 상관없이 숨긴 예문을 고른다', () => {
    const sentences = [
      entry(1, '2026-09-01'),                                   // 7일 전 → 포함
      entry(2, '2026-08-31'),                                   // 8일 전(고정된 옛 예문) → 제외
      entry(3, today, { check: { date: today, ok: true } }),    // 통과 → 제외
      entry(4, '2026-07-01', hidden),                           // 숨김 → 날짜와 상관없이 포함
      entry(5, '2026/09/07'),                                   // 날짜 형식이 다름 → 제외
    ];
    expect(selectCheckTargets(sentences, words, today).map(s => s.wordId)).toEqual([1, 4]);
  });

  it('단어가 삭제됐거나 source 가 현재 단어와 다른 예문은 숨긴 예문이어도 제외한다', () => {
    const oldSource = id => ({ source: { word: `w${id}`, reading: `r${id}`, meaning: '옛 뜻' } });
    const sentences = [entry(99, today), entry(1, today, oldSource(1)), entry(2, today, { ...hidden, ...oldSource(2) })];
    expect(selectCheckTargets(sentences, words, today)).toEqual([]);
  });

  it('검사 전 예문을 먼저, 숨긴 예문을 나중에 두고 각각 wordId 순으로 정렬한다', () => {
    const sentences = [entry(6, today, hidden), entry(5, today), entry(2, today, hidden), entry(3, today)];
    expect(selectCheckTargets(sentences, words, today).map(s => s.wordId)).toEqual([3, 5, 2, 6]);
  });
});

describe('validateCheckFix', () => {
  const original = { sentence: '学校へ[[行きます]]。', reading: 'がっこうへ [[ときます]]。', meaning: '학교에 가.' };

  it('문장은 그대로 두고 읽기만 또는 번역만 고친 수정안도 통과한다', () => {
    expect(validateCheckFix(original, { ...original, reading: 'がっこうへ [[いきます]]。' })).toBeNull();
    expect(validateCheckFix(original, { ...original, meaning: '학교에 갑니다.' })).toBeNull();
  });

  it('세 필드가 앞뒤 공백을 빼면 모두 원래와 같으면 거부한다', () => {
    expect(validateCheckFix(original, { ...original, meaning: ` ${original.meaning} ` })).toMatch(/같음/);
  });

  it('저장 규칙(validateSentence)에 어긋나는 수정안은 거부한다', () => {
    expect(validateCheckFix(original, { ...original, reading: 'がっこうへ [[行きます]]。' })).toMatch(/한자/);
    expect(validateCheckFix(original, { meaning: '학교에 갑니다.' })).toMatch(/sentence/);
  });
});

describe('applyCheckResults', () => {
  const today = '2026-09-08';
  const entry = (wordId, overrides = {}) => ({
    wordId, date: '2026-09-07', source: { word: `w${wordId}`, reading: `r${wordId}`, meaning: `m${wordId}` },
    sentence: `[[x${wordId}]]`, reading: `[[x${wordId}]]`, meaning: `x${wordId}`, ...overrides,
  });

  const fix = { sentence: ' 新[[x]]。 ', reading: 'しん[[x]]。', meaning: '새 번역 ' };

  it('검사 전 예문에 통과·교체·숨김을 제자리에서 반영하고, 나머지 항목과 배열 순서는 그대로 둔다', () => {
    const sentences = [entry(1), entry(2), entry(3), entry(4)];
    const out = applyCheckResults(sentences, {
      passed: new Set([3]),
      fixed: new Map([[1, fix]]),
      rejected: new Map([[4, '번역이 반말']]),
    }, today);

    expect(out.map(s => s.wordId)).toEqual([1, 2, 3, 4]);
    expect(out[0]).toEqual({
      wordId: 1, date: today, source: sentences[0].source,
      sentence: '新[[x]]。', reading: 'しん[[x]]。', meaning: '새 번역',
      check: { date: today, ok: true },
    });
    expect(out[1]).toBe(sentences[1]);
    expect(out[2]).toEqual({ ...sentences[2], check: { date: today, ok: true } });
    expect(out[3]).toEqual({ ...sentences[3], check: { date: today, ok: false, problem: '번역이 반말' } });
    expect(sentences[3]).not.toHaveProperty('check');
  });

  it('숨긴 예문은 수정안으로 교체할 때만 바꾸고, 통과·숨김 판정을 받아도 check 까지 그대로 둔다', () => {
    const hidden = { check: { date: '2026-09-01', ok: false, problem: '옛 판정' } };
    const sentences = [entry(1, hidden), entry(2, hidden), entry(3, hidden)];
    const out = applyCheckResults(sentences, {
      passed: new Set([1]),
      rejected: new Map([[2, '새 판정']]),
      fixed: new Map([[3, fix]]),
    }, today);

    expect(out[0]).toBe(sentences[0]);
    expect(out[1]).toBe(sentences[1]);
    expect(out[2]).toMatchObject({ date: today, sentence: '新[[x]]。', check: { date: today, ok: true } });
  });

  it('숨긴 이유는 200자까지만 남긴다', () => {
    const out = applyCheckResults([entry(1)], { rejected: new Map([[1, 'あ'.repeat(300)]]) }, today);
    expect(out[0].check.problem).toHaveLength(200);
  });
});

describe('shouldRefreshSentences', () => {
  it('마지막 성공 후 최소 간격이 지나야 다시 받고, force 면 간격을 무시한다', () => {
    const last = 1_000_000;
    expect(shouldRefreshSentences(last, last + SENTENCE_REFRESH_MIN_MS - 1)).toBe(false);
    expect(shouldRefreshSentences(last, last + SENTENCE_REFRESH_MIN_MS)).toBe(true);
    expect(shouldRefreshSentences(last, last + 1, true)).toBe(true);
    expect(shouldRefreshSentences(0, 1)).toBe(true);
  });
});
