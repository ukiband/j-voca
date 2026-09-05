import { describe, it, expect } from 'vitest';
import {
  getStep,
  lessonKey,
  isSameLesson,
  isValidLessonNumber,
  parseLessonNumber,
  getSteps,
  getChapters,
  getLatestStep,
  formatLesson,
} from '../lesson-utils';

const words = [
  { id: 1, chapter: 2 },              // step 없음 → 1로 간주
  { id: 2, step: 1, chapter: 10 },
  { id: 3, step: 1, chapter: 3 },
  { id: 4, step: 2, chapter: 1 },
  { id: 5, step: 2, chapter: 2 },
  { id: 6, step: 10, chapter: 1 },
];

describe('getStep', () => {
  it('step 필드가 있으면 그대로, 없거나 단어가 null이면 1', () => {
    expect(getStep({ step: 2 })).toBe(2);
    expect(getStep({ chapter: 3 })).toBe(1);
    expect(getStep({ step: null })).toBe(1);
    expect(getStep(null)).toBe(1);
    expect(getStep(undefined)).toBe(1);
  });
});

describe('lessonKey', () => {
  it('(step, chapter)를 문자열 키로 만든다', () => {
    expect(lessonKey(2, 3)).toBe('2-3');
  });
});

describe('isSameLesson', () => {
  it('step 1 Lesson 3 매칭 시 step 2 Lesson 3은 매칭 안 됨', () => {
    expect(isSameLesson({ step: 1, chapter: 3 }, 1, 3)).toBe(true);
    expect(isSameLesson({ step: 2, chapter: 3 }, 1, 3)).toBe(false);
    expect(isSameLesson({ step: 1, chapter: 3 }, 2, 3)).toBe(false);
  });

  it('chapter가 다르면 매칭 안 됨', () => {
    expect(isSameLesson({ step: 1, chapter: 4 }, 1, 3)).toBe(false);
  });

  it('step 누락 단어는 step 1로 매칭', () => {
    expect(isSameLesson({ chapter: 3 }, 1, 3)).toBe(true);
    expect(isSameLesson({ chapter: 3 }, 2, 3)).toBe(false);
  });

  it('step이나 chapter 인자가 undefined/null이면 아무것도 매칭 안 됨', () => {
    // 호출 측에서 인자가 빠졌을 때 전체 삭제 사고를 막는 안전장치
    expect(isSameLesson({ step: 1, chapter: 3 }, undefined, 3)).toBe(false);
    expect(isSameLesson({ chapter: 3 }, undefined, 3)).toBe(false);
    expect(isSameLesson({ step: 1, chapter: 3 }, 1, undefined)).toBe(false);
    expect(isSameLesson({ step: 1, chapter: 3 }, null, null)).toBe(false);
  });
});

describe('isValidLessonNumber', () => {
  it('1 이상의 정수만 허용하고 0, 음수, 소수, NaN, 문자열은 거부', () => {
    expect(isValidLessonNumber(1)).toBe(true);
    expect(isValidLessonNumber(10)).toBe(true);
    expect(isValidLessonNumber(0)).toBe(false);
    expect(isValidLessonNumber(-1)).toBe(false);
    expect(isValidLessonNumber(1.5)).toBe(false);
    expect(isValidLessonNumber(NaN)).toBe(false);
    expect(isValidLessonNumber('1')).toBe(false);
    expect(isValidLessonNumber(undefined)).toBe(false);
  });
});

describe('parseLessonNumber', () => {
  it('양의 정수 문자열을 숫자로 변환', () => {
    expect(parseLessonNumber('2')).toBe(2);
    expect(parseLessonNumber(' 10 ')).toBe(10);
    expect(parseLessonNumber(3)).toBe(3);
  });

  it('비정상 값은 null', () => {
    expect(parseLessonNumber('abc')).toBeNull();
    expect(parseLessonNumber('1.5')).toBeNull();
    expect(parseLessonNumber('-1')).toBeNull();
    expect(parseLessonNumber('0')).toBeNull();
    expect(parseLessonNumber('')).toBeNull();
    expect(parseLessonNumber(null)).toBeNull();
    expect(parseLessonNumber(undefined)).toBeNull();
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

  it('존재하지 않는 step이면 빈 배열', () => {
    expect(getChapters(words, 99)).toEqual([]);
  });
});

describe('getLatestStep', () => {
  it('가장 큰 step을 반환하고, step 없는 단어만 있거나 단어가 없으면 1', () => {
    expect(getLatestStep(words)).toBe(10);
    expect(getLatestStep([{ chapter: 1 }])).toBe(1);
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
