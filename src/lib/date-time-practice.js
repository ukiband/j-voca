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

const MONTHS = [
  'いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ',
  'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ',
];
const DAYS = [
  'ついたち', 'ふつか', 'みっか', 'よっか', 'いつか', 'むいか', 'なのか', 'ようか', 'ここのか', 'とおか',
  'じゅういちにち', 'じゅうににち', 'じゅうさんにち', 'じゅうよっか', 'じゅうごにち',
  'じゅうろくにち', 'じゅうしちにち', 'じゅうはちにち', 'じゅうくにち', 'はつか',
  'にじゅういちにち', 'にじゅうににち', 'にじゅうさんにち', 'にじゅうよっか', 'にじゅうごにち',
  'にじゅうろくにち', 'にじゅうしちにち', 'にじゅうはちにち', 'にじゅうくにち', 'さんじゅうにち', 'さんじゅういちにち',
];
const HOURS = [
  'れいじ', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ',
  'じゅうにじ', 'じゅうさんじ', 'じゅうよじ', 'じゅうごじ', 'じゅうろくじ', 'じゅうしちじ',
  'じゅうはちじ', 'じゅうくじ', 'にじゅうじ', 'にじゅういちじ', 'にじゅうにじ', 'にじゅうさんじ',
];
const MINUTES = ['', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん'];
const TENS = ['', '', 'に', 'さん', 'よん', 'ご'];

function minuteReading(minute) {
  if (minute < 10) return MINUTES[minute];
  const prefix = TENS[Math.floor(minute / 10)];
  return minute % 10 === 0 ? `${prefix}じゅっぷん` : `${prefix}じゅう${MINUTES[minute % 10]}`;
}

export function createDateTimeQuestion(date = new Date(), kind = Math.random() < 0.5 ? 'date' : 'time') {
  if (kind === 'date') {
    const month = date.getMonth();
    const day = date.getDate();
    return {
      question: '今日は何月何日ですか。',
      meaning: '오늘은 몇 월 며칠인가요?',
      answer: `今日は${month + 1}月${day}日です。`,
      reading: `きょうは ${MONTHS[month]} ${DAYS[day - 1]}です。`,
    };
  }
  const hour = date.getHours();
  const minute = date.getMinutes();
  return {
    question: '今、何時何分ですか。',
    meaning: '지금은 몇 시 몇 분인가요?',
    answer: `今は${hour}時${minute ? `${minute}分` : ''}です。`,
    reading: `いまは ${HOURS[hour]}${minute ? ` ${minuteReading(minute)}` : ''}です。`,
  };
}
