import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateStats } from '../stats';

afterEach(() => {
  vi.setSystemTime(vi.getRealSystemTime());
});

/**
 * 로컬 타임존 정오를 ISO 문자열로 생성한다.
 * getLocalDateString(new Date(review_date))가 항상 기대 날짜를 반환하도록 보장.
 */
function makeLog(date, grade) {
  const [y, m, d] = date.split('-').map(Number);
  const localNoon = new Date(y, m - 1, d, 12, 0, 0);
  return { wordId: 1, review_date: localNoon.toISOString(), grade };
}

/** vi.setSystemTime에 로컬 정오를 설정하는 헬퍼 */
function setLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  vi.setSystemTime(new Date(y, m - 1, d, 12, 0, 0));
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
    setLocalDate('2026-03-21');

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-21', 'hard'),
      makeLog('2026-03-21', 'again'),
      makeLog('2026-03-20', 'hard'),
    ];

    const result = calculateStats(logs);
    expect(result.dailyStats).toHaveLength(2);

    const day21 = result.dailyStats.find(d => d.date === '2026-03-21');
    expect(day21.total).toBe(3);
    expect(day21.good).toBe(1);
    expect(day21.hard).toBe(1);
    expect(day21.again).toBe(1);
  });

  it('정확도 계산', () => {
    setLocalDate('2026-03-21');

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-21', 'again'),
      makeLog('2026-03-21', 'hard'),
    ];

    const result = calculateStats(logs);
    // good / total = 2/4 = 0.5
    expect(result.overallAccuracy).toBe(0.5);
    expect(result.dailyStats[0].accuracy).toBe(0.5);
  });

  it('전체 리뷰 수 계산', () => {
    setLocalDate('2026-03-21');

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-20', 'hard'),
      makeLog('2026-03-19', 'again'),
    ];

    const result = calculateStats(logs);
    expect(result.totalReviews).toBe(3);
  });

  it('일별 통계가 날짜순으로 정렬됨', () => {
    setLocalDate('2026-03-21');

    const logs = [
      makeLog('2026-03-21', 'good'),
      makeLog('2026-03-19', 'again'),
      makeLog('2026-03-20', 'hard'),
    ];

    const result = calculateStats(logs);
    expect(result.dailyStats[0].date).toBe('2026-03-19');
    expect(result.dailyStats[1].date).toBe('2026-03-20');
    expect(result.dailyStats[2].date).toBe('2026-03-21');
  });
});

describe('streak (calculateStats 경유)', () => {
  it('연속 학습일 계산', () => {
    setLocalDate('2026-03-21');

    const logs = [
      makeLog('2026-03-19', 'good'),
      makeLog('2026-03-20', 'good'),
      makeLog('2026-03-21', 'good'),
    ];

    expect(calculateStats(logs).streak).toBe(3);
  });

  it('갭이 있으면 streak 끊김', () => {
    setLocalDate('2026-03-21');

    const logs = [
      makeLog('2026-03-18', 'good'),
      // 03-19 빠짐
      makeLog('2026-03-20', 'good'),
      makeLog('2026-03-21', 'good'),
    ];

    expect(calculateStats(logs).streak).toBe(2);
  });

  it('오늘만 학습한 경우 streak = 1', () => {
    setLocalDate('2026-03-21');

    const logs = [makeLog('2026-03-21', 'good')];
    expect(calculateStats(logs).streak).toBe(1);
  });

  it('오늘 학습 기록이 없으면 streak = 0', () => {
    setLocalDate('2026-03-21');

    const logs = [
      makeLog('2026-03-19', 'good'),
      makeLog('2026-03-20', 'good'),
    ];

    expect(calculateStats(logs).streak).toBe(0);
  });

  it('빈 로그이면 streak = 0', () => {
    expect(calculateStats([]).streak).toBe(0);
  });

  it('null 입력이면 streak = 0', () => {
    expect(calculateStats(null).streak).toBe(0);
  });
});
