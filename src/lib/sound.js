// 효과음은 오디오 파일 없이 Web Audio 오실레이터로 만든다. 파일이 없으니 오프라인 캐시와 첫 재생 지연이 없다.
let context = null;

// iOS 는 사용자가 누른 순간 안에서만 AudioContext 를 만들거나 재개할 수 있으므로 탭 핸들러에서 동기적으로 불러야 한다.
// 백그라운드 복귀·전화 뒤에는 suspended/interrupted 상태가 되므로 running 이 아니면 다시 재개한다.
// 지원하지 않는 브라우저면 null 을 돌려주고, 효과음 실패가 학습 진행을 막지 않게 예외는 삼킨다.
export function prepareSound() {
  try {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) return null;
    context ??= new AudioContext();
    if (context.state !== 'running') context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

const VOLUME = 0.15;

// 종소리처럼 서서히 줄어드는 음 하나. 기본음에 한 옥타브 위 배음을 약하게 섞어 종 느낌을 낸다.
// exponentialRamp 는 0 으로 갈 수 없으므로 0.0001 을 바닥값으로 쓴다.
function chime(ctx, frequency, at, duration) {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(VOLUME, at + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  envelope.connect(ctx.destination);
  for (const [ratio, level] of [[1, 1], [2, 0.25]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency * ratio;
    const partial = ctx.createGain();
    partial.gain.value = level;
    osc.connect(partial).connect(envelope);
    osc.start(at);
    osc.stop(at + duration);
  }
}

// 다음 문제로 넘어갈 때 내는 '띵동'. 미(E5) 뒤에 도(C5)를 조금 겹쳐 낸다.
export function playNextSound() {
  const ctx = prepareSound();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    chime(ctx, 659.25, now, 0.45);
    chime(ctx, 523.25, now + 0.18, 0.55);
  } catch {}
}
