import { afterEach, describe, expect, it, vi } from 'vitest';
import { playKanjiStrokes, strokeAnimationFrame, strokeAnimationDuration } from '../kanji-animation';

afterEach(() => vi.unstubAllGlobals());

describe('한 번 재생하는 일본어 획순', () => {
  it('획 사이에는 이전 획을 유지하고, 마지막 획 뒤에는 완성된 글자를 유지한다', () => {
    expect(strokeAnimationFrame(0, 9).progress).toEqual(Array(9).fill(0));
    const gap = strokeAnimationFrame(1000, 9);
    expect(gap.progress[0]).toBe(1);
    expect(gap.progress[1]).toBe(0);
    expect(gap.finished).toBe(false);
    const duration = strokeAnimationDuration(9);
    for (const time of [duration, duration + 2000, duration * 3]) {
      expect(strokeAnimationFrame(time, 9)).toEqual({ progress: Array(9).fill(1), current: 9, finished: true });
    }
  });

  it('완료하면 프레임을 더 예약하지 않고, 다시 보기는 처음부터 시작하며 닫으면 취소된다', () => {
    let now = 0, id = 0;
    const pending = new Map();
    const listeners = new Map();
    vi.stubGlobal('requestAnimationFrame', callback => { pending.set(++id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', handle => pending.delete(handle));
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('document', { hidden: false, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); } });
    const paths = Array.from({ length: 9 }, () => ({ style: {}, getTotalLength: () => 10, getPointAtLength: () => ({ x: 1, y: 1 }) }));
    const options = { paths, pen: { setAttribute: vi.fn() }, onProgress: vi.fn(), onComplete: vi.fn() };
    const cleanup = playKanjiStrokes(options);
    for (let n = 0; n < 150 && pending.size; n++) {
      const callbacks = [...pending.values()]; pending.clear(); now += 80;
      callbacks.forEach(fn => fn(now));
    }
    expect(pending.size).toBe(0);
    expect(options.onComplete).toHaveBeenCalledTimes(1);
    expect(paths.every(path => path.style.strokeDashoffset === '0')).toBe(true);
    listeners.get('visibilitychange')();
    expect(pending.size).toBe(0);
    cleanup();
    const cleanupReplay = playKanjiStrokes(options);
    expect(paths.every(path => path.style.visibility === 'hidden')).toBe(true);
    expect(pending.size).toBe(1);
    cleanupReplay();
    expect(pending.size).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
