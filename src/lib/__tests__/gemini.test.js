import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizePos,
  MODEL_CHAIN,
  buildGenerationConfig,
  parseGeminiResponse,
  buildApiErrorMessage,
  isOverloaded,
  isQuotaExceeded,
  extractWordsFromImage,
} from '../gemini';

// vitest 기본 환경(node)에는 localStorage가 없어서 Map 기반의 최소 구현을 주입한다
function createLocalStorageStub() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('normalizePos', () => {
  it('한자 표기를 한글로 변환한다', () => {
    expect(normalizePos('い形容詞')).toBe('い형용사');
    expect(normalizePos('な形容詞')).toBe('な형용사');
  });

  it('카타카나 한자 표기도 변환한다', () => {
    expect(normalizePos('イ形容詞')).toBe('い형용사');
    expect(normalizePos('ナ形容詞')).toBe('な형용사');
  });

  it('이미 올바른 표기는 그대로 반환한다', () => {
    expect(normalizePos('い형용사')).toBe('い형용사');
    expect(normalizePos('な형용사')).toBe('な형용사');
    expect(normalizePos('명사')).toBe('명사');
    expect(normalizePos('동사')).toBe('동사');
    expect(normalizePos('부사')).toBe('부사');
    expect(normalizePos('감탄사')).toBe('감탄사');
  });

  it('빈 값이나 null은 기타로 반환한다', () => {
    expect(normalizePos('')).toBe('기타');
    expect(normalizePos(null)).toBe('기타');
    expect(normalizePos(undefined)).toBe('기타');
  });

  it('매핑에 없는 값은 그대로 반환한다', () => {
    expect(normalizePos('연체사')).toBe('연체사');
  });

  it('한자 품사 표기를 한글 표기로 변환한다', () => {
    expect(normalizePos('動詞')).toBe('동사');
    expect(normalizePos('名詞')).toBe('명사');
    expect(normalizePos('代名詞')).toBe('대명사');
    expect(normalizePos('副詞')).toBe('부사');
    expect(normalizePos('助詞')).toBe('조사');
    expect(normalizePos('接続詞')).toBe('접속사');
    expect(normalizePos('感動詞')).toBe('감탄사');
    expect(normalizePos('形容動詞')).toBe('な형용사');
    expect(normalizePos('形容詞')).toBe('い형용사');
  });

  it('한글 음차 표기(나형용사, 이형용사)를 변환한다', () => {
    expect(normalizePos('나형용사')).toBe('な형용사');
    expect(normalizePos('이형용사')).toBe('い형용사');
    expect(normalizePos('나-형용사')).toBe('な형용사');
    expect(normalizePos('이-형용사')).toBe('い형용사');
  });

  it('앞뒤 공백을 제거한 뒤 매핑한다', () => {
    expect(normalizePos(' 動詞 ')).toBe('동사');
    expect(normalizePos(' 명사 ')).toBe('명사');
    expect(normalizePos('   ')).toBe('기타');
  });
});

describe('MODEL_CHAIN', () => {
  it('실측 기준 순서(lite → 3.8 → 2.5)로 고정되어 있다', () => {
    expect(MODEL_CHAIN).toEqual(['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash']);
  });
});

describe('buildGenerationConfig', () => {
  it('3.5-flash-lite 는 thinkingLevel MEDIUM (LOW 에서는 규칙 준수가 불안정했음)', () => {
    const config = buildGenerationConfig('gemini-3.5-flash-lite');
    expect(config.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
    expect(config).not.toHaveProperty('temperature');
  });

  it('그 외 Gemini 3 계열은 thinkingLevel LOW 이고 temperature 는 넣지 않는다', () => {
    const config = buildGenerationConfig('gemini-3.8-flash');
    expect(config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(config).not.toHaveProperty('temperature');
  });

  it('Gemini 2.5 계열은 temperature 0.1 이고 thinkingConfig 가 없다', () => {
    const config = buildGenerationConfig('gemini-2.5-flash');
    expect(config.temperature).toBe(0.1);
    expect(config).not.toHaveProperty('thinkingConfig');
  });

  it('모든 모델에 responseJsonSchema 기반 구조화 출력 설정과 출력 토큰 한도가 들어간다', () => {
    for (const model of MODEL_CHAIN) {
      const config = buildGenerationConfig(model);
      expect(config.responseMimeType).toBe('application/json');
      expect(config.responseJsonSchema.type).toBe('array');
      expect(config.responseJsonSchema.items.type).toBe('object');
      expect(config.responseJsonSchema.items.properties.word).toEqual({ type: 'string' });
      expect(config.responseJsonSchema.items.required).toEqual(['word', 'reading', 'meaning', 'pos']);
      // deprecated 된 responseSchema 는 responseJsonSchema 와 함께 보내면 안 된다
      expect(config).not.toHaveProperty('responseSchema');
      expect(config.maxOutputTokens).toBe(8192);
    }
  });
});

describe('parseGeminiResponse', () => {
  const entry = { word: '時計', reading: 'とけい', meaning: '시계', pos: '명사' };

  it('순수 JSON 배열을 파싱한다', () => {
    expect(parseGeminiResponse(JSON.stringify([entry]))).toEqual([entry]);
  });

  it('코드 펜스로 감싼 JSON 을 파싱한다', () => {
    const text = '```json\n' + JSON.stringify([entry]) + '\n```';
    expect(parseGeminiResponse(text)).toEqual([entry]);
  });

  it('앞뒤에 잡음 텍스트가 있어도 배열만 골라 파싱한다', () => {
    const text = '다음은 추출 결과입니다.\n' + JSON.stringify([entry]) + '\n이상입니다.';
    expect(parseGeminiResponse(text)).toEqual([entry]);
  });

  it('마지막 항목이 잘린 배열은 완성된 항목까지만 복구한다', () => {
    const truncated = '[' + JSON.stringify(entry) + ',{"word":"いぬ","reading":"い';
    expect(parseGeminiResponse(truncated)).toEqual([entry]);
  });

  it('마지막 } 가 문자열 값 안에서 잘린 경우에도 앞의 완성된 항목을 복구한다', () => {
    const first = { word: 'a', reading: 'あ', meaning: 'ㄱ', pos: '명사' };
    const truncated = '[' + JSON.stringify(first) + ',{"word":"b","reading":"ぶ}';
    expect(parseGeminiResponse(truncated)).toEqual([first]);
  });

  it('객체가 아닌 항목(문자열, null)은 걸러낸다', () => {
    expect(parseGeminiResponse(JSON.stringify(['hello', entry]))).toEqual([entry]);
    expect(parseGeminiResponse(JSON.stringify([null, entry]))).toEqual([entry]);
  });

  it('배열이 아닌 JSON 이면 throw 한다', () => {
    expect(() => parseGeminiResponse(JSON.stringify(entry))).toThrow('JSON 파싱 실패');
  });

  it('파싱할 수 없는 텍스트면 throw 한다', () => {
    expect(() => parseGeminiResponse('사진에서 단어를 찾을 수 없습니다.')).toThrow('JSON 파싱 실패');
  });
});

describe('isOverloaded', () => {
  it('503 이거나 과부하 메시지면 true', () => {
    expect(isOverloaded(503, '')).toBe(true);
    expect(isOverloaded(429, 'This model is currently experiencing high demand.')).toBe(true);
    expect(isOverloaded(500, 'The model is overloaded.')).toBe(true);
  });

  it('그 외에는 false', () => {
    expect(isOverloaded(404, 'This model models/gemini-2.0-flash is no longer available.')).toBe(false);
    expect(isOverloaded(200, '')).toBe(false);
  });
});

describe('isQuotaExceeded', () => {
  it('429 이거나 쿼터/rate limit 메시지면 true', () => {
    expect(isQuotaExceeded(429, '')).toBe(true);
    expect(isQuotaExceeded(403, 'Quota exceeded for this project.')).toBe(true);
    expect(isQuotaExceeded(400, 'Rate limit reached.')).toBe(true);
  });

  it('404 메시지의 generateContent 는 rate limit 으로 보지 않는다', () => {
    expect(isQuotaExceeded(404, 'models/x is not supported for generateContent.')).toBe(false);
    expect(isQuotaExceeded(200, '')).toBe(false);
  });
});

describe('buildApiErrorMessage', () => {
  const model = 'gemini-2.0-flash';

  it('404 는 메시지에 "rate"(generateContent)가 들어 있어도 모델 종료 안내로 처리한다', () => {
    const msg = 'models/gemini-2.0-flash is not found for API version v1beta, or is not supported for generateContent.';
    const result = buildApiErrorMessage(404, msg, model);
    expect(result).toContain('더 이상 사용할 수 없습니다');
    expect(result).toContain('앱 업데이트가 필요합니다');
    expect(result).toContain(model);
    expect(result).not.toContain('쿼터');
    // 모델 선택 UI 가 없으므로 설정 화면으로 보내는 문구는 나오면 안 된다
    expect(result).not.toContain('설정에서');
  });

  it('429 는 쿼터 초과 안내를 반환하고 재시도 시간을 포함한다', () => {
    const result = buildApiErrorMessage(429, 'Quota exceeded. Please retry in 12.3s.', model);
    expect(result).toContain('쿼터 초과');
    expect(result).toContain('13초 후 다시 시도해주세요');
    expect(result).not.toContain('설정에서');
  });

  it('429 에 재시도 시간이 없으면 잠시 후 다시 시도 안내를 붙인다', () => {
    const result = buildApiErrorMessage(429, 'Resource has been exhausted (e.g. check quota).', model);
    expect(result).toContain('잠시 후 다시 시도해주세요');
  });

  it('400 + API key 메시지는 키 확인 안내를 반환한다', () => {
    expect(buildApiErrorMessage(400, 'API key not valid. Please pass a valid API key.', model))
      .toBe('요청 오류: API 키가 올바른지 확인해주세요.');
  });

  it('400 + 그 외 메시지는 서버 메시지를 그대로 노출한다', () => {
    const msg = 'Invalid JSON payload received. Unknown name "thinkingLevel" at generation_config.thinking_config';
    const result = buildApiErrorMessage(400, msg, model);
    expect(result).toContain('요청 오류');
    expect(result).toContain(msg);
  });

  it('503 은 서버 과부하 안내를 반환한다', () => {
    expect(buildApiErrorMessage(503, 'The model is overloaded.', model)).toContain('서버 과부하');
  });

  it('그 외 상태 코드는 서버 메시지 또는 상태 코드를 반환한다', () => {
    expect(buildApiErrorMessage(500, 'Internal error', model)).toBe('Internal error');
    expect(buildApiErrorMessage(500, '', model)).toBe('API 요청 실패 (500)');
  });
});

describe('extractWordsFromImage 모델 체인', () => {
  const entry = { word: '時計', reading: 'とけい', meaning: '시계', pos: '名詞' };
  const overloaded = {
    ok: false,
    status: 503,
    json: async () => ({ error: { message: 'This model is currently experiencing high demand. Please try again later.' } }),
  };
  const notFound = {
    ok: false,
    status: 404,
    json: async () => ({ error: { message: 'This model models/gemini-3.5-flash-lite is no longer available.' } }),
  };
  const badKey = {
    ok: false,
    status: 400,
    json: async () => ({ error: { message: 'API key not valid. Please pass a valid API key.' } }),
  };
  const quota = {
    ok: false,
    status: 429,
    json: async () => ({ error: { message: 'You exceeded your current quota. Please retry in 30s.' } }),
  };
  const success = {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([entry]) }] } }] }),
  };
  // 테스트가 실제로 2초를 기다리지 않도록 대기를 즉시 끝내고 호출 횟수만 기록한다
  let delay;

  // fetch 가 어떤 모델에 호출됐는지 URL 에서 모델 id 만 뽑아 순서 비교에 쓴다
  function calledModels(fetchMock) {
    return fetchMock.mock.calls.map(([url]) => url.match(/models\/([^:]+):generateContent/)[1]);
  }

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageStub();
    localStorage.setItem('gemini-api-key', 'test-key');
    delay = vi.fn(() => Promise.resolve());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete globalThis.localStorage;
  });

  it('첫 모델이 재시도까지 503 이면 다음 모델로 넘어가고, 거기서 성공하면 결과를 반환한다', async () => {
    // lite: 503, 503 → 3.8: 503, 200 (모델별 1회 재시도가 각각 동작하는지도 함께 확인)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(overloaded)
      .mockResolvedValueOnce(overloaded)
      .mockResolvedValueOnce(overloaded)
      .mockResolvedValueOnce(success);
    vi.stubGlobal('fetch', fetchMock);

    const words = await extractWordsFromImage('base64', 'image/jpeg', 1, 2, '교재', { delay });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(calledModels(fetchMock)).toEqual([
      'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.8-flash',
    ]);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ word: '時計', pos: '명사', step: 1, chapter: 2, textbook: '교재' });
  });

  it('첫 모델이 404 면 재시도 없이 즉시 다음 모델을 호출한다', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(notFound).mockResolvedValueOnce(success);
    vi.stubGlobal('fetch', fetchMock);

    const words = await extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calledModels(fetchMock)).toEqual(['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
    expect(delay).not.toHaveBeenCalled();
    expect(words).toHaveLength(1);
  });

  it('400 (API 키 오류) 은 다음 모델로 넘기지 않고 즉시 throw 한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(badKey);
    vi.stubGlobal('fetch', fetchMock);

    await expect(extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay }))
      .rejects.toThrow('API 키가 올바른지 확인해주세요');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('세 모델이 모두 재시도까지 503 이면 과부하 메시지로 throw 한다 (fetch 6회)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(overloaded);
    vi.stubGlobal('fetch', fetchMock);

    await expect(extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay }))
      .rejects.toThrow('서버 과부하');
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(delay).toHaveBeenCalledTimes(3);
  });

  it('요청 URL 에 체인 순서대로 모델 id 가 들어간다', async () => {
    // 모두 404 → 세 모델을 순서대로 한 번씩만 호출한다
    const fetchMock = vi.fn().mockResolvedValue(notFound);
    vi.stubGlobal('fetch', fetchMock);

    await expect(extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay })).rejects.toThrow();
    expect(calledModels(fetchMock)).toEqual(MODEL_CHAIN);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('첫 모델이 429(쿼터) 면 재시도 없이 다음 모델로 넘어가 성공 결과를 반환한다', async () => {
    // 무료 등급 쿼터는 모델별로 따로 걸리므로 다른 모델은 정상일 수 있다
    const fetchMock = vi.fn().mockResolvedValueOnce(quota).mockResolvedValueOnce(success);
    vi.stubGlobal('fetch', fetchMock);

    const words = await extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calledModels(fetchMock)).toEqual(['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
    expect(delay).not.toHaveBeenCalled();
    expect(words).toHaveLength(1);
  });

  it('세 모델이 모두 429 면 쿼터 문구로 throw 한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(quota);
    vi.stubGlobal('fetch', fetchMock);

    await expect(extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay }))
      .rejects.toThrow('쿼터 초과');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('세 모델이 모두 404 면 과부하가 아니라 모델 종료 안내로 throw 한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(notFound));

    await expect(extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay }))
      .rejects.toThrow('앱 업데이트가 필요합니다');
  });

  it('요청은 x-goog-api-key 헤더와 모델별 generationConfig 를 포함한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(success);
    vi.stubGlobal('fetch', fetchMock);

    await extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-3.5-flash-lite');
    expect(url).not.toContain('key=');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    // 첫 시도는 lite 이므로 MEDIUM 이어야 한다
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'base64' });
  });

  it('프롬프트에 추출 범위 규칙(단어 칸 + 손글씨)이 들어 있다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(success);
    vi.stubGlobal('fetch', fetchMock);

    await extractWordsFromImage('base64', 'image/jpeg', 1, 1, '', { delay });

    const promptText = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(promptText).toContain('## 추출 범위 (가장 중요)');
    expect(promptText).toContain('새 단어 정리 칸');
    expect(promptText).toContain('손글씨로 적은 일본어 단어나 문장');
    expect(promptText).toContain('ます형 제시어');
  });
});
