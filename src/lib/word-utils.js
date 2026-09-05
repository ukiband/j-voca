/**
 * 단어 목록 필터링 유틸리티
 */

import { getStep } from './lesson-utils';

/**
 * step/챕터 필터와 검색어를 조합하여 단어 목록을 필터링한다.
 * @param {Array} words - 전체 단어 배열
 * @param {number|null} step - 선택된 step (null이면 step 제한 없음)
 * @param {number|null} chapter - 선택된 챕터 (null이면 step 내 전체)
 * @param {string} query - 검색어 (빈 문자열이면 필터 없음)
 * @returns {Array} 필터링된 단어 배열
 *
 * step과 chapter 조합:
 * - 둘 다 null → 전체
 * - step만 있음 → 해당 step의 전체 단어
 * - 둘 다 있음 → 해당 (step, chapter) 레슨의 단어
 * chapter만 있고 step이 null인 경우는 step 2부터 chapter 번호가 겹치므로
 * 의미가 모호하다. 호출 측이 이 조합을 만들지 않도록 하고, 여기서는 chapter만 비교한다.
 */
export function filterWords(words, step, chapter, query) {
  let result = words;

  // step 필터: step 필드가 없는 구버전 데이터는 getStep이 1로 간주한다
  if (step !== null && step !== undefined) {
    result = result.filter(w => getStep(w) === step);
  }

  // 챕터 필터 적용
  if (chapter !== null && chapter !== undefined) {
    result = result.filter(w => w.chapter === chapter);
  }

  // 검색어 필터 적용 (대소문자 무시, 부분 일치)
  const trimmed = (query ?? '').trim().toLowerCase();
  if (trimmed) {
    result = result.filter(w =>
      (w.word ?? '').toLowerCase().includes(trimmed) ||
      (w.reading ?? '').toLowerCase().includes(trimmed) ||
      (w.meaning ?? '').toLowerCase().includes(trimmed)
    );
  }

  return result;
}
