import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDateTimeQuestion, dismissDateTimeQuestion, getDateTimePopupEnabled, setDateTimePopupEnabled, shouldShowDateTimeQuestion } from '../date-time-practice';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('날짜·시간 질문', () => {
  it.each([
    [4, 1, 'しがつ ついたち'], [7, 7, 'しちがつ なのか'], [9, 9, 'くがつ ここのか'],
    [10, 10, 'じゅうがつ とおか'], [11, 14, 'じゅういちがつ じゅうよっか'],
    [12, 20, 'じゅうにがつ はつか'], [1, 24, 'いちがつ にじゅうよっか'],
    [2, 17, 'にがつ じゅうしちにち'], [3, 19, 'さんがつ じゅうくにち'],
    [5, 27, 'ごがつ にじゅうしちにち'], [6, 29, 'ろくがつ にじゅうくにち'],
    [8, 31, 'はちがつ さんじゅういちにち'],
  ])('%i월 %i일의 예외 읽기', (month, day, reading) => {
    const result = createDateTimeQuestion(new Date(2026, month - 1, day, 0, 5), 'date');
    expect(result.answer).toBe(`今日は${month}月${day}日です。`);
    expect(result.reading).toBe(`きょうは ${reading}です。`);
  });

  it.each([
    [0, 0, '0時', 'れいじ'], [4, 1, '4時1分', 'よじ いっぷん'],
    [7, 2, '7時2分', 'しちじ にふん'], [9, 3, '9時3分', 'くじ さんぷん'],
    [12, 4, '12時4分', 'じゅうにじ よんぷん'], [14, 6, '14時6分', 'じゅうよじ ろっぷん'],
    [17, 7, '17時7分', 'じゅうしちじ ななふん'], [19, 8, '19時8分', 'じゅうくじ はっぷん'],
    [20, 10, '20時10分', 'にじゅうじ じゅっぷん'], [21, 20, '21時20分', 'にじゅういちじ にじゅっぷん'],
    [22, 30, '22時30分', 'にじゅうにじ さんじゅっぷん'], [23, 40, '23時40分', 'にじゅうさんじ よんじゅっぷん'],
    [1, 50, '1時50分', 'いちじ ごじゅっぷん'], [2, 59, '2時59分', 'にじ ごじゅうきゅうふん'],
    [3, 24, '3時24分', 'さんじ にじゅうよんぷん'], [5, 35, '5時35分', 'ごじ さんじゅうごふん'],
  ])('%i시 %i분의 읽기', (hour, minute, answer, reading) => {
    const result = createDateTimeQuestion(new Date(2026, 8, 22, hour, minute), 'time');
    expect(result.answer).toBe(`今は${answer}です。`);
    expect(result.reading).toBe(`いまは ${reading}です。`);
  });

  it('처음에는 표시하고, 닫은 시각부터 정확히 한 시간 동안 숨기며 설정을 껐다 켜도 시간을 유지한다', () => {
    const values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    const closedAt = new Date(2026, 8, 22, 9, 30).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(closedAt);
    expect(getDateTimePopupEnabled()).toBe(true);
    expect(shouldShowDateTimeQuestion()).toBe(true);
    dismissDateTimeQuestion();
    expect(shouldShowDateTimeQuestion(closedAt + 3_599_999)).toBe(false);
    expect(shouldShowDateTimeQuestion(closedAt + 3_600_000)).toBe(true);
    setDateTimePopupEnabled(false);
    expect(shouldShowDateTimeQuestion(closedAt + 7_200_000)).toBe(false);
    setDateTimePopupEnabled(true);
    expect(shouldShowDateTimeQuestion(closedAt + 1_000)).toBe(false);
  });
});
