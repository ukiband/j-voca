/**
 * 단어 목록 필터링 유틸리티
 */

/**
 * 챕터 필터와 검색어를 조합하여 단어 목록을 필터링한다.
 * @param {Array} words - 전체 단어 배열
 * @param {number|null} chapter - 선택된 챕터 (null이면 전체)
 * @param {string} query - 검색어 (빈 문자열이면 필터 없음)
 * @returns {Array} 필터링된 단어 배열
 */
export function filterWords(words, chapter, query) {
  let result = words;

  // 챕터 필터 적용
  if (chapter !== null) {
    result = result.filter(w => w.chapter === chapter);
  }

  // 검색어 필터 적용 (대소문자 무시, 부분 일치)
  const trimmed = query.trim().toLowerCase();
  if (trimmed) {
    result = result.filter(w =>
      (w.word ?? '').toLowerCase().includes(trimmed) ||
      (w.reading ?? '').toLowerCase().includes(trimmed) ||
      (w.meaning ?? '').toLowerCase().includes(trimmed)
    );
  }

  return result;
}
