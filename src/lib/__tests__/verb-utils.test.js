import { describe, it, expect } from 'vitest';
import { VERB_FORMS, conjugateVerb, editVerbEntry, getPracticeVerbs, buildVerbQuestions } from '../verb-utils';
import { startVerbPractice, verbPracticeReducer } from '../verb-practice';

const verb = (word, reading, verbGroup = 1, extra = {}) => ({ id: 1, word, reading, pos: '동사', verbGroup, isDictionaryForm: true, potentialAllowed: true, ...extra });

describe('사전형 동사 활용', () => {
  it.each([
    ['買う', 'かう', 1, ['買って', '買わない', '買った', '買える'], ['かって', 'かわない', 'かった', 'かえる']],
    ['待つ', 'まつ', 1, ['待って', '待たない', '待った', '待てる'], ['まって', 'またない', 'まった', 'まてる']],
    ['帰る', 'かえる', 1, ['帰って', '帰らない', '帰った', '帰れる'], ['かえって', 'かえらない', 'かえった', 'かえれる']],
    ['読む', 'よむ', 1, ['読んで', '読まない', '読んだ', '読める'], ['よんで', 'よまない', 'よんだ', 'よめる']],
    ['遊ぶ', 'あそぶ', 1, ['遊んで', '遊ばない', '遊んだ', '遊べる'], ['あそんで', 'あそばない', 'あそんだ', 'あそべる']],
    ['死ぬ', 'しぬ', 1, ['死んで', '死なない', '死んだ', '死ねる'], ['しんで', 'しなない', 'しんだ', 'しねる']],
    ['書く', 'かく', 1, ['書いて', '書かない', '書いた', '書ける'], ['かいて', 'かかない', 'かいた', 'かける']],
    ['泳ぐ', 'およぐ', 1, ['泳いで', '泳がない', '泳いだ', '泳げる'], ['およいで', 'およがない', 'およいだ', 'およげる']],
    ['話す', 'はなす', 1, ['話して', '話さない', '話した', '話せる'], ['はなして', 'はなさない', 'はなした', 'はなせる']],
    ['食べる', 'たべる', 2, ['食べて', '食べない', '食べた', '食べられる'], ['たべて', 'たべない', 'たべた', 'たべられる']],
    ['する', 'する', 3, ['して', 'しない', 'した', 'できる'], ['して', 'しない', 'した', 'できる']],
    ['来る', 'くる', 3, ['来て', '来ない', '来た', '来られる'], ['きて', 'こない', 'きた', 'こられる']],
    ['くる', 'くる', 3, ['きて', 'こない', 'きた', 'こられる'], ['きて', 'こない', 'きた', 'こられる']],
    ['行く', 'いく', 1, ['行って', '行かない', '行った', '行ける'], ['いって', 'いかない', 'いった', 'いける']],
    ['いく', 'いく', 1, ['いって', 'いかない', 'いった', 'いける'], ['いって', 'いかない', 'いった', 'いける']],
  ])('%s의 네 형태와 읽기', (word, reading, group, answers, readings) => {
    const results = VERB_FORMS.map(f => conjugateVerb(verb(word, reading, group), f.id));
    expect(results.map(a => a.word)).toEqual(answers);
    expect(results.map(a => a.reading)).toEqual(readings);
  });

  it('동음이의어의 분류를 어미만으로 추측하지 않는다', () => {
    expect(conjugateVerb(verb('切る', 'きる', 1), 'te').word).toBe('切って');
    expect(conjugateVerb(verb('着る', 'きる', 2), 'te').word).toBe('着て');
    expect(conjugateVerb(verb('作る', 'つくる', 1), 'te').word).toBe('作って');
  });

  it.each(['ある', '有る', '在る'])('%s는 ない로 변환한다', word => {
    expect(conjugateVerb(verb(word, 'ある', 1, { potentialAllowed: false }), 'nai')).toMatchObject({ word: 'ない', reading: 'ない' });
  });

  it('동사구 앞부분과 가타카나를 유지한다', () => {
    const piano = verb('ピアノを弾く', 'ぴあのをひく');
    expect(conjugateVerb(piano, 'te')).toMatchObject({ word: 'ピアノを弾いて', reading: 'ピアノをひいて' });
    expect(conjugateVerb(verb('テストを受ける', 'テストをうける', 2), 'ta')).toMatchObject({ word: 'テストを受けた', reading: 'テストをうけた' });
    expect(conjugateVerb(verb('提出する', 'ていしゅつする', 3), 'potential')).toMatchObject({ word: '提出できる', reading: 'ていしゅつできる' });
    expect(conjugateVerb(verb('持って来る', 'もってくる', 3), 'nai')).toMatchObject({ word: '持って来ない', reading: 'もってこない' });
    expect(conjugateVerb(verb('学校に行く', 'がっこうにいく'), 'te')).toMatchObject({ word: '学校に行って', reading: 'がっこうにいって' });
  });
});

describe('동사 대상 검증과 저장', () => {
  it.each([
    verb('行きます', 'いきます'), verb('書いて', 'かいて'), verb('借り', 'かり', 2),
    verb('食べる', 'たべる', null), verb('本', 'ほん', 1, { pos: '명사' }),
    verb('書く', 'かく', 1, { isDictionaryForm: false }), verb('書く', 'かく', '1'),
    verb('飲む', 'のむ', 2), verb('来る', 'きた', 3), verb('書く', '', 1),
  ])('불명확하거나 사전형이 아닌 $word를 출제하지 않는다', word => {
    expect(conjugateVerb(word, 'te')).toBeNull();
  });

  it('가능형 적합성이 명시되어야 출제하며, 다른 형태는 유지한다', () => {
    for (const allowed of [false, undefined, 'true']) {
      const word = verb('ある', 'ある', 1, { potentialAllowed: allowed });
      expect(conjugateVerb(word, 'potential')).toBeNull();
      expect(conjugateVerb(word, 'te').word).toBe('あって');
    }
    expect(conjugateVerb(verb('書く', 'かく'), 'masu')).toBeNull();
  });

  it('표기나 읽기 수정 시 재분류하고 뜻만 수정하면 분류를 유지한다', () => {
    const word = verb('切る', 'きる');
    expect(editVerbEntry(word, { word: '着る' })).toMatchObject({ verbGroup: null, isDictionaryForm: false });
    expect(editVerbEntry(word, { reading: 'きます' }).isDictionaryForm).toBe(false);
    expect(editVerbEntry(word, { meaning: '자르다' }).verbGroup).toBe(1);
    expect(editVerbEntry(word, { word: '着る', verbGroup: 2, isDictionaryForm: true }).verbGroup).toBe(2);
  });
});

describe('출제 조합과 세션', () => {
  const words = [verb('書く', 'かく', 1, { step: 1 }), verb('食べる', 'たべる', 2, { id: 2, step: 2 }), verb('ある', 'ある', 1, { id: 3, potentialAllowed: false })];

  it('모든 Step과 선택한 형태의 유효한 조합을 빠짐없이 출제한다', () => {
    for (let mask = 0; mask < 16; mask++) {
      const forms = VERB_FORMS.filter((_, i) => mask & (1 << i)).map(f => f.id);
      const questions = buildVerbQuestions(words, forms);
      expect(questions.length).toBe(forms.reduce((n, f) => n + (f === 'potential' ? 2 : 3), 0));
      expect(new Set(questions.map(q => `${q.word.id}:${q.form}`)).size).toBe(questions.length);
    }
    expect(buildVerbQuestions(words, ['te', 'te', 'invalid'])).toHaveLength(3);
  });

  it('같은 단어의 중복을 합치고 동음이의어·다른 표기는 유지한다', () => {
    expect(getPracticeVerbs([...words, { ...words[0], id: 99, step: 3 }, verb('描く', 'かく')])).toHaveLength(4);
    const conflicting = [...words, { ...words[0], id: 99, potentialAllowed: false }];
    expect(buildVerbQuestions(conflicting, ['te'])).toHaveLength(3);
    expect(buildVerbQuestions(conflicting, ['potential'])).toHaveLength(1);
  });

  it('한 번 더는 큐 끝에 들어가고 다음 문제는 항상 앞면부터다', () => {
    let state = startVerbPractice(words, ['te']);
    const original = state;
    const first = state.queue[0];
    expect(verbPracticeReducer(state, { type: 'next' })).toBe(state);
    state = verbPracticeReducer(state, { type: 'flip' });
    state = verbPracticeReducer(state, { type: 'again' });
    expect(state.queue).toHaveLength(4);
    expect(state.queue[3]).toBe(first);
    expect(state).toMatchObject({ index: 1, initialCount: 3, flipped: false });
    expect(original.queue).toHaveLength(3);
    expect(verbPracticeReducer(state, { type: 'again' })).toBe(state);
    while (state.queue[state.index]) {
      state = verbPracticeReducer(state, { type: 'flip' });
      state = verbPracticeReducer(state, { type: 'next' });
    }
    expect(state.index).toBe(4);
    expect(verbPracticeReducer(state, { type: 'flip' })).toBe(state);
    const restarted = startVerbPractice(words, ['te']);
    expect(restarted).toMatchObject({ index: 0, initialCount: 3, flipped: false });
    expect(restarted.queue).toHaveLength(3);
  });
});
