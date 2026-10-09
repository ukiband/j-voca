import { afterEach, describe, expect, it, vi } from 'vitest';
import { isKanji, kanjiChunkName, formatKanjiReading } from '../kanji';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('한자 선택과 읽기', () => {
  it('가나·반복부호를 제외하고 확장 한자도 한 글자로 인식한다', () => {
    for (const c of ['待', '学', '𠮷']) expect(isKanji(c)).toBe(true);
    for (const c of ['ま', 'ツ', '々', '。', '한', '待つ', '', null]) expect(isKanji(c)).toBe(false);
    expect(kanjiChunkName('待')).toBe('05f');
    expect(kanjiChunkName('𠮷')).toBe('20b');
    expect(kanjiChunkName('../')).toBeNull();
  });

  it('오쿠리가나만 괄호로 구분한다', () => {
    expect(formatKanjiReading('ま.つ')).toBe('ま（つ）');
    expect(formatKanjiReading('タイ')).toBe('タイ');
    expect(formatKanjiReading('-ま.ち')).toBe('-ま（ち）');
  });
});

describe('한자 데이터 로딩', () => {
  const entry = { meaningsKo: ['기다릴 대'], meaningsEn: ['wait'], on: ['タイ'], kun: ['ま.つ'], strokes: ['M1 1L2 2'] };

  it('같은 묶음을 한 번만 요청하고 서로 다른 글자를 반환한다', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ 待: entry, 後: { ...entry, meaningsKo: ['뒤 후'] } }) });
    vi.stubGlobal('fetch', fetch);
    const { loadKanji } = await import('../kanji');
    const [wait, after] = await Promise.all([loadKanji('待'), loadKanji('後')]);
    expect(wait.meaningsKo).toEqual(['기다릴 대']);
    expect(after.meaningsKo).toEqual(['뒤 후']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/data\/kanji\/05f\.json$/);
  });

  it('통신 오류는 캐시하지 않아 다시 열면 재시도한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ 待: entry }) }));
    const { loadKanji } = await import('../kanji');
    await expect(loadKanji('待')).rejects.toThrow('offline');
    await expect(loadKanji('待')).resolves.toEqual(entry);
  });

  it('지원하지 않는 글자는 null이고 잘못된 응답은 오류다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ status: 404 }).mockResolvedValueOnce({ ok: true, json: async () => ({ 待: {} }) }));
    const { loadKanji } = await import('../kanji');
    expect(await loadKanji('あ')).toBeNull();
    expect(await loadKanji('𠮷')).toBeNull();
    await expect(loadKanji('待')).rejects.toThrow('올바르지 않은');
  });
});
