import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { addWordsToRepo, updateWordInRepo } from '../github';

const original = { id: 1, word: '切る', reading: 'きる', meaning: '자르다', pos: '동사', step: 1, chapter: 1, verbGroup: 1, isDictionaryForm: true, potentialAllowed: true };
let fetchMock;
function storedData() {
  const call = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT');
  return JSON.parse(Buffer.from(JSON.parse(call[1].body).content, 'base64').toString('utf8'));
}

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 'test-token' });
  fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sha: 'test-sha', content: Buffer.from(JSON.stringify({ lastId: 1, words: [original] })).toString('base64') }) })
    .mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('동사 정보의 GitHub 저장 경계', () => {
  it('추가 시 검증한 분류를 저장하고 새 사전형 항목을 만들지 않는다', async () => {
    const input = [
      { ...original, word: '食べる', reading: 'たべる', verbGroup: 2, id: undefined },
      { ...original, word: '行きます', reading: 'いきます', id: undefined },
    ];
    const result = await addWordsToRepo(input);
    expect(result.wordsWithIds).toHaveLength(2);
    expect(storedData().words[1]).toMatchObject({ id: 2, word: '食べる', verbGroup: 2, isDictionaryForm: true });
    expect(storedData().words[2]).toMatchObject({ id: 3, word: '行きます', isDictionaryForm: false, potentialAllowed: false });
  });

  it('뜻만 수정하면 분류를 유지한다', async () => {
    await updateWordInRepo(1, { meaning: '베다' });
    expect(storedData().words[0]).toMatchObject({ verbGroup: 1, isDictionaryForm: true, potentialAllowed: true });
  });

  it('표기를 수정하면 종전 동사의 분류를 그대로 저장하지 않는다', async () => {
    await updateWordInRepo(1, { word: '着る' });
    expect(storedData().words[0]).toMatchObject({ word: '着る', verbGroup: null, isDictionaryForm: false, potentialAllowed: false });
  });

  it('수정 화면에서 명시한 새 분류는 검증하여 저장한다', async () => {
    await updateWordInRepo(1, { word: '着る', verbGroup: 2, isDictionaryForm: true, potentialAllowed: true });
    expect(storedData().words[0]).toMatchObject({ word: '着る', verbGroup: 2, isDictionaryForm: true, potentialAllowed: true });
  });
});
