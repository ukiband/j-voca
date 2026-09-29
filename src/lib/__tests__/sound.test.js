import { afterEach, describe, expect, it, vi } from 'vitest';

// sound.js 는 만든 AudioContext 를 모듈 변수에 캐시하므로, 테스트마다 모듈을 새로 읽어 그 캐시를 비운다.
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

// connect 는 실제 Web Audio 처럼 받은 노드를 돌려줘야 osc.connect(gain).connect(envelope) 체인이 된다.
function node() {
  return {
    connect: vi.fn(target => target),
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine',
    frequency: { value: 0 },
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  };
}

function stubAudioContext(state) {
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => node()),
    createGain: vi.fn(() => node()),
  };
  // 화살표 함수는 new 로 부를 수 없으므로 function 키워드로 만든다.
  const Ctor = vi.fn(function () { return ctx; });
  vi.stubGlobal('AudioContext', Ctor);
  return { ctx, Ctor };
}

describe('효과음', () => {
  it('AudioContext 가 없는 환경에서는 예외 없이 넘어간다', async () => {
    const { playNextSound, prepareSound } = await import('../sound.js');
    expect(prepareSound()).toBeNull();
    expect(() => playNextSound()).not.toThrow();
  });

  it('컨텍스트는 한 번만 만들어 재사용하고 멈춰 있으면 재개한다', async () => {
    const { ctx, Ctor } = stubAudioContext('suspended');
    const { playNextSound } = await import('../sound.js');
    playNextSound();
    playNextSound();
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.createOscillator).toHaveBeenCalled();
  });
});
