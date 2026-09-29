// 효과음은 오디오 파일 없이 Web Audio 오실레이터로 만든다. 파일이 없으니 오프라인 캐시와 첫 재생 지연이 없다.
let context = null;

// iOS 는 사용자가 누른 순간 안에서만 AudioContext 를 만들거나 재개할 수 있으므로 탭 핸들러에서 동기적으로 불러야 한다.
// 백그라운드 복귀·전화 뒤에는 suspended/interrupted 상태가 되므로 running 이 아니면 다시 재개한다.
export function prepareSound() {
  try {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context) {
      // 스포티파이처럼 무음 스위치와 상관없이 음량 버튼으로만 조절되게 한다(iOS 17+). 대신 다른 앱의 음악은 멈춘다.
      try { navigator.audioSession.type = 'playback'; } catch {}
      context = new AudioContext();
    }
    if (context.state !== 'running') context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

const VOLUME = 0.15;
// 여운이 긴 종의 비정수 배음 [배율, 세기, 감쇠 시간(초)]. 윗배음이 먼저 사라져 종을 친 느낌이 난다.
const PARTIALS = [[1, 1, 0.9], [2.76, 0.35, 0.25], [5.4, 0.15, 0.08]];
// 솔→높은 도(G5→C6)를 0.2초 간격으로 치는 '띵~동' [주파수(Hz), 시작 시점(초)]
const NOTES = [[784, 0], [1046.5, 0.2]];

// 배음마다 오실레이터 하나. exponentialRamp 는 0 으로 갈 수 없으므로 0.0001 을 바닥값으로 쓴다.
function strike(ctx, frequency, at) {
  for (const [ratio, level, decay] of PARTIALS) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(VOLUME * level, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    // 게인이 바닥값에 닿은 뒤에 멈춰야 끊기는 소리가 안 난다.
    osc.stop(at + decay + 0.02);
  }
}

export function playNextSound() {
  const ctx = prepareSound();
  if (!ctx) return;
  try {
    // 오디오 스레드 기준으로 이미 지난 시각에 예약되어 첫 음의 어택이 잘리지 않도록 20ms 앞을 잡는다.
    const start = ctx.currentTime + 0.02;
    for (const [frequency, offset] of NOTES) strike(ctx, frequency, start + offset);
  } catch {}
}
