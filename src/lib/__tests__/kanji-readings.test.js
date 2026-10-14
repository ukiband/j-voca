import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildStudyReadings, getKanjiSourceWords, matchKanjiReadings } from '../kanji-readings';
import { kanjiChunkName } from '../kanji';

const dictionary = {};
function match(character, text, reading) {
  for (const c of text) {
    const chunk = kanjiChunkName(c);
    if (chunk && !dictionary[c]) Object.assign(dictionary, JSON.parse(readFileSync(new URL(`../../../public/data/kanji/${chunk}.json`, import.meta.url), 'utf8')));
  }
  return matchKanjiReadings(character, { word: text, reading }, dictionary)
    .map(({ kind, reading }) => [kind, reading]);
}

describe('학습 단어의 한자 읽기', () => {
  it.each([
    ['開', '開ける', 'あける', 'kun', 'あ.ける'],
    ['分', '分かる', 'わかる', 'kun', 'わ.かる'],
    ['四', '四', 'よん', 'kun', 'よん'],
    ['食', '食べる', 'たべる', 'kun', 'た.べる'],
    ['食', '食べます', 'たべます', 'kun', 'た.べる'],
    ['食', '食べ物', 'たべもの', 'kun', 'た.べる'],
    ['行', '行きませんか', 'いきませんか', 'kun', 'い.く'],
    ['行', '行った', 'いった', 'kun', 'い.く'],
    ['書', '書いて', 'かいて', 'kun', 'か.く'],
    ['入', '風呂に入る', 'ふろにはいる', 'kun', 'はい.る'],
    ['出', '思い出す', 'おもいだす', 'kun', 'だ.す'],
    ['食', '食事', 'しょくじ', 'on', 'ショク'],
    ['行', '銀行', 'ぎんこう', 'on', 'コウ'],
    ['生', '先生', 'せんせい', 'on', 'セイ'],
    ['高', '高かった', 'たかかった', 'kun', 'たか.い'],
    ['死', '死ぬ', 'しぬ', 'kun', 'し.ぬ'],
    ['転', '転んでけがをしました。', 'ころんでけがをしました。', 'kun', 'ころ.ぶ'],
    ['開', 'ドアを 開けます。', 'ドアを あけます。', 'kun', 'あ.ける'],
  ])('%s: %s → %s', (character, text, reading, kind, expected) => {
    expect(match(character, text, reading)).toEqual([[kind, expected]]);
  });

  it.each([
    ['日', '今日', 'きょう'], ['下', '下手だ', 'へただ'], ['日', '3日', 'みっか'],
    ['開', '開ける', 'ひらく'], ['開', '開ける', ''],
    ['食', '食事', 'たべる'],
  ])('확정하기 어려운 %s / %s는 단어 전체 읽기로 남긴다', (character, text, reading) => {
    expect(match(character, text, reading)).toEqual([]);
  });

  it('같은 단어에 등장하는 대상 글자의 읽기가 여러 개이면 모두 연결한다', () => {
    expect(match('出', '出てから出す', 'でてからだす')).toEqual([['kun', 'で.る'], ['kun', 'だ.す']]);
  });

  it('예문에 같은 글자가 반복되어도 누른 위치의 읽기를 먼저 연결한다', () => {
    const word = { word: '自転車で 転んでけがをしました。', reading: 'じてんしゃで ころんでけがをしました。' };
    match('転', word.word, word.reading);
    expect(matchKanjiReadings('転', { ...word, characterIndex: 1 }, dictionary).map(m => m.reading)).toEqual(['テン']);
    expect(matchKanjiReadings('転', { ...word, characterIndex: 5 }, dictionary).map(m => m.reading)).toEqual(['ころ.ぶ']);
  });

  it('같은 한자 덩어리 안에서도 선택 위치를 구분한다', () => {
    const word = { word: '甲甲', reading: 'あこう' };
    const dict = { 甲: { kun: ['あ'], on: ['コウ'] } };
    expect(matchKanjiReadings('甲', { ...word, characterIndex: 0 }, dict).map(m => m.reading)).toEqual(['あ']);
    expect(matchKanjiReadings('甲', { ...word, characterIndex: 1 }, dict).map(m => m.reading)).toEqual(['コウ']);
  });

  it('사전이나 가나 경계가 모호할 때 후보를 임의로 선택하지 않는다', () => {
    expect(matchKanjiReadings('甲', { word: '甲乙', reading: 'あいう' }, {
      甲: { kun: ['あ', 'あい'], on: [] }, 乙: { kun: ['いう', 'う'], on: [] },
    })).toEqual([]);
    expect(matchKanjiReadings('甲', { word: '甲の乙', reading: 'あのいのう' }, {
      甲: { kun: ['あ', 'あのい'], on: [] }, 乙: { kun: ['いのう', 'う'], on: [] },
    })).toEqual([]);
  });

  it('복합어의 사전을 받지 못하면 읽기를 추측하지 않고 학습 단어를 유지한다', () => {
    const source = { word: '食事', reading: 'しょくじ', meaning: '식사' };
    const result = buildStudyReadings('食', [source], { 食: { on: ['ショク'], kun: ['た.べる'] } });
    expect(result).toEqual({ kun: [], on: [], rows: [{ word: source, matched: false }] });
  });
});

describe('Step·Lesson과 현재 문맥', () => {
  const words = [
    { id: 1, step: 1, chapter: 1, word: '開く', reading: 'ひらく', meaning: '열리다' },
    { id: 2, step: 2, chapter: 1, word: '開ける', reading: 'あける', meaning: '열다' },
    { id: 3, step: 2, chapter: 2, word: '開く', reading: 'あく', meaning: '열리다' },
    { id: 4, step: 2, chapter: 1, word: '開ける', reading: 'あける', meaning: '열다' },
    { id: 5, step: 2, chapter: 1, word: '開く', reading: 'ひらく', meaning: '열다' },
  ];

  it('현재 단어를 우선하고 다른 레슨은 제외하며 같은 내용의 등록 단어는 합친다', () => {
    const selected = getKanjiSourceWords(words, '開', words[1], words[4]);
    expect(selected).toEqual([words[4], words[1]]);
    match('開', '開く', 'ひらく');
    expect(buildStudyReadings('開', selected, dictionary).kun).toEqual(['ひら.く', 'あ.ける']);
  });

  it('step 없는 기존 단어는 Step 1로 연결하고 다른 Step을 섞지 않는다', () => {
    const legacy = { id: 6, chapter: 1, word: '開く', reading: 'あく' };
    expect(getKanjiSourceWords([...words, legacy], '開', legacy)).toEqual([words[0], legacy]);
    expect(getKanjiSourceWords(words, '開', null)).toEqual([]);
  });

  it('예문에만 등장한 글자도 현재 예문과 해당 레슨에서만 연결한다', () => {
    const sentence = { word: 'ドアを開けた。', reading: 'ドアをあけた。', meaning: '문을 열었다.' };
    expect(getKanjiSourceWords(words, '開', { step: 3, chapter: 1 }, sentence)).toEqual([sentence]);
    expect(getKanjiSourceWords(words, '開', words[1], { word: '食べる', reading: 'たべる' })).toEqual([words[1], words[4]]);
  });

  it('단어 수정과 삭제는 다음 조회에 반영한다', () => {
    const edited = { ...words[1], word: '閉める', reading: 'しめる' };
    expect(getKanjiSourceWords([edited], '開', edited)).toEqual([]);
    expect(getKanjiSourceWords([], '開', words[1])).toEqual([]);
  });

  it('등록된 실제 회귀 사례의 읽기를 찾는다', () => {
    const registered = JSON.parse(readFileSync(new URL('../../../public/data/words.json', import.meta.url), 'utf8')).words;
    for (const [id, char, expected] of [[209, '四', 'よん'], [690, '分', 'わ.かる'], [1029, '開', 'あ.ける'], [1008, '入', 'はい.る']]) {
      const word = registered.find(word => word.id === id);
      expect(match(char, word.word, word.reading)).toEqual([['kun', expected]]);
    }
  });
});
