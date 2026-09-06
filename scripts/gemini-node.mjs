/**
 * GitHub Actions(Node)에서 쓰는 Gemini 예문 생성 호출.
 * 브라우저용 src/lib/gemini.js 는 localStorage 에서 키를 읽고 사진 추출 프롬프트를 쓰므로 import 하지 않고,
 * 모델 순서와 대체 판정은 src/lib/gemini-common.js 를 공유한다.
 */

import { MODEL_CHAIN, isOverloaded, shouldTryNextModel, getModelTuning } from '../src/lib/gemini-common.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRY_DELAY_MS = 2000;

// 응답을 단어별 예문 배열로 강제한다. wordId 를 되돌려 받아야 어느 단어의 결과인지 순서에 의존하지 않고 맞출 수 있다
const RESPONSE_JSON_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      wordId: { type: 'integer' },
      sentence: { type: 'string' },
      reading: { type: 'string' },
      meaning: { type: 'string' },
    },
    required: ['wordId', 'sentence', 'reading', 'meaning'],
    propertyOrdering: ['wordId', 'sentence', 'reading', 'meaning'],
  },
};

function buildGenerationConfig(model) {
  return {
    responseMimeType: 'application/json',
    responseJsonSchema: RESPONSE_JSON_SCHEMA,
    maxOutputTokens: 8192,
    ...getModelTuning(model),
  };
}

/**
 * 예문 생성 프롬프트. items 는 [{ wordId, word, reading, meaning, pos, existing: [문장 문자열...] }].
 * 기존 예문을 함께 넘겨 같은 상황·표현이 반복되지 않게 한다.
 */
export function buildPrompt(items) {
  const list = items.map(({ wordId, word, reading, meaning, pos, existing }) =>
    JSON.stringify({ wordId, word, reading, meaning, pos: pos || '', existing: existing || [] })
  ).join('\n');

  return `당신은 일본어 초급 학습자용 단어장의 예문 작성자입니다. 아래 단어 목록의 단어마다 예문을 정확히 1개씩 만들어 주세요.

## 예문 규칙
- 등록된 뜻(meaning)에 맞는 쓰임으로, 초급 교재 수준의 짧고 쉬운 문장을 만듭니다. 한 문장이며 20자 안팎을 넘지 않습니다.
- 그 단어에 이미 저장된 예문(existing)과 다른 상황·다른 표현을 사용합니다. 같은 문장이나 낱말 하나만 바꾼 문장은 금지입니다.
- 단어는 문장 안에서 자연스러운 활용형으로 써도 됩니다 (예: 飲む → 飲みたいです, つめたい → つめたく).

## 각 필드
- wordId: 입력의 wordId 를 그대로 돌려줍니다.
- sentence: 교재 표기처럼 한자를 섞어 쓴 원문. 목표 단어가 쓰인 부분(활용형 포함)을 [[ ]] 로 정확히 한 번 감쌉니다.
- reading: 같은 문장을 히라가나로만 쓴 읽기. 외래어만 가타카나를 허용하고 한자는 한 글자도 남기지 않습니다. 어절 단위로 띄어 쓰고, sentence 와 같은 부분을 [[ ]] 로 정확히 한 번 감쌉니다.
- meaning: 문장의 자연스러운 한국어 번역.

## 예시
입력: {"wordId":100000,"word":"歌を歌う","reading":"うたをうたう","meaning":"노래를 부르다","pos":"동사","existing":[]}
출력: {"wordId":100000,"sentence":"友だちと[[歌を歌います]]。","reading":"ともだちと [[うたを うたいます]]。","meaning":"친구와 노래를 불러요."}

## 단어 목록 (한 줄에 하나)
${list}`;
}

function extractText(data) {
  // 사고 과정(thought) 파트가 함께 올 수 있으므로 사고 파트가 아닌 첫 텍스트 파트를 결과로 본다
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.find(p => typeof p.text === 'string' && !p.thought)?.text || '';
}

function parseArray(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // maxOutputTokens 에 걸려 잘린 경우 마지막 완성된 항목까지만 살린다
  const start = text.indexOf('[');
  if (start === -1) return null;
  const partial = text.slice(start);
  let cut = partial.lastIndexOf('}');
  while (cut !== -1) {
    try {
      const parsed = JSON.parse(partial.slice(0, cut + 1) + ']');
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    cut = partial.lastIndexOf('}', cut - 1);
  }
  return null;
}

/** API 요청 자체가 실패한 오류. 배치 스크립트가 "다음 묶음을 계속 보낼지"를 정하는 데 쓴다 */
export class GeminiRequestError extends Error {
  constructor(message, { status, model, fatal = false } = {}) {
    super(message);
    this.name = 'GeminiRequestError';
    this.status = status;
    this.model = model;
    // fatal: 모델을 바꿔도 같은 실패(400/401/403 등)라 실행을 실패(종료 코드 1)로 끝내 알려야 하는 경우.
    // 쿼터 소진·서버 장애·네트워크 오류는 다음 날 실행이 이어서 채우면 되므로 fatal 이 아니다
    this.fatal = fatal;
  }
}

async function requestGemini(url, body, apiKey, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new GeminiRequestError(`네트워크 오류: ${err.message}`);
  }
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

const defaultDelay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 단어 묶음 하나로 Gemini 를 호출해 [{ wordId, sentence, reading, meaning }] 를 돌려준다.
 * MODEL_CHAIN 순서로 시도하며 과부하(503)는 2초 후 1회 재시도, 그래도 실패하거나 404/429/5xx 면 다음 모델로 넘어간다.
 * options.fetchImpl / options.delay 는 테스트용 주입 지점.
 */
export async function generateSentences(items, apiKey, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const delay = options.delay || defaultDelay;
  if (!apiKey) throw new GeminiRequestError('GEMINI_API_KEY 가 없습니다.', { fatal: true });

  const parts = [{ text: buildPrompt(items) }];
  let lastFailure = null;

  for (const model of MODEL_CHAIN) {
    const url = `${API_BASE}/${model}:generateContent`;
    const body = { contents: [{ parts }], generationConfig: buildGenerationConfig(model) };

    let result = await requestGemini(url, body, apiKey, fetchImpl);
    if (!result.ok && isOverloaded(result.status, result.data?.error?.message || '')) {
      await delay(RETRY_DELAY_MS);
      result = await requestGemini(url, body, apiKey, fetchImpl);
    }

    if (result.ok) {
      const text = extractText(result.data);
      if (!text) {
        throw new Error(`빈 응답 (${model}, finishReason: ${result.data.candidates?.[0]?.finishReason || '없음'})`);
      }
      const rows = parseArray(text);
      if (!rows) throw new Error(`JSON 파싱 실패 (${model}): ${text.slice(0, 200)}`);
      return { model, rows: rows.filter(r => r && typeof r === 'object') };
    }

    const msg = result.data?.error?.message || '';
    if (shouldTryNextModel(result.status, msg)) {
      console.warn(`[gemini] ${model} ${result.status}: ${msg.slice(0, 120)} → 다음 모델`);
      lastFailure = { status: result.status, msg, model };
      continue;
    }
    // 모델을 바꿔도 같은 실패는 조용히 넘기면 매일 초록인데 아무것도 생성되지 않는 상태를 알 수 없으므로 fatal 로 끝낸다
    const keyProblem = result.status === 401 || result.status === 403 || /api[ _]?key/i.test(msg);
    throw new GeminiRequestError(
      `${model} ${result.status}: ${msg || '요청 실패'}${keyProblem ? ' (API 키를 확인하세요)' : ''}`,
      { status: result.status, model, fatal: true }
    );
  }

  throw new GeminiRequestError(
    `모든 모델 실패 (마지막: ${lastFailure?.model} ${lastFailure?.status} ${lastFailure?.msg?.slice(0, 120) || ''})`,
    { status: lastFailure?.status, model: lastFailure?.model }
  );
}
