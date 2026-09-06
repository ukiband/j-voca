import { fetchSentencesData } from './github';
import { syncSentencesFromData } from './db';
import { shouldRefreshSentences } from './sentence-utils';

/**
 * 예문 파일을 다시 받아 IndexedDB 를 갱신한다. 앱 시작, 백그라운드에서 돌아올 때, 복습 화면 진입 시 호출한다.
 * 예문은 보조 정보라 화면에 진행 표시나 실패 안내를 두지 않고, 받지 못하면 저장된 예문을 그대로 쓴다.
 * 잠깐 다른 앱을 보고 돌아올 때마다 파일(수백 KB)을 받지 않도록 마지막 성공 후 일정 시간은 건너뛰고,
 * 동시에 두 번 불리면 진행 중인 요청을 함께 기다린다.
 */
let lastSyncedAt = 0;
let inFlight = null;

export function refreshSentences({ force = false } = {}) {
  if (inFlight) return inFlight;
  if (!shouldRefreshSentences(lastSyncedAt, Date.now(), force)) return Promise.resolve(false);
  inFlight = (async () => {
    try {
      const data = await fetchSentencesData();
      if (!data) return false;
      await syncSentencesFromData(data.sentences);
      lastSyncedAt = Date.now();
      return true;
    } catch (err) {
      console.warn('Sentence sync error:', err);
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
