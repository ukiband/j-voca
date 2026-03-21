// 학습 설정 유틸리티 — localStorage 기반 설정 읽기/쓰기

const KEYS = {
  AUTO_PRONOUNCE: 'auto-pronounce',
  FONT_SIZE: 'font-size',
};

/** 자동 발음 재생 설정 조회 */
export function getAutoPronounce() {
  return localStorage.getItem(KEYS.AUTO_PRONOUNCE) === 'true';
}

/** 자동 발음 재생 설정 저장 */
export function setAutoPronounce(enabled) {
  localStorage.setItem(KEYS.AUTO_PRONOUNCE, String(!!enabled));
}

/** 글자 크기 설정 조회 */
export function getFontSize() {
  return localStorage.getItem(KEYS.FONT_SIZE) || 'base';
}

/** 글자 크기 설정 저장 */
export function setFontSize(size) {
  localStorage.setItem(KEYS.FONT_SIZE, size);
}

export { KEYS };
