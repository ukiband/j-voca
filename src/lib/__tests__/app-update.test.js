import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentBuild = __BUILD_TIME__;
const nextBuild = new Date(Date.parse(currentBuild) + 60_000).toISOString();
const versionResponse = (build = currentBuild) => ({
  ok: true,
  json: async () => ({ build }),
});
let stopChecks;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/j-voca/');
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(versionResponse()));
});

afterEach(() => {
  stopChecks?.();
  stopChecks = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('앱 업데이트 감지', () => {
  it('이미 최신 버전을 실행 중이면 업데이트를 표시하지 않는다', async () => {
    const updates = await import('../app-update.js');
    await updates.checkForUpdate();
    expect(updates.getHasUpdate()).toBe(false);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/j-voca/version.json?'),
      expect.objectContaining({ cache: 'no-store' }));
  });

  it('앱을 계속 켜두어도 주기적으로 확인하지 않는다', async () => {
    const updates = await import('../app-update.js');
    const listener = vi.fn();
    updates.subscribeToUpdate(listener);
    stopChecks = updates.startUpdateChecks();
    await updates.checkForUpdate();
    fetch.mockResolvedValue(versionResponse(nextBuild));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(updates.getHasUpdate()).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('홈에서 다시 확인하면 즉시 감지하고, 나중에 홈을 열어도 감지 결과가 남는다', async () => {
    const updates = await import('../app-update.js');
    await updates.checkForUpdate();
    fetch.mockResolvedValue(versionResponse(nextBuild));
    await updates.checkForUpdate();
    const listener = vi.fn();
    const unsubscribe = updates.subscribeToUpdate(listener);
    expect(updates.getHasUpdate()).toBe(true);
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it('백그라운드에서는 확인하지 않고 앱으로 돌아오면 다시 확인한다', async () => {
    const updates = await import('../app-update.js');
    stopChecks = updates.startUpdateChecks();
    await updates.checkForUpdate();
    document.visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    fetch.mockResolvedValue(versionResponse(nextBuild));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetch).toHaveBeenCalledTimes(1);

    document.visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await updates.checkForUpdate();
    expect(updates.getHasUpdate()).toBe(true);
  });

  it.each(['pageshow', 'focus', 'online'])('%s 시 새 배포를 다시 확인한다', async event => {
    const updates = await import('../app-update.js');
    stopChecks = updates.startUpdateChecks();
    await updates.checkForUpdate();
    fetch.mockResolvedValue(versionResponse(nextBuild));
    window.dispatchEvent(new Event(event));
    await updates.checkForUpdate();
    expect(updates.getHasUpdate()).toBe(true);
  });

  it('동시에 여러 번 확인해도 요청과 알림을 중복하지 않는다', async () => {
    const updates = await import('../app-update.js');
    fetch.mockResolvedValue(versionResponse(nextBuild));
    const listener = vi.fn();
    updates.subscribeToUpdate(listener);
    await Promise.all([updates.checkForUpdate(), updates.checkForUpdate(), updates.checkForUpdate()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['서버 오류', { ok: false, json: async () => ({ build: nextBuild }) }],
    ['빈 버전', versionResponse('')],
    ['잘못된 버전 형식', versionResponse(123)],
    ['잘못된 JSON', { ok: true, json: async () => { throw new Error('invalid JSON'); } }],
  ])('%s 응답은 무시하고 이후 정상 응답으로 다시 확인한다', async (_name, response) => {
    const updates = await import('../app-update.js');
    fetch.mockResolvedValueOnce(response);
    await updates.checkForUpdate();
    expect(updates.getHasUpdate()).toBe(false);
    fetch.mockResolvedValue(versionResponse(nextBuild));
    await updates.checkForUpdate();
    expect(updates.getHasUpdate()).toBe(true);
  });

  it('끊어진 요청이 다음 업데이트 확인을 계속 막지 않는다', async () => {
    const updates = await import('../app-update.js');
    fetch.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = updates.checkForUpdate();
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(updates.getHasUpdate()).toBe(false);
    fetch.mockResolvedValue(versionResponse(nextBuild));
    await updates.checkForUpdate();
    expect(updates.getHasUpdate()).toBe(true);
  });

  it('종료하면 화면 복귀 리스너를 제거한다', async () => {
    const updates = await import('../app-update.js');
    const stop = updates.startUpdateChecks();
    await updates.checkForUpdate();
    stop();
    for (const event of ['pageshow', 'focus', 'online']) window.dispatchEvent(new Event(event));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('개발 서버에서는 배포 버전을 확인하지 않는다', async () => {
    vi.stubEnv('PROD', false);
    const updates = await import('../app-update.js');
    stopChecks = updates.startUpdateChecks();
    await updates.checkForUpdate();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).not.toHaveBeenCalled();
  });
});
