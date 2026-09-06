
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

/**
 * 한국 시간(Asia/Seoul) 기준 YYYY-MM-DD 문자열을 반환한다.
 * GitHub Actions 러너는 UTC 로 돌아서 getLocalDateString() 을 쓰면 KST 오전 9시 전까지 전날 날짜가 나온다.
 * 예문 생성 배치가 붙이는 date 와 앱이 "오늘 생성분"을 고르는 기준이 같은 날짜여야 하므로 양쪽이 이 함수를 공유한다.
 * sv-SE 로케일은 날짜를 항상 ISO 형식(2026-09-06)으로 찍어 주므로 문자열 조립 없이 그대로 쓸 수 있다.
 */
export function getKstDateString(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
}
