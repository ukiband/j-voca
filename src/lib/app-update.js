const REQUEST_TIMEOUT_MS = 10_000;

let hasUpdate = false;
let inFlight = null;
const listeners = new Set();

export function getHasUpdate() {
  return hasUpdate;
}

export function subscribeToUpdate(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function checkForUpdate() {
  if (!import.meta.env.PROD || hasUpdate || document.visibilityState !== 'visible') return;
  if (inFlight) return inFlight;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  inFlight = fetch(`${import.meta.env.BASE_URL}version.json?${Date.now()}`, {
    cache: 'no-store',
    signal: controller.signal,
  })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      if (typeof data?.build === 'string' && data.build && data.build !== __BUILD_TIME__) {
        hasUpdate = true;
        listeners.forEach(listener => listener());
      }
    })
    // 오프라인이나 배포 중 오류는 다음 확인 때 다시 시도한다.
    .catch(() => {})
    .finally(() => {
      clearTimeout(timeout);
      inFlight = null;
    });
  return inFlight;
}

export function startUpdateChecks() {
  if (!import.meta.env.PROD) return () => {};

  checkForUpdate();
  document.addEventListener('visibilitychange', checkForUpdate);
  const events = ['pageshow', 'focus', 'online'];
  events.forEach(event => window.addEventListener(event, checkForUpdate));

  return () => {
    document.removeEventListener('visibilitychange', checkForUpdate);
    events.forEach(event => window.removeEventListener(event, checkForUpdate));
  };
}
