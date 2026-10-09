export const LISTENING_SETTINGS_KEY = 'listening-settings';
export const DEFAULT_LISTENING_SETTINGS = { language: 'ja', includeAnswer: false, thinkSeconds: 5 };

export function normalizeListeningSettings(value) {
  return {
    language: value?.language === 'ko' ? 'ko' : 'ja',
    includeAnswer: value?.includeAnswer === true,
    thinkSeconds: typeof value?.thinkSeconds === 'number' && Number.isFinite(value.thinkSeconds)
      ? Math.max(0, Math.min(15, Math.round(value.thinkSeconds)))
      : DEFAULT_LISTENING_SETTINGS.thinkSeconds,
  };
}

export function loadListeningSettings() {
  try { return normalizeListeningSettings(JSON.parse(localStorage.getItem(LISTENING_SETTINGS_KEY))); }
  catch { return { ...DEFAULT_LISTENING_SETTINGS }; }
}

export function saveListeningSettings(settings) {
  try { localStorage.setItem(LISTENING_SETTINGS_KEY, JSON.stringify(normalizeListeningSettings(settings))); }
  catch { /* 재생은 저장소를 사용할 수 없는 브라우저에서도 동작한다. */ }
}

export function listeningText(word, language) {
  return String(language === 'ko' ? word.meaning ?? '' : word.reading || word.word || '').trim();
}

/** One cancellable session. No async boundary before the first utterance (iOS user gesture). */
export function playListening({ queue, startIndex = 0, settings, onChange, speech = globalThis.speechSynthesis }) {
  const options = normalizeListeningSettings(settings);
  let active = true;
  let timer = null;
  let utterance = null;
  let state = { index: startIndex, phase: 'prompt', remaining: 0, answerRevealed: false, playing: true, error: '' };

  function update(patch) {
    state = { ...state, ...patch };
    onChange(state);
  }

  function stop() {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    if (utterance) utterance.onend = utterance.onerror = null;
    utterance = null;
    speech?.cancel();
  }

  function fail(language, code) {
    if (!active) return;
    stop();
    const name = language === 'ko' ? '한국어' : '일본어';
    const error = code === 'unsupported'
      ? '이 브라우저에서는 음성 재생을 지원하지 않습니다.'
      : code === 'empty'
        ? `${name} 읽기 내용이 없습니다. 단어 정보를 확인해 주세요.`
        : `${name} 음성을 재생하지 못했습니다. 기기의 음성 설정을 확인한 뒤 다시 재생해 주세요.`;
    update({ playing: false, phase: 'error', remaining: 0, error });
  }

  function wait(seconds, phase, next) {
    const deadline = Date.now() + seconds * 1000;
    function tick() {
      if (!active) return;
      const left = Math.max(0, deadline - Date.now());
      if (!left) { next(); return; }
      update({ phase, remaining: Math.ceil(left / 1000) });
      timer = setTimeout(tick, Math.min(1000, left));
    }
    tick();
  }

  function say(language, phase, next) {
    if (!active) return;
    const text = listeningText(queue[state.index], language);
    if (!text) { fail(language, 'empty'); return; }
    try {
      const current = new SpeechSynthesisUtterance(text);
      utterance = current; // Keep a strong reference until speech finishes.
      current.lang = language === 'ko' ? 'ko-KR' : 'ja-JP';
      current.rate = language === 'ko' ? 1 : 0.8;
      const voices = speech.getVoices?.() ?? [];
      const voice = voices.find(v => v.lang === current.lang)
        ?? voices.find(v => v.lang?.split(/[-_]/)[0] === language);
      if (voice) current.voice = voice;
      let settled = false;
      current.onend = () => {
        if (!active || settled) return;
        settled = true;
        utterance = null;
        next();
      };
      current.onerror = event => {
        if (!active || settled) return;
        settled = true;
        fail(language, event.error);
      };
      update({ phase, remaining: 0, answerRevealed: phase === 'answer' });
      speech.speak(current);
    } catch { fail(language, 'speech-error'); }
  }

  function advance() {
    if (!active) return;
    if (state.index + 1 >= queue.length) {
      active = false;
      update({ phase: 'complete', playing: false, remaining: 0 });
      return;
    }
    update({ index: state.index + 1, answerRevealed: false });
    prompt();
  }

  function prompt() {
    say(options.language, 'prompt', () => {
      wait(options.thinkSeconds, 'thinking', () => {
        if (!options.includeAnswer) { advance(); return; }
        say(options.language === 'ja' ? 'ko' : 'ja', 'answer', () => {
          if (state.index === queue.length - 1) advance();
          else wait(2, 'gap', advance);
        });
      });
    });
  }

  if (!queue.length || !Number.isInteger(startIndex) || startIndex < 0 || startIndex >= queue.length) {
    active = false;
    update({ phase: 'complete', playing: false });
  } else if (!speech || typeof globalThis.SpeechSynthesisUtterance !== 'function') {
    fail(options.language, 'unsupported');
  } else {
    // cancel only on session boundaries; utterances chain through onend.
    speech.cancel();
    prompt();
  }
  return stop;
}

/** Release even a late-resolving request after stopping; reacquire on foreground return. */
export function keepListeningScreenAwake() {
  let disposed = false, pending = false, sentinel = null;
  async function acquire() {
    if (disposed || document.hidden || pending || (sentinel && !sentinel.released) || !navigator.wakeLock) return;
    pending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (disposed || document.hidden) await lock.release();
      else sentinel = lock;
    } catch { /* Screen wake lock is best effort. */ }
    finally { pending = false; }
  }
  acquire();
  document.addEventListener('visibilitychange', acquire);
  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', acquire);
    sentinel?.release().catch(() => {});
  };
}
