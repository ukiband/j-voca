import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDateTimeQuestion, dismissDateTimeQuestion, getDateTimePopupEnabled, setDateTimePopupEnabled, shouldShowDateTimeQuestion } from '../date-time-practice';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('날짜·시간 질문', () => {
  it.each([
    [4, 1, 'しがつ ついたち'], [7, 7, 'しちがつ なのか'], [9, 9, 'くがつ ここのか'],
    [10, 10, 'じゅうがつ とおか'], [11, 14, 'じゅういちがつ じゅうよっか'],
    [12, 20, 'じゅうにがつ はつか'], [1, 24, 'いちがつ にじゅうよっか'],
    [2, 17, 'にがつ じゅうしちにち'], [3, 19, 'さんがつ じゅうくにち'],
    [6, 29, 'ろくがつ にじゅうくにち'], [8, 31, 'はちがつ さんじゅういちにち'],
  ])('%i월 %i일은 숫자까지 히라가나로 읽는다', (month, day, reading) => {
    const result = createDateTimeQuestion(new Date(2026, month - 1, day, 0, 5), 'date');
    expect(result.question).toBe('今日は何月何日ですか。');
    expect(result.questionReading).toBe('きょうは なんがつ なんにちですか。');
    expect(result.answer).toBe(`今日は${month}月${day}日です。`);
    expect(result.answerReading).toBe(`きょうは ${reading}です。`);
  });

  it.each([
    [0, 0, '午前0時', 'ごぜん れいじ'], [12, 0, '午後0時', 'ごご れいじ'],
    [4, 1, '午前4時1分', 'ごぜん よじ いっぷん'], [7, 2, '午前7時2分', 'ごぜん しちじ にふん'],
    [9, 3, '午前9時3分', 'ごぜん くじ さんぷん'], [14, 4, '午後2時4分', 'ごご にじ よんぷん'],
    [16, 6, '午後4時6分', 'ごご よじ ろっぷん'], [17, 7, '午後5時7分', 'ごご ごじ ななふん'],
    [19, 8, '午後7時8分', 'ごご しちじ はっぷん'], [21, 9, '午後9時9分', 'ごご くじ きゅうふん'],
    [20, 10, '午後8時10分', 'ごご はちじ じゅっぷん'], [22, 30, '午後10時30分', 'ごご じゅうじ さんじゅっぷん'],
    [23, 59, '午後11時59分', 'ごご じゅういちじ ごじゅうきゅうふん'], [11, 24, '午前11時24分', 'ごぜん じゅういちじ にじゅうよんぷん'],
  ])('%i시 %i분은 午前·午後 12시간제로 쓰고 숫자까지 히라가나로 읽는다', (hour, minute, answer, reading) => {
    const result = createDateTimeQuestion(new Date(2026, 8, 22, hour, minute), 'time');
    expect(result.questionReading).toBe('いま、なんじ なんぷんですか。');
    expect(result.answer).toBe(`今は${answer}です。`);
    expect(result.answerReading).toBe(`いまは ${reading}です。`);
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
