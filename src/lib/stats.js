import { getLocalDateString } from './date-utils';

/**
 * 리뷰 로그를 일별로 그룹핑하고 통계를 계산한다.
 * @param {Array} reviewLogs - { wordId, review_date, grade } 배열
 * @returns {{ dailyStats: Array, streak: number, totalReviews: number, overallAccuracy: number }}
 */
export function calculateStats(reviewLogs) {
  if (!reviewLogs || reviewLogs.length === 0) {
    return { dailyStats: [], streak: 0, totalReviews: 0, overallAccuracy: 0 };
  }

  // 날짜별 그룹핑
  const byDate = {};
  for (const log of reviewLogs) {
    // review_date는 ISO 문자열이므로 로컬 타임존 기준 날짜로 변환
    const date = getLocalDateString(new Date(log.review_date));
    if (!byDate[date]) {
      byDate[date] = { date, total: 0, again: 0, hard: 0, good: 0 };
    }
    byDate[date].total++;
    byDate[date][log.grade]++;
  }

  // 각 일별 정확도 계산
  const dailyStats = Object.values(byDate)
    .map(day => ({
      ...day,
      accuracy: day.total > 0 ? day.good / day.total : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalReviews = reviewLogs.length;
  const totalGood = reviewLogs.filter(l => l.grade === 'good').length;
  const overallAccuracy = totalReviews > 0 ? totalGood / totalReviews : 0;

  const streak = calculateStreak(dailyStats);

  return { dailyStats, streak, totalReviews, overallAccuracy };
}

/**
 * 오늘부터 거슬러 올라가며 연속 학습일 수를 계산한다.
 * @param {Array} dailyStats - date 필드가 있는 일별 통계 배열 (정렬 불필요)
 * @returns {number} 연속 학습일 수
 */
function calculateStreak(dailyStats) {
  if (!dailyStats || dailyStats.length === 0) return 0;

  // 학습한 날짜를 Set으로 만들어 빠르게 조회
  const datesWithReviews = new Set(
    dailyStats.filter(d => d.total > 0).map(d => d.date),
  );

  const today = getLocalDateString();

  // 오늘 학습 기록이 없으면 streak = 0
  if (!datesWithReviews.has(today)) return 0;

  let streak = 0;
  // 로컬 자정 기준 Date 객체로 날짜를 순회
  const [y, m, d] = today.split('-').map(Number);
  let current = new Date(y, m - 1, d);

  while (true) {
    const dateStr = getLocalDateString(current);
    if (!datesWithReviews.has(dateStr)) break;
    streak++;
    // 하루 전으로 이동 (로컬 기준)
    current.setDate(current.getDate() - 1);
  }

  return streak;
}
