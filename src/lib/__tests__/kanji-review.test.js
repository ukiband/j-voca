import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildKanjiItems, getKanjiReviews } from '../kanji-review';
import { createInitialReview, gradeCard, isDue } from '../fsrs';
import { db } from '../db';
import { getDueCount, getDueCountByLesson, getDueItems, getDueWords, loadReviewData, orderReviewItems } from '../review-utils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.setSystemTime(vi.getRealSystemTime());
});

describe('레슨별 한자 학습 대상', () => {
  it('단어 표기에서만 추출하고 같은 레슨 안의 중복 한자를 합친다', () => {
    const words = [
      { id: 2, chapter: 1, word: '食事' },
      { id: 1, chapter: 1, word: '食べる', reading: '漢', meaning: '字', sentence: '日' },
      { id: 3, chapter: 1, word: '人人 カタカナ ひらがな 123々' },
    ];
    const items = buildKanjiItems(words);
    expect(items.map(item => item.kanjiId)).toEqual(['食', '事', '人']);
    expect(items[0]).toEqual({ id: 'kanji:1:1:食', kanjiId: '食', step: 1, chapter: 1, position: 0, sourceWords: [words[1], words[0]] });
    expect(items[2].sourceWords).toEqual([words[2]]);
    expect(words.map(word => word.id)).toEqual([2, 1, 3]);
  });

  it('한자가 없는 단어·잘못된 레슨은 제외하고 확장 유니코드 한자는 한 글자로 처리한다', () => {
    const items = buildKanjiItems([
      { id: 1, chapter: 1, word: 'コーヒー' },
      { id: 2, chapter: 0, word: '食' },
      { id: 3, step: -1, chapter: 1, word: '事' },
      { id: 4, chapter: 1, word: '𠮷野' },
    ]);
    expect(items.map(item => item.kanjiId)).toEqual(['𠮷', '野']);
  });

  it('단어 수정·삭제 후 같은 레슨에 다시 나온 한자는 이전 학습 기록을 이어 쓴다', () => {
    const oldItems = buildKanjiItems([{ id: 10, chapter: 1, word: '食事' }]);
    const saved = gradeCard(createInitialReview(oldItems[0].id), 'good');
    expect(getKanjiReviews([], [saved])).toEqual([]);
    const nextItems = buildKanjiItems([
      { id: 11, chapter: 1, word: '食べる' },
      { id: 1, chapter: 1, word: '日本' },
    ]);
    expect(nextItems.find(item => item.kanjiId === '食').id).toBe(oldItems[0].id);
    expect(nextItems.some(item => item.kanjiId === '事')).toBe(false);
    expect(getKanjiReviews(nextItems, [saved]).find(review => review.wordId === oldItems[0].id)).toEqual(saved);
    expect(saved.reps).toBe(1);
  });
});

describe('공유 복습 엔진의 학습 종류 분리', () => {
  const words = [
    { id: 1, step: 1, chapter: 1, word: '食事', tags: ['명사'] },
    { id: 2, step: 1, chapter: 2, word: '食べる' },
    { id: 3, step: 2, chapter: 1, word: '食べる' },
  ];

  function stored(reviews = []) {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    vi.spyOn(db.words, 'toArray').mockResolvedValue(words);
    vi.spyOn(db.reviews, 'toArray').mockResolvedValue(reviews);
  }

  it('일본어를 이미 외웠어도 한자는 처음부터 복습하며 기록은 평가 전까지 쓰지 않는다', async () => {
    stored(words.map(word => ({ wordId: word.id, due: '2099-01-01T00:00:00Z', state: 2 })));
    const put = vi.spyOn(db.reviews, 'put');
    const bulkPut = vi.spyOn(db.reviews, 'bulkPut');
    expect(await getDueWords()).toEqual([]);
    const { items, reviews } = await loadReviewData('kanji');
    expect(items).toHaveLength(4);
    expect(reviews.every(review => review.state === 0 && isDue(review))).toBe(true);
    expect(getDueCount(items, reviews)).toEqual({ total: 4, reconfirm: 0 });
    expect(put).not.toHaveBeenCalled();
    expect(bulkPut).not.toHaveBeenCalled();
  });

  it('한자의 다음 일정은 해당 Step·Lesson에만 적용되고 일본어 복습 수에 섞이지 않는다', async () => {
    const reviews = [
      { wordId: 1, due: '2026-03-19T00:00:00Z', state: 2 },
      { wordId: 'kanji:1:1:食', due: '2099-01-01T00:00:00Z', state: 2 },
      { wordId: 'kanji:9:9:食', due: '2026-03-19T00:00:00Z', state: 2 },
    ];
    stored(reviews);
    expect((await getDueWords()).map(item => item.id)).toEqual([1]);
    expect(getDueCount(words, reviews)).toEqual({ total: 1, reconfirm: 0 });
    expect((await getDueItems('kanji', 1, 1)).map(item => item.kanjiId)).toEqual(['事']);
    expect((await getDueItems('kanji', 1, 2)).map(item => item.id)).toEqual(['kanji:1:2:食']);
    expect((await getDueItems('kanji', 2, 1)).map(item => item.id)).toEqual(['kanji:2:1:食']);
    const kanji = await loadReviewData('kanji');
    expect(kanji.items.find(item => item.id === 'kanji:1:2:食').sourceWords).toEqual([words[1]]);
    expect(kanji.items.find(item => item.id === 'kanji:2:1:食').sourceWords).toEqual([words[2]]);
    expect(getDueCountByLesson(kanji.items, kanji.reviews)).toEqual({
      '1-1': { step: 1, chapter: 1, total: 1, reconfirm: 0 },
      '1-2': { step: 1, chapter: 2, total: 1, reconfirm: 0 },
      '2-1': { step: 2, chapter: 1, total: 1, reconfirm: 0 },
    });
  });

  it('한자도 학습·재학습 상태에서는 재확인 시각을 기다린다', async () => {
    stored([
      { wordId: 'kanji:1:1:食', due: '2026-03-19T12:01:00Z', state: 1 },
      { wordId: 'kanji:1:1:事', due: '2026-03-19T11:59:00Z', state: 3 },
    ]);
    expect((await getDueItems('kanji', 1, 1)).map(item => item.kanjiId)).toEqual(['事']);
    const { items, reviews } = await loadReviewData('kanji');
    expect(getDueCount(items, reviews)).toEqual({ total: 3, reconfirm: 1 });
  });

  it('기존 일본어 태그 및 Step 없는 레슨 URL의 동작을 유지한다', async () => {
    stored(words.map(word => ({ wordId: word.id, due: '2026-03-19T00:00:00Z', state: 0 })));
    expect((await getDueWords(undefined, 1)).map(word => word.id)).toEqual([1]);
    expect((await getDueWords(undefined, undefined, '명사')).map(word => word.id)).toEqual([1]);
  });

  it('순차 복습은 단어의 등록 순서와 한자의 첫 등장 순서를 각각 유지한다', () => {
    expect(orderReviewItems([{ id: 10 }, { id: 2 }], 'sequential').map(item => item.id)).toEqual([2, 10]);
    const items = buildKanjiItems(words);
    const reversed = [...items].reverse();
    expect(orderReviewItems(reversed, 'sequential')).toEqual(items);
    expect(reversed).toEqual([...items].reverse());
  });
});
