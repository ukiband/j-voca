import { describe, it, expect } from 'vitest';
import { filterWords } from '../word-utils';

const words = [
  { id: 1, chapter: 1, word: '食べる', reading: 'たべる', meaning: '먹다' },
  { id: 2, chapter: 1, word: '飲む', reading: 'のむ', meaning: '마시다' },
  { id: 3, step: 1, chapter: 2, word: '走る', reading: 'はしる', meaning: '달리다' },
  { id: 4, step: 1, chapter: 2, word: '歩く', reading: 'あるく', meaning: '걷다' },
  { id: 5, step: 1, chapter: 3, word: 'Apple', reading: 'アップル', meaning: '사과' },
  { id: 6, step: 2, chapter: 1, word: '読む', reading: 'よむ', meaning: '읽다' },
  { id: 7, step: 2, chapter: 2, word: '書く', reading: 'かく', meaning: '쓰다' },
];

describe('filterWords', () => {
  it('step/챕터/검색어 없이 전체 반환', () => {
    expect(filterWords(words, null, null, '')).toEqual(words);
  });

  it('step 필터만 적용 - 해당 step 전체', () => {
    const result = filterWords(words, 2, null, '');
    expect(result.map(w => w.id)).toEqual([6, 7]);
  });

  it('step 필터 - step 필드 없는 단어는 step 1로 간주', () => {
    const result = filterWords(words, 1, null, '');
    expect(result.map(w => w.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('step + 챕터 필터 - 다른 step의 같은 번호 챕터는 제외', () => {
    const result = filterWords(words, 1, 1, '');
    expect(result.map(w => w.id)).toEqual([1, 2]);
    expect(filterWords(words, 2, 1, '').map(w => w.id)).toEqual([6]);
  });

  it('존재하지 않는 step이면 빈 배열', () => {
    expect(filterWords(words, 99, null, '')).toEqual([]);
  });

  it('검색어 필터만 적용 - word 필드 매칭', () => {
    const result = filterWords(words, null, null, '食');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('검색어 필터만 적용 - reading 필드 매칭', () => {
    const result = filterWords(words, null, null, 'のむ');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('검색어 필터만 적용 - meaning 필드 매칭', () => {
    const result = filterWords(words, null, null, '달리다');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('step + 챕터와 검색어 조합 필터', () => {
    // step 1 챕터 2에서 '걷' 검색
    const result = filterWords(words, 1, 2, '걷');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });

  it('대소문자 무시 검색', () => {
    const result = filterWords(words, null, null, 'apple');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(5);
  });

  it('부분 일치 검색', () => {
    const result = filterWords(words, null, null, '마시');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('검색 결과 없으면 빈 배열', () => {
    expect(filterWords(words, null, null, '존재하지않는단어')).toEqual([]);
  });

  it('공백만 있는 검색어는 무시', () => {
    expect(filterWords(words, null, null, '   ')).toEqual(words);
  });

  it('빈 배열 입력 시 빈 배열 반환', () => {
    expect(filterWords([], 1, 1, '검색어')).toEqual([]);
  });

  it('필드가 null/undefined인 단어도 에러 없이 처리', () => {
    const wordsWithNull = [
      { id: 10, chapter: 1, word: null, reading: undefined, meaning: '뜻' },
    ];
    expect(() => filterWords(wordsWithNull, null, null, '테스트')).not.toThrow();
    expect(filterWords(wordsWithNull, null, null, '뜻')).toHaveLength(1);
  });
});
