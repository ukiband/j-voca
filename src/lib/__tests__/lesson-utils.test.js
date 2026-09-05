import { describe, it, expect } from 'vitest';
import {
  getStep,
  lessonKey,
  parseLessonKey,
  getSteps,
  getChapters,
  getLatestStep,
  formatLesson,
} from '../lesson-utils';

// step 필드가 없는 단어(구버전 데이터)와 step 2 단어가 섞인 목록.
// chapter 번호가 step 간에 겹치는 상황(1-2 vs 2-2)을 일부러 포함한다.
const words = [
  { id: 1, chapter: 2 },              // step 없음 → 1로 간주
  { id: 2, step: 1, chapter: 10 },
  { id: 3, step: 1, chapter: 3 },
  { id: 4, step: 2, chapter: 1 },
  { id: 5, step: 2, chapter: 2 },
  { id: 6, step: 10, chapter: 1 },
];

describe('getStep', () => {
  it('step 필드가 있으면 그대로 반환', () => {
    expect(getStep({ step: 2 })).toBe(2);
  });

  it('step 필드가 없으면 1로 간주', () => {
    expect(getStep({ chapter: 3 })).toBe(1);
    expect(getStep({ step: undefined })).toBe(1);
    expect(getStep({ step: null })).toBe(1);
  });

  it('단어 자체가 null/undefined여도 1 반환', () => {
    expect(getStep(null)).toBe(1);
    expect(getStep(undefined)).toBe(1);
  });
});

describe('lessonKey / parseLessonKey', () => {
  it('(step, chapter)를 문자열 키로 만든다', () => {
    expect(lessonKey(2, 3)).toBe('2-3');
  });

  it('키를 다시 숫자 step/chapter로 복원한다 (왕복 변환)', () => {
    expect(parseLessonKey(lessonKey(2, 3))).toEqual({ step: 2, chapter: 3 });
    expect(parseLessonKey(lessonKey(10, 12))).toEqual({ step: 10, chapter: 12 });
  });

  it('step이 다르면 같은 chapter라도 키가 다르다', () => {
    expect(lessonKey(1, 3)).not.toBe(lessonKey(2, 3));
  });
});

describe('getSteps', () => {
  it('존재하는 step을 중복 없이 숫자 오름차순으로 반환', () => {
    // 문자열 정렬이면 [1, 10, 2]가 되므로 숫자 정렬을 확인한다
    expect(getSteps(words)).toEqual([1, 2, 10]);
  });

  it('step 필드가 없는 단어만 있으면 [1]', () => {
    expect(getSteps([{ chapter: 1 }, { chapter: 2 }])).toEqual([1]);
  });

  it('빈 배열이면 빈 배열', () => {
    expect(getSteps([])).toEqual([]);
  });
});

describe('getChapters', () => {
  it('해당 step의 chapter만 숫자 오름차순으로 반환', () => {
    // step 1: chapter 2(step 없음), 10, 3 → [2, 3, 10] (문자열 정렬이면 10이 2 앞)
    expect(getChapters(words, 1)).toEqual([2, 3, 10]);
    expect(getChapters(words, 2)).toEqual([1, 2]);
  });

  it('다른 step의 같은 번호 chapter는 섞이지 않는다', () => {
    expect(getChapters(words, 10)).toEqual([1]);
  });

  it('존재하지 않는 step이면 빈 배열', () => {
    expect(getChapters(words, 99)).toEqual([]);
  });
});

describe('getLatestStep', () => {
  it('가장 큰 step을 반환', () => {
    expect(getLatestStep(words)).toBe(10);
  });

  it('step 필드가 없는 단어만 있으면 1', () => {
    expect(getLatestStep([{ chapter: 1 }])).toBe(1);
  });

  it('단어가 없으면 1', () => {
    expect(getLatestStep([])).toBe(1);
    expect(getLatestStep(null)).toBe(1);
  });
});

describe('formatLesson', () => {
  it('기본은 "Step X · Lesson Y" 형식', () => {
    expect(formatLesson(2, 3)).toBe('Step 2 · Lesson 3');
  });

  it('withStep=false면 "Lesson Y"만', () => {
    expect(formatLesson(2, 3, { withStep: false })).toBe('Lesson 3');
  });
});
