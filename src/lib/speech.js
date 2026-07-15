// 사전 생성된 VOICEVOX Nemo 음성 파일(wav)을 우선 재생하고,
// 없으면 Web Speech API로 폴백한다.

const AUDIO_BASE = import.meta.env.BASE_URL + 'audio/';

// 단어 → 파일명 매핑 인덱스를 한 번만 로드 (앱 세션 동안 캐시)
let audioIndex = null;
let audioIndexPromise = null;

function loadAudioIndex() {
  if (audioIndex) return Promise.resolve(audioIndex);
  if (audioIndexPromise) return audioIndexPromise;
  audioIndexPromise = fetch(AUDIO_BASE + 'index.json')
    .then(r => (r.ok ? r.json() : {}))
    .then(idx => {
      audioIndex = idx;
      return idx;
    })
    .catch(() => {
      audioIndex = {};
      return {};
    });
  return audioIndexPromise;
}

// 앱 로드 직후 인덱스 미리 가져오기
if (typeof window !== 'undefined') {
  loadAudioIndex();
}

// 단어에 해당하는 사전 생성 오디오 URL을 반환 (없으면 null)
export async function getPrerenderedAudioUrl(text) {
  const idx = await loadAudioIndex();
  const filename = idx[text];
  return filename ? AUDIO_BASE + filename : null;
}

// 사전 생성 wav를 재생. 성공 시 true, 파일이 없거나 실패 시 false 반환.
function playAudioFile(url) {
  return new Promise(resolve => {
    const audio = new Audio(url);
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.play().catch(() => resolve(false));
  });
}

// Web Speech API 폴백
function speakWithSynthesis(text, lang = 'ja-JP', rate = 0.8) {
  return new Promise(resolve => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

export async function speak(text) {
  const url = await getPrerenderedAudioUrl(text);
  if (url) {
    const ok = await playAudioFile(url);
    if (ok) return;
    // 재생 실패 시 폴백
  }
  await speakWithSynthesis(text);
}
