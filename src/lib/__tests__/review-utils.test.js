import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDueCount } from '../review-utils';

afterEach(() => {
  vi.setSystemTime(vi.getRealSystemTime());
});

describe('getDueCount', () => {
  const words = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
  ];

  it('due가 현재 시각 이전인 단어 수 반환', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const reviews = [
      { wordId: 1, due: '2026-03-18T00:00:00.000Z' },
      { wordId: 2, due: '2026-03-19T12:00:00.000Z' },
      { wordId: 3, due: '2026-03-20T00:00:00.000Z' },
    ];
    expect(getDueCount(words, reviews)).toBe(2);
  });

  it('단어가 없으면 0', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const reviews = [{ wordId: 99, due: '2026-03-19T00:00:00.000Z' }];
    expect(getDueCount([], reviews)).toBe(0);
  });

  it('리뷰가 없으면 0', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    expect(getDueCount(words, [])).toBe(0);
  });

  it('삭제된 단어의 리뷰는 무시', () => {
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'));
    const reviews = [
      { wordId: 1, due: '2026-03-19T00:00:00.000Z' },
      { wordId: 99, due: '2026-03-19T00:00:00.000Z' },
    ];
    expect(getDueCount(words, reviews)).toBe(1);
  });
});
