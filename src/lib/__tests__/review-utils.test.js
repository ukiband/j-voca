import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDueCount, getDueCountByLesson } from '../review-utils';

afterEach(() => {
  vi.setSystemTime(vi.getRealSystemTime());
});

describe('getDueCount', () => {
  const words = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
  ];

  it('due 날짜가 오늘 이전인 단어 수 반환', () => {
    const now = new Date('2026-03-19T12:00:00Z');
    vi.setSystemTime(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const laterToday = new Date(now);
    laterToday.setHours(23, 59, 59, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const reviews = [
      { wordId: 1, due: yesterday.toISOString() },
      { wordId: 2, due: laterToday.toISOString() },
      { wordId: 3, due: tomorrow.toISOString() },
    ];
    // wordId 1: 어제 → due, wordId 2: 오늘 → due, wordId 3: 내일 → not due
    expect(getDueCount(words, reviews).total).toBe(2);
  });

  it('단어가 없으면 0', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const reviews = [{ wordId: 99, due: '2026-03-19T00:00:00.000Z' }];
    expect(getDueCount([], reviews).total).toBe(0);
  });

  it('리뷰가 없으면 0', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    expect(getDueCount(words, []).total).toBe(0);
  });

  it('삭제된 단어의 리뷰는 무시', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const reviews = [
      { wordId: 1, due: '2026-03-19T00:00:00.000Z' },
      { wordId: 99, due: '2026-03-19T00:00:00.000Z' },
    ];
    expect(getDueCount(words, reviews).total).toBe(1);
  });

  it('Learning/Relearning 상태도 due면 카운트에 포함', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const reviews = [
      { wordId: 1, due: '2026-03-19T00:00:00.000Z', state: 1 },  // Learning
      { wordId: 2, due: '2026-03-19T00:00:00.000Z', state: 3 },  // Relearning
      { wordId: 3, due: '2026-03-19T00:00:00.000Z', state: 2 },  // Review
    ];
    expect(getDueCount(words, reviews)).toEqual({ total: 3, reconfirm: 2 });
  });
});

describe('getDueCountByLesson', () => {
  it('lesson별로 due 카운트를 분리 (step 없는 단어는 step 1로 키잉)', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const words = [
      { id: 1, chapter: 1 },
      { id: 2, chapter: 1 },
      { id: 3, chapter: 2 },
      { id: 4, chapter: 3 },
    ];
    const reviews = [
      { wordId: 1, due: '2026-03-19T00:00:00.000Z', state: 2 },
      { wordId: 2, due: '2026-03-19T00:00:00.000Z', state: 1 },  // Learning
      { wordId: 3, due: '2026-03-19T00:00:00.000Z', state: 2 },
      { wordId: 4, due: '2026-03-20T00:00:00.000Z', state: 2 },  // 내일 → not due
    ];
    const result = getDueCountByLesson(words, reviews);
    expect(result['1-1']).toEqual({ step: 1, chapter: 1, total: 2, reconfirm: 1 });
    expect(result['1-2']).toEqual({ step: 1, chapter: 2, total: 1, reconfirm: 0 });
    expect(result['1-3']).toBeUndefined();  // due가 아닌 lesson은 포함되지 않음
  });

  it('step이 다르면 같은 chapter 번호라도 별도 키로 집계', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const words = [
      { id: 1, step: 1, chapter: 1 },
      { id: 2, step: 2, chapter: 1 },
      { id: 3, step: 2, chapter: 1 },
    ];
    const reviews = [
      { wordId: 1, due: '2026-03-19T00:00:00.000Z', state: 2 },
      { wordId: 2, due: '2026-03-19T00:00:00.000Z', state: 2 },
      { wordId: 3, due: '2026-03-19T00:00:00.000Z', state: 3 },  // Relearning
    ];
    const result = getDueCountByLesson(words, reviews);
    expect(result['1-1']).toEqual({ step: 1, chapter: 1, total: 1, reconfirm: 0 });
    expect(result['2-1']).toEqual({ step: 2, chapter: 1, total: 2, reconfirm: 1 });
  });

  it('due인 리뷰가 없으면 빈 객체 반환', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const words = [{ id: 1, chapter: 1 }];
    const reviews = [{ wordId: 1, due: '2026-03-20T00:00:00.000Z', state: 2 }];
    expect(getDueCountByLesson(words, reviews)).toEqual({});
  });
});
