import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normalizePos,
  MODELS,
  getModel,
  buildGenerationConfig,
  parseGeminiResponse,
  buildApiErrorMessage,
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
});

describe('getModel', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageStub();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('저장된 값이 없으면 기본 모델을 반환한다', () => {
    expect(getModel()).toBe(MODELS[0].id);
  });

  it('유효한 모델이 저장되어 있으면 그대로 반환한다', () => {
    localStorage.setItem('gemini-model', 'gemini-2.5-flash');
    expect(getModel()).toBe('gemini-2.5-flash');
  });

  it('서비스 종료된 모델(gemini-2.0-flash)이 저장되어 있으면 기본 모델로 대체한다', () => {
    localStorage.setItem('gemini-model', 'gemini-2.0-flash');
    expect(getModel()).toBe(MODELS[0].id);
  });

  it('종료된 모델로 폴백하면 localStorage 저장값도 기본 모델로 바뀐다', () => {
    localStorage.setItem('gemini-model', 'gemini-2.0-flash');
    getModel();
    expect(localStorage.getItem('gemini-model')).toBe(MODELS[0].id);
  });
});

describe('buildGenerationConfig', () => {
  it('Gemini 3 계열은 thinkingLevel LOW 를 넣고 temperature 는 넣지 않는다', () => {
    for (const model of ['gemini-3.8-flash', 'gemini-3.5-flash-lite']) {
      const config = buildGenerationConfig(model);
      expect(config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(config).not.toHaveProperty('temperature');
    }
  });

  it('Gemini 2.5 계열은 temperature 0.1 이고 thinkingConfig 가 없다', () => {
    const config = buildGenerationConfig('gemini-2.5-flash');
    expect(config.temperature).toBe(0.1);
    expect(config).not.toHaveProperty('thinkingConfig');
  });

  it('모든 모델에 responseJsonSchema 기반 구조화 출력 설정과 출력 토큰 한도가 들어간다', () => {
    for (const model of MODELS.map(m => m.id)) {
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

describe('buildApiErrorMessage', () => {
  const model = 'gemini-2.0-flash';

  it('404 는 메시지에 "rate"(generateContent)가 들어 있어도 모델 종료 안내로 처리한다', () => {
    const msg = 'models/gemini-2.0-flash is not found for API version v1beta, or is not supported for generateContent.';
    const result = buildApiErrorMessage(404, msg, model);
    expect(result).toContain('더 이상 사용할 수 없습니다');
    expect(result).toContain(model);
    expect(result).not.toContain('쿼터');
  });

  it('429 는 쿼터 초과 안내를 반환하고 재시도 시간을 포함한다', () => {
    const result = buildApiErrorMessage(429, 'Quota exceeded. Please retry in 12.3s.', model);
    expect(result).toContain('쿼터 초과');
    expect(result).toContain('13초 후 재시도');
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
