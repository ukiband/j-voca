import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDateTimeQuestion, dismissDateTimeQuestion, getDateTimePopupEnabled, setDateTimePopupEnabled, shouldShowDateTimeQuestion } from '../date-time-practice';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('날짜·시간 질문', () => {
  it('자정 직후에도 기기의 날짜를 사용한다', () => {
    const result = createDateTimeQuestion(new Date(2026, 0, 1, 0, 5), 'date');
    expect(result.answer).toBe('今日は1月1日です。');
  });

  it('시각은 24시간제로 표시하고 정각에는 분을 생략한다', () => {
    expect(createDateTimeQuestion(new Date(2026, 8, 22, 23, 59), 'time').answer).toBe('今は23時59分です。');
    expect(createDateTimeQuestion(new Date(2026, 8, 23, 0, 0), 'time').answer).toBe('今は0時です。');
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
