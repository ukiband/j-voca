export const THEME_OPTIONS = [
  { id: 'system', label: '시스템' },
  { id: 'light', label: '라이트' },
  { id: 'dark', label: '다크' },
];

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set();
let preference = 'system';

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEME_OPTIONS.some(option => option.id === saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme() {
  const dark = preference === 'dark'
    || (preference === 'system' && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#f8fafc');
}

export function getThemePreference() {
  return preference;
}

export function subscribeToTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setThemePreference(next) {
  if (!THEME_OPTIONS.some(option => option.id === next)) return;
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 저장을 허용하지 않는 브라우저에서도 현재 화면의 테마는 바꿀 수 있다.
  }
  applyTheme();
  listeners.forEach(listener => listener());
}

export function initializeTheme() {
  preference = readPreference();
  applyTheme();
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    applyTheme();
    listeners.forEach(listener => listener());
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') applyTheme();
  };
  media.addEventListener('change', applyTheme);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    media.removeEventListener('change', applyTheme);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
