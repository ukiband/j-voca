import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateStats, calculateStreak } from '../stats';

afterEach(() => {
  vi.setSystemTime(vi.getRealSystemTime());
});

function makeLog(date, grade) {
  return { wordId: 1, review_date: `${date}T12:00:00.000Z`, grade };
}

describe('calculateStats', () => {
  it('빈 로그에서 기본값 반환', () => {
    const result = calculateStats([]);
    expect(result).toEqual({
      dailyStats: [],
      streak: 0,
      totalReviews: 0,
      overallAccuracy: 0,
    });
  });

  it('null 입력 처리', () => {
    const result = calculateStats(null);
    expect(result.totalReviews).toBe(0);
  });

  it('일별 그룹핑 정상 동작', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-21', 'easy'),
      makeLog('2026-03-21', 'again'),
      makeLog('2026-03-20', 'hard'),
    ];

    const result = calculateStats(logs);
    expect(result.dailyStats).toHaveLength(2);

    const day21 = result.dailyStats.find(d => d.date === '2026-03-21');
    expect(day21.total).toBe(3);
    expect(day21.good).toBe(1);
    expect(day21.easy).toBe(1);
    expect(day21.again).toBe(1);
    expect(day21.hard).toBe(0);
  });

  it('정확도 계산', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-21', 'easy'),
      makeLog('2026-03-21', 'again'),
      makeLog('2026-03-21', 'hard'),
    ];

    const result = calculateStats(logs);
    // (good + easy) / total = 2/4 = 0.5
    expect(result.overallAccuracy).toBe(0.5);
    expect(result.dailyStats[0].accuracy).toBe(0.5);
  });

  it('전체 리뷰 수 계산', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-20', 'easy'),
      makeLog('2026-03-19', 'hard'),
    ];

    const result = calculateStats(logs);
    expect(result.totalReviews).toBe(3);
  });

  it('일별 통계가 날짜순으로 정렬됨', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-19', 'easy'),
      makeLog('2026-03-20', 'hard'),
    ];

    const result = calculateStats(logs);
    expect(result.dailyStats[0].date).toBe('2026-03-19');
    expect(result.dailyStats[1].date).toBe('2026-03-20');
    expect(result.dailyStats[2].date).toBe('2026-03-21');
  });
});

describe('calculateStreak', () => {
  it('연속 학습일 계산', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const dailyStats = [
      { date: '2026-03-19', total: 5 },
      { date: '2026-03-20', total: 3 },
      { date: '2026-03-21', total: 2 },
    ];

    expect(calculateStreak(dailyStats)).toBe(3);
  });

  it('갭이 있으면 streak 끊김', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const dailyStats = [
      { date: '2026-03-18', total: 5 },
      // 03-19 빠짐
      { date: '2026-03-20', total: 3 },
      { date: '2026-03-21', total: 2 },
    ];

    expect(calculateStreak(dailyStats)).toBe(2);
  });

  it('오늘만 학습한 경우 streak = 1', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const dailyStats = [{ date: '2026-03-21', total: 1 }];
    expect(calculateStreak(dailyStats)).toBe(1);
  });

  it('오늘 학습 기록이 없으면 streak = 0', () => {
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));

    const dailyStats = [
      { date: '2026-03-19', total: 5 },
      { date: '2026-03-20', total: 3 },
    ];

    expect(calculateStreak(dailyStats)).toBe(0);
  });

  it('빈 배열이면 streak = 0', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('null 입력이면 streak = 0', () => {
    expect(calculateStreak(null)).toBe(0);
  });
});
