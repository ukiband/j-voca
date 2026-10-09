import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LISTENING_SETTINGS, LISTENING_SETTINGS_KEY, keepListeningScreenAwake, loadListeningSettings, normalizeListeningSettings, playListening, saveListeningSettings } from '../listening';

const queue = [
  { word: '待つ', reading: 'まつ', meaning: '기다리다' },
  { word: '読む', reading: 'よむ', meaning: '읽다' },
];
let speech, spoken, onChange;

beforeEach(() => {
  vi.useFakeTimers();
  spoken = [];
  speech = { cancel: vi.fn(), speak: vi.fn(u => spoken.push(u)), getVoices: () => [{ lang: 'ja-JP' }, { lang: 'ko-KR' }] };
  onChange = vi.fn();
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const state = () => onChange.mock.calls.at(-1)[0];
const start = (settings, extra = {}) => playListening({ queue, settings, speech, onChange, ...extra });

describe('듣기 언어와 정답 조합', () => {
  it.each([
    ['ja', false, 'まつ', 'ja-JP', 'よむ'],
    ['ko', false, '기다리다', 'ko-KR', '읽다'],
    ['ja', true, 'まつ', 'ja-JP', '기다리다'],
    ['ko', true, '기다리다', 'ko-KR', 'まつ'],
  ])('%s / 정답 %s: 발음 완료 후 선택한 시간만큼 기다린다', (language, includeAnswer, question, locale, nextText) => {
    start({ language, includeAnswer, thinkSeconds: 7 });
    expect(spoken[0].text).toBe(question);
    expect(spoken[0].lang).toBe(locale);
    expect(spoken[0].voice.lang).toBe(locale);
    vi.advanceTimersByTime(9000); // No countdown until actual speech completion.
    expect(spoken).toHaveLength(1);
    spoken[0].onend();
    expect(state()).toMatchObject({ phase: 'thinking', remaining: 7, answerRevealed: false });
    vi.advanceTimersByTime(6999);
    expect(spoken).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(spoken[1].text).toBe(nextText);
    expect(state().answerRevealed).toBe(includeAnswer);
    if (includeAnswer) {
      expect(spoken[1].lang).toBe(locale === 'ja-JP' ? 'ko-KR' : 'ja-JP');
      spoken[1].onend();
      vi.advanceTimersByTime(2000);
      expect(spoken[2].text).toBe(language === 'ja' ? 'よむ' : '읽다');
      expect(state()).toMatchObject({ index: 1, phase: 'prompt', answerRevealed: false });
    }
    expect(speech.cancel).toHaveBeenCalledTimes(1);
  });

  it('0초면 정답을 바로 읽고 마지막 정답 이후 완료한다', () => {
    start({ language: 'ko', includeAnswer: true, thinkSeconds: 0 }, { queue: queue.slice(0, 1) });
    spoken[0].onend();
    expect(spoken[1].text).toBe('まつ');
    spoken[1].onend();
    expect(state()).toMatchObject({ phase: 'complete', playing: false, answerRevealed: true });
    vi.runAllTimers();
    expect(spoken).toHaveLength(2);
  });

  it('정답 없이 마지막 단어를 들은 뒤에도 생각할 시간을 준다', () => {
    start({ language: 'ja', includeAnswer: false, thinkSeconds: 3 }, { queue: queue.slice(0, 1) });
    spoken[0].onend();
    vi.advanceTimersByTime(2999);
    expect(state().playing).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state()).toMatchObject({ phase: 'complete', playing: false, answerRevealed: false });
  });

  it('대기 중 중지 후 재시작·다음 이동 시 이전 세션의 정답이나 콜백이 끼어들지 않는다', () => {
    const options = { language: 'ko', includeAnswer: true, thinkSeconds: 5 };
    const stop = start(options);
    const staleEnd = spoken[0].onend;
    const staleError = spoken[0].onerror;
    staleEnd();
    vi.advanceTimersByTime(2000);
    stop();
    const nextStop = start(options, { startIndex: 1 });
    const changeCount = onChange.mock.calls.length;
    staleEnd();
    staleError({ error: 'interrupted' });
    vi.advanceTimersByTime(10000);
    expect(spoken.map(u => u.text)).toEqual(['기다리다', '읽다']);
    expect(onChange).toHaveBeenCalledTimes(changeCount);
    const nextEnd = spoken[1].onend;
    nextStop();
    nextEnd();
    vi.runAllTimers();
    expect(spoken).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('음성 도중 닫으면 늦게 도착한 완료·오류 이벤트를 무시한다', () => {
    const stop = start({ includeAnswer: true, thinkSeconds: 1 });
    const staleEnd = spoken[0].onend, staleError = spoken[0].onerror;
    stop();
    stop();
    const count = onChange.mock.calls.length;
    staleEnd(); staleError({ error: 'canceled' });
    vi.runAllTimers();
    expect(spoken).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(count);
    expect(speech.cancel).toHaveBeenCalledTimes(2);
  });

  it('동일 발음의 완료 이벤트가 중복돼도 정답은 한 번만 재생한다', () => {
    start({ includeAnswer: true, thinkSeconds: 1 });
    const end = spoken[0].onend;
    end(); end();
    vi.advanceTimersByTime(1000);
    expect(spoken.map(u => u.text)).toEqual(['まつ', '기다리다']);
  });

  it('음성 오류는 조용히 단어를 건너뛰지 않고 중단·재시도 상태로 표시한다', () => {
    start({ language: 'ko', includeAnswer: true });
    spoken[0].onerror({ error: 'language-unavailable' });
    expect(state()).toMatchObject({ playing: false, phase: 'error', answerRevealed: false });
    expect(state().error).toContain('한국어');
    vi.runAllTimers();
    expect(spoken).toHaveLength(1);
  });

  it('미지원 브라우저와 빈 재생 목록도 안전하게 처리한다', () => {
    playListening({ queue, settings: {}, speech: null, onChange });
    expect(state()).toMatchObject({ playing: false, phase: 'error' });
    start({}, { queue: [] });
    expect(state()).toMatchObject({ playing: false, phase: 'complete' });
    expect(spoken).toHaveLength(0);
  });
});

describe('듣기 설정 저장', () => {
  it('새로 열 때 언어·정답·생각할 시간을 복원하고 잘못된 값은 제한한다', () => {
    const values = new Map();
    vi.stubGlobal('localStorage', { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
    expect(loadListeningSettings()).toEqual(DEFAULT_LISTENING_SETTINGS);
    const options = { language: 'ko', includeAnswer: true, thinkSeconds: 11 };
    saveListeningSettings(options);
    expect(loadListeningSettings()).toEqual(options);
    values.set(LISTENING_SETTINGS_KEY, '{broken');
    expect(loadListeningSettings()).toEqual(DEFAULT_LISTENING_SETTINGS);
    expect(normalizeListeningSettings({ language: 'en', includeAnswer: 'true', thinkSeconds: -20 })).toEqual({ language: 'ja', includeAnswer: false, thinkSeconds: 0 });
    expect(normalizeListeningSettings({ thinkSeconds: 100 }).thinkSeconds).toBe(15);
    expect(normalizeListeningSettings({ thinkSeconds: NaN }).thinkSeconds).toBe(5);
  });

  it('저장소 접근이 차단돼도 재생 옵션은 기본값으로 동작한다', () => {
    vi.stubGlobal('localStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
    expect(loadListeningSettings()).toEqual(DEFAULT_LISTENING_SETTINGS);
    expect(() => saveListeningSettings({})).not.toThrow();
  });
});

describe('화면 꺼짐 방지 정리', () => {
  it('정지 후 늦게 도착한 잠금도 해제하고 이벤트 리스너를 남기지 않는다', async () => {
    let resolve;
    const lock = { release: vi.fn(async () => {}) };
    const document = { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('document', document);
    vi.stubGlobal('navigator', { wakeLock: { request: () => new Promise(done => { resolve = done; }) } });
    const stop = keepListeningScreenAwake();
    stop();
    resolve(lock);
    await Promise.resolve();
    expect(lock.release).toHaveBeenCalledTimes(1);
    expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', document.addEventListener.mock.calls[0][1]);
  });

  it('화면 복귀 때 해제된 잠금을 다시 얻고 종료 시 정리한다', async () => {
    const first = { released: false, release: vi.fn(async () => {}) };
    const second = { released: false, release: vi.fn(async () => {}) };
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const document = { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('document', document);
    vi.stubGlobal('navigator', { wakeLock: { request } });
    const stop = keepListeningScreenAwake();
    await Promise.resolve();
    const visible = document.addEventListener.mock.calls[0][1];
    document.hidden = true;
    first.released = true;
    visible();
    expect(request).toHaveBeenCalledTimes(1);
    document.hidden = false;
    await visible();
    expect(request).toHaveBeenCalledTimes(2);
    stop();
    expect(second.release).toHaveBeenCalledTimes(1);
  });
});
