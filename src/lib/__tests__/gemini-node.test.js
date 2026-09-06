import { describe, it, expect, vi } from 'vitest';
import {
  MODEL_CHAIN as NODE_MODEL_CHAIN,
  buildPrompt,
  buildGenerationConfig,
  generateSentences,
  GeminiRequestError,
} from '../../../scripts/gemini-node.mjs';
import { MODEL_CHAIN as BROWSER_MODEL_CHAIN } from '../gemini';

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
  it('MODEL_CHAIN 은 브라우저용 gemini.js 와 같은 순서다', () => {
    expect(NODE_MODEL_CHAIN).toEqual(BROWSER_MODEL_CHAIN);
  });

  it('프롬프트에 단어 정보와 기존 예문이 들어간다', () => {
    const prompt = buildPrompt(items);
    expect(prompt).toContain('"wordId":953');
    expect(prompt).toContain('歌を歌う');
    expect(prompt).toContain('友だちと[[歌を歌います]]。');
    expect(prompt).toContain('[[ ]]');
  });

  it('Gemini 3 계열은 thinkingLevel, 2.5 계열은 temperature 를 쓰고 JSON 스키마를 지정한다', () => {
    const lite = buildGenerationConfig('gemini-3.5-flash-lite');
    expect(lite.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
    expect(lite.temperature).toBeUndefined();
    expect(lite.responseMimeType).toBe('application/json');
    expect(lite.responseJsonSchema.items.required).toContain('wordId');
    expect(buildGenerationConfig('gemini-2.5-flash').temperature).toBe(0.1);
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
    expect(fetchImpl).toHaveBeenCalledTimes(NODE_MODEL_CHAIN.length);
  });

  it('키 오류(400 api key / 403)는 모델을 바꾸지 않고 즉시 fatal 로 끝낸다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errorResponse(400, 'API key not valid'));
    const err = await generateSentences(items, 'key', { fetchImpl, delay: noDelay }).catch(e => e);
    expect(err).toBeInstanceOf(GeminiRequestError);
    expect(err.fatal).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
