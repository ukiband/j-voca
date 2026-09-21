const ENABLED_KEY = 'date-time-popup-enabled';
const CLOSED_AT_KEY = 'date-time-popup-closed-at';
const HOUR_MS = 60 * 60 * 1000;

export function getDateTimePopupEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) !== 'false'; }
  catch { return true; }
}

export function setDateTimePopupEnabled(enabled) {
  localStorage.setItem(ENABLED_KEY, String(enabled));
}

export function shouldShowDateTimeQuestion(now = Date.now()) {
  if (!getDateTimePopupEnabled()) return false;
  try {
    const closedAt = Number(localStorage.getItem(CLOSED_AT_KEY));
    return !closedAt || !Number.isFinite(closedAt) || now - closedAt >= HOUR_MS;
  } catch { return true; }
}

export function dismissDateTimeQuestion() {
  try { localStorage.setItem(CLOSED_AT_KEY, String(Date.now())); } catch {}
}

export function createDateTimeQuestion(date = new Date(), kind = Math.random() < 0.5 ? 'date' : 'time') {
  if (kind === 'date') {
    const month = date.getMonth();
    const day = date.getDate();
    return {
      question: '今日は何月何日ですか。',
      meaning: '오늘은 몇 월 며칠인가요?',
      answer: `今日は${month + 1}月${day}日です。`,
    };
  }
  // 회화에서 쓰는 12시간제. 자정은 午前0時, 정오는 午後0時로 적는다(NHK 표기 기준).
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour < 12 ? '午前' : '午後';
  return {
    question: '今、何時何分ですか。',
    meaning: '지금은 몇 시 몇 분인가요?',
    answer: `今は${period}${hour % 12}時${minute ? `${minute}分` : ''}です。`,
  };
}
