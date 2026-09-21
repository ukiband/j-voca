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

// 읽기표. 날짜·시간은 숫자 읽기가 불규칙해서(ついたち·はつか·しがつ·くがつ·よじ·いっぷん 등) 표로 둔다.
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
const HOURS = ['れいじ', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ', 'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ'];
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
      questionReading: 'きょうは なんがつ なんにちですか。',
      answer: `今日は${month + 1}月${day}日です。`,
      answerReading: `きょうは ${MONTHS[month]} ${DAYS[day - 1]}です。`,
    };
  }
  // 회화에서 쓰는 12시간제. 자정은 午前0時, 정오는 午後0時로 적는다(NHK 표기 기준).
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour < 12 ? '午前' : '午後';
  const periodReading = hour < 12 ? 'ごぜん' : 'ごご';
  return {
    question: '今、何時何分ですか。',
    questionReading: 'いま、なんじ なんぷんですか。',
    answer: `今は${period}${hour % 12}時${minute ? `${minute}分` : ''}です。`,
    answerReading: `いまは ${periodReading} ${HOURS[hour % 12]}${minute ? ` ${minuteReading(minute)}` : ''}です。`,
  };
}
