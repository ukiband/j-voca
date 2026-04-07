// 보이스 캐시 — getVoices()는 첫 호출 시 빈 배열을 반환할 수 있어 voiceschanged 이벤트로 갱신한다.
let cachedVoices = null;

function loadVoices() {
  if (typeof speechSynthesis === 'undefined') return [];
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  cachedVoices = speechSynthesis.getVoices();
  return cachedVoices;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => {
    cachedVoices = speechSynthesis.getVoices();
  };
  // PWA에서 첫 호출 시 getVoices()가 빈 배열을 반환할 수 있어 즉시 한 번 더 트리거
  speechSynthesis.getVoices();
}

// 보이스 목록이 채워질 때까지 대기 (최대 1초). 첫 재생에서 Premium 보이스를 놓치지 않기 위함.
export function waitForVoices(timeoutMs = 1000) {
  return new Promise(resolve => {
    const existing = speechSynthesis.getVoices();
    if (existing && existing.length > 0) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cachedVoices = speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
    speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

// 주어진 lang 접두사에 해당하는 보이스 중 가장 품질이 높은 것을 고른다.
// 우선순위: Premium > Enhanced > Neural/Google/Microsoft 계열 > 그 외 default > 첫 번째
export function pickBestVoice(langPrefix) {
  const voices = loadVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
  if (voices.length === 0) return null;

  const score = v => {
    const name = (v.name || '').toLowerCase();
    if (name.includes('premium')) return 100;
    if (name.includes('enhanced')) return 90;
    if (name.includes('neural')) return 80;
    if (name.includes('siri')) return 75;
    if (name.includes('google')) return 70;
    if (name.includes('microsoft')) return 65;
    if (v.default) return 50;
    return 10;
  };

  return voices.slice().sort((a, b) => score(b) - score(a))[0];
}

export async function speak(text) {
  await waitForVoices();
  return new Promise(resolve => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    const voice = pickBestVoice('ja');
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1.0;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}
