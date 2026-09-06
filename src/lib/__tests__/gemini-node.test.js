import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, generateSentences, GeminiRequestError } from '../../../scripts/gemini-node.mjs';
import { MODEL_CHAIN } from '../gemini-common.js';

const items = [
  { wordId: 953, word: '歌を歌う', reading: 'うたをうたう', meaning: '노래를 부르다', pos: '동사', existing: ['友だちと[[歌を歌います]]。'] },
];

function okResponse(rows) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: JSON.stringify(rows) }] } }] }),
  };
}

function errorResponse(status, message) {
  return { ok: false, status, json: async () => ({ error: { message } }) };
}

const noDelay = () => Promise.resolve();

describe('gemini-node', () => {
  it('프롬프트에 단어 정보와 기존 예문이 들어간다', () => {
    const prompt = buildPrompt(items);
    expect(prompt).toContain('"wordId":953');
    expect(prompt).toContain('歌を歌う');
    expect(prompt).toContain('友だちと[[歌を歌います]]。');
  });

  it('첫 모델이 성공하면 사고 파트를 건너뛰고 결과 배열을 돌려준다', async () => {
    const rows = [{ wordId: 953, sentence: 'a[[b]]', reading: '[[c]]', meaning: 'd' }];
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(rows));
    const result = await generateSentences(items, 'key', { fetchImpl, delay: noDelay });
    expect(result.model).toBe('gemini-3.5-flash-lite');
    expect(result.rows).toEqual(rows);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // 키는 URL 이 아니라 헤더로 보낸다
    expect(fetchImpl.mock.calls[0][0]).not.toContain('key=');
    expect(fetchImpl.mock.calls[0][1].headers['x-goog-api-key']).toBe('key');
  });

  it('503 은 같은 모델로 1회 재시도하고, 그래도 실패하면 429/404 를 건너 다음 모델로 넘어간다', async () => {
    const rows = [{ wordId: 953, sentence: 'x', reading: 'y', meaning: 'z' }];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(errorResponse(503, 'overloaded'))
      .mockResolvedValueOnce(errorResponse(503, 'overloaded'))
      .mockResolvedValueOnce(errorResponse(429, 'quota exceeded'))
      .mockResolvedValueOnce(okResponse(rows));
    const result = await generateSentences(items, 'key', { fetchImpl, delay: noDelay });
    expect(result.model).toBe('gemini-2.5-flash');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('모든 모델이 실패하면 GeminiRequestError (fatal 아님)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errorResponse(429, 'quota'));
    await expect(generateSentences(items, 'key', { fetchImpl, delay: noDelay })).rejects.toMatchObject({
      name: 'GeminiRequestError',
      fatal: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(MODEL_CHAIN.length);
  });

  it('모델을 바꿔도 같은 실패(400/401/403)는 즉시 fatal 로 끝내고, 키 문제는 메시지로 안내한다', async () => {
    const keyErr = await generateSentences(items, 'key', {
      fetchImpl: vi.fn().mockResolvedValue(errorResponse(400, 'API key not valid')), delay: noDelay,
    }).catch(e => e);
    expect(keyErr).toBeInstanceOf(GeminiRequestError);
    expect(keyErr.fatal).toBe(true);
    expect(keyErr.message).toContain('API 키');

    const badRequest = vi.fn().mockResolvedValue(errorResponse(400, 'Invalid JSON payload'));
    const reqErr = await generateSentences(items, 'key', { fetchImpl: badRequest, delay: noDelay }).catch(e => e);
    expect(reqErr.fatal).toBe(true);
    expect(reqErr.message).not.toContain('API 키');
    expect(badRequest).toHaveBeenCalledTimes(1);
  });

  it('네트워크 오류는 fatal 이 아니다', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(generateSentences(items, 'key', { fetchImpl, delay: noDelay })).rejects.toMatchObject({
      name: 'GeminiRequestError',
      fatal: false,
    });
  });

  it('키가 없으면 요청 없이 fatal', async () => {
    const fetchImpl = vi.fn();
    await expect(generateSentences(items, '', { fetchImpl })).rejects.toMatchObject({ fatal: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('잘린 JSON 응답은 완성된 항목까지만 살린다', async () => {
    const truncated = '[{"wordId":953,"sentence":"a","reading":"b","meaning":"c"},{"wordId":954,"sentence":"d';
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: truncated }] } }] }),
    });
    const result = await generateSentences(items, 'key', { fetchImpl, delay: noDelay });
    expect(result.rows).toEqual([{ wordId: 953, sentence: 'a', reading: 'b', meaning: 'c' }]);
  });
});
