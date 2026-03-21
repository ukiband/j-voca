import { getTodayString } from './dates';

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
    // review_date는 ISO 문자열이므로 YYYY-MM-DD 부분만 추출
    const date = log.review_date.split('T')[0];
    if (!byDate[date]) {
      byDate[date] = { date, total: 0, again: 0, hard: 0, good: 0, easy: 0 };
    }
    byDate[date].total++;
    byDate[date][log.grade]++;
  }

  // 각 일별 정확도 계산
  const dailyStats = Object.values(byDate)
    .map(day => ({
      ...day,
      accuracy: day.total > 0 ? (day.good + day.easy) / day.total : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalReviews = reviewLogs.length;
  const totalGoodEasy = reviewLogs.filter(l => l.grade === 'good' || l.grade === 'easy').length;
  const overallAccuracy = totalReviews > 0 ? totalGoodEasy / totalReviews : 0;

  const streak = calculateStreak(dailyStats);

  return { dailyStats, streak, totalReviews, overallAccuracy };
}

/**
 * 오늘부터 거슬러 올라가며 연속 학습일 수를 계산한다.
 * @param {Array} dailyStats - date 필드가 있는 일별 통계 배열 (정렬 불필요)
 * @returns {number} 연속 학습일 수
 */
export function calculateStreak(dailyStats) {
  if (!dailyStats || dailyStats.length === 0) return 0;

  // 학습한 날짜를 Set으로 만들어 빠르게 조회
  const datesWithReviews = new Set(
    dailyStats.filter(d => d.total > 0).map(d => d.date),
  );

  const today = getTodayString();

  // 오늘 학습 기록이 없으면 streak = 0
  if (!datesWithReviews.has(today)) return 0;

  let streak = 0;
  let current = new Date(today + 'T00:00:00Z');

  while (true) {
    const dateStr = current.toISOString().split('T')[0];
    if (!datesWithReviews.has(dateStr)) break;
    streak++;
    // 하루 전으로 이동
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return streak;
}
