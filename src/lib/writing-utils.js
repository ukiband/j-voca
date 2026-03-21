/**
 * 쓰기 모드용 유틸리티
 * 사용자 입력과 정답을 비교하는 로직을 제공한다.
 */

/**
 * 입력 문자열을 정규화한다.
 * trim, lowercase, 전각/반각 변환을 수행한다.
 */
export function normalizeAnswer(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    // 전각 영숫자/기호를 반각으로 변환 (U+FF01~U+FF5E -> U+0021~U+007E)
    .replace(/[\uff01-\uff5e]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    // 전각 스페이스를 반각으로
    .replace(/\u3000/g, ' ');
}

/**
 * 사용자 입력이 정답인지 검사한다.
 * word.word(한자) 또는 word.reading(히라가나) 중 하나와 일치하면 정답으로 처리한다.
 */
export function checkAnswer(input, word) {
  const normalized = normalizeAnswer(input);
  const expected = normalizeAnswer(word?.word ?? '');
  const reading = normalizeAnswer(word?.reading ?? '');

  // 한자 또는 읽기 중 하나와 일치하면 정답
  const correct = normalized !== '' && (normalized === expected || normalized === reading);

  return {
    correct,
    expected: word?.word ?? '',
    reading: word?.reading ?? '',
  };
}
