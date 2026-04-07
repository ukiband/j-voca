import { shuffle } from './shuffle';

const DELAY_MS = 5000; // 일본어 발음 후 한국어 뜻까지 대기 시간
const NEXT_WORD_DELAY_MS = 2000; // 한국어 뜻 발음 후 다음 단어까지 대기

// iOS Safari에서 async/await + cancel() 반복 시 유저 제스처 컨텍스트를 벗어나
// speechSynthesis가 차단되는 문제가 있다. cancel()은 세션 시작 시 최초 1회만 호출하고,
// 이후에는 onend 콜백 체인으로 다음 발화를 연결한다.

function speakJapanese(text) {
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.8;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

function speakKorean(text) {
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.9;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

/**
 * 듣기 복습 세션을 생성한다.
 * 일본어 발음 → 5초 대기 → 한국어 뜻 발음 → 2초 대기 → 다음 단어 (무한 반복)
 *
 * @param {Array} words - 단어 배열 [{word, reading, meaning, ...}]
 * @param {number} durationMin - 타이머 시간(분)
 * @param {object} callbacks - { onWordChange, onPhaseChange, onFinish }
 * @returns {{ stop: Function }} - stop()으로 세션 중단
 */
export function createListeningSession(words, durationMin, callbacks) {
  if (!words || words.length === 0) return { stop() {} };

  let stopped = false;
  let wakeLock = null;

  const endTime = Date.now() + durationMin * 60 * 1000;

  // Wake Lock 획득 — 화면 꺼짐 방지
  try {
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').then(lock => {
        wakeLock = lock;
      }).catch(() => {});
    }
  } catch {}

  // 최초 1회만 cancel() 호출하여 이전 발화 정리
  speechSynthesis.cancel();

  function stop() {
    stopped = true;
    speechSynthesis.cancel();
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  function shouldStop() {
    return stopped || Date.now() >= endTime;
  }

  // 한 바퀴(셔플된 단어 전체)를 순차 재생
  async function playRound() {
    const queue = shuffle(words);

    for (let i = 0; i < queue.length; i++) {
      if (shouldStop()) break;

      const word = queue[i];
      callbacks.onWordChange?.(word, i);

      // 일본어 발음 재생
      callbacks.onPhaseChange?.('japanese');
      await speakJapanese(word.word);
      if (shouldStop()) break;

      // 대기 (회상 시간)
      callbacks.onPhaseChange?.('waiting');
      await delay(DELAY_MS);
      if (shouldStop()) break;

      // 한국어 뜻 발음 재생
      callbacks.onPhaseChange?.('korean');
      await speakKorean(word.meaning);
      if (shouldStop()) break;

      // 다음 단어로 넘어가기 전 짧은 대기
      callbacks.onPhaseChange?.('next');
      await delay(NEXT_WORD_DELAY_MS);
    }
  }

  // 타이머 종료까지 라운드 반복
  async function run() {
    while (!stopped && Date.now() < endTime) {
      await playRound();
    }
    stop();
    callbacks.onFinish?.();
  }

  run();

  return { stop };
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
