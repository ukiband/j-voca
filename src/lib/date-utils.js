
/**
 * 로컬 타임존 기준으로 YYYY-MM-DD 문자열을 반환한다.
 * toISOString().split('T')[0]은 UTC 기준이므로 KST 자정~오전 9시에 전날로 처리되는 버그가 있다.
 * @param {Date} [date=new Date()] - 변환할 Date 객체 (기본값: 현재 시각)
 * @returns {string} YYYY-MM-DD 형식의 로컬 날짜 문자열
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
