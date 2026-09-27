import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, buildCheckPrompt, generateSentences, checkSentences, isUsableCheckRow, GeminiRequestError } from '../../../scripts/gemini-node.mjs';
import { MODEL_CHAIN } from '../gemini-common.js';

const items = [
  { wordId: 953, word: '歌を歌う', reading: 'うたをうたう', meaning: '노래를 부르다', pos: '동사', existing: ['友だちと[[歌を歌います]]。'] },
];

const checkItems = [
  {
    wordId: 1041, word: 'ない', reading: 'ない', meaning: '없다', pos: '형용사',
    example: { sentence: '時間が[[ない]]です。', reading: 'じかんが [[ない]]です。', meaning: '시간이 없다.' },
  },
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

  it('검사 프롬프트에 단어 정보와 검사할 예문이 들어간다', () => {
    const prompt = buildCheckPrompt(checkItems);
    expect(prompt).toContain('"wordId":1041');
    expect(prompt).toContain('"word":"ない"');
    expect(prompt).toContain('時間が[[ない]]です。');
    expect(prompt).toContain('시간이 없다.');
  });

  it('검사 요청은 검사 프롬프트와 판정 스키마를 보내고 판정 행을 돌려준다', async () => {
    const rows = [{ wordId: 1041, ok: false, problem: '존댓말 문장을 반말로 옮겼다', sentence: '時間が[[ない]]です。', reading: 'じかんが [[ない]]です。', meaning: '시간이 없어요.' }];
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(rows));
    const result = await checkSentences(checkItems, 'key', { fetchImpl, delay: noDelay });
    expect(result.rows).toEqual(rows);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toBe(buildCheckPrompt(checkItems));
    expect(body.generationConfig.responseJsonSchema.items.required).toEqual(['wordId', 'ok']);
  });

  it('틀림 판정은 어긴 검사 기준을 댈 때만 판정으로 쓴다', () => {
    expect(isUsableCheckRow({ wordId: 1, ok: true })).toBe(true);
    expect(isUsableCheckRow({ wordId: 1, ok: false, criterion: '번역' })).toBe(true);
    // 첫 실제 실행에서 "사전형이 아님"처럼 기준에 없는 이유로 멀쩡한 예문을 고친 오판을 막는다
    expect(isUsableCheckRow({ wordId: 1, ok: false })).toBe(false);
    expect(isUsableCheckRow({ wordId: 1, ok: false, criterion: '사전형 아님' })).toBe(false);
    expect(isUsableCheckRow({ wordId: 1, ok: 'false', criterion: '번역' })).toBe(false);
  });

  it('검사 요청은 Gemini 3 계열에 사고 수준 HIGH 를 보내고, thinkingLevel 이 없는 2.5 계열에는 기존 조정값을 보낸다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errorResponse(503, 'overloaded'));
    await expect(checkSentences(checkItems, 'key', { fetchImpl, delay: noDelay })).rejects.toMatchObject({ fatal: false });
    const configs = Object.fromEntries(fetchImpl.mock.calls.map(([url, init]) => [url.match(/models\/([^:]+)/)[1], JSON.parse(init.body).generationConfig]));
    expect(configs['gemini-3.5-flash-lite'].thinkingConfig).toEqual({ thinkingLevel: 'HIGH' });
    expect(configs['gemini-3.8-flash'].thinkingConfig).toEqual({ thinkingLevel: 'HIGH' });
    expect(configs['gemini-2.5-flash']).toMatchObject({ temperature: 0.1 });
    expect(configs['gemini-2.5-flash'].thinkingConfig).toBeUndefined();
  });

  it('모델 순서를 넘기면 그 모델로만 요청한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errorResponse(503, 'overloaded'));
    await expect(checkSentences(checkItems, 'key', { fetchImpl, delay: noDelay, models: ['gemini-3.8-flash'] })).rejects.toMatchObject({ fatal: false });
    expect(fetchImpl.mock.calls.map(c => c[0])).toEqual(Array(2).fill(expect.stringContaining('/gemini-3.8-flash:generateContent')));
  });
});
