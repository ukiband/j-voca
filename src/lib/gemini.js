import { getLocalDateString } from './date-utils';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini가 한자 표기(形容詞)로 응답할 경우 히라가나+한글 형태로 정규화
export function normalizePos(pos) {
  const posMap = {
    'い形容詞': 'い형용사',
    'な形容詞': 'な형용사',
    'イ形容詞': 'い형용사',
    'ナ形容詞': 'な형용사',
  };
  return posMap[pos] || pos || '기타';
}

// 무료 등급에서 쓸 수 있는 모델만 나열한다. gemini-2.0-flash 계열은 2026-06-01에 서비스가 종료되어
// 호출하면 404가 나므로 목록에서 제거했다. Pro 계열은 무료가 아니어서 넣지 않는다.
export const MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (권장)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (빠름)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (이전 세대)' },
];

export function getApiKey() {
  return localStorage.getItem('gemini-api-key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('gemini-api-key', key);
}

export function getModel() {
  const saved = localStorage.getItem('gemini-model');
  // 예전에 저장해 둔 모델(gemini-2.0-flash 등)이 서비스 종료로 목록에서 빠졌을 수 있다.
  // 그대로 쓰면 매번 404가 나므로, 목록에 없는 값은 기본 모델로 대체한다.
  return MODELS.some(m => m.id === saved) ? saved : MODELS[0].id;
}

export function setModel(model) {
  localStorage.setItem('gemini-model', model);
}

// 응답을 JSON 배열로 강제하기 위한 스키마. 필드 순서(propertyOrdering)를 고정해 두면
// 응답이 중간에 잘려도 word/reading 이 먼저 나와 있어 복구 시 건질 수 있는 항목이 많아진다.
const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      word: { type: 'STRING' },
      reading: { type: 'STRING' },
      meaning: { type: 'STRING' },
      pos: { type: 'STRING' },
    },
    required: ['word', 'reading', 'meaning', 'pos'],
    propertyOrdering: ['word', 'reading', 'meaning', 'pos'],
  },
};

export function buildGenerationConfig(model) {
  const config = {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 8192,
  };

  if (model.startsWith('gemini-3')) {
    // Gemini 3 계열은 temperature 를 기본값(1.0)에서 낮추면 오히려 반복 출력이나 성능 저하가 생긴다고
    // 공식 문서가 안내하므로 temperature 를 넣지 않는다. 대신 사고(thinking) 토큰 양을 thinkingLevel 로 조절한다.
    // 단어 추출은 단순 작업이라 'low' 로 두어 응답 속도를 확보하고, 사고 토큰도 maxOutputTokens 한도에
    // 포함되므로 실제 단어 목록에 쓸 토큰이 줄어드는 것을 막는다.
    config.thinkingConfig = { thinkingLevel: 'low' };
  } else {
    // Gemini 2.5 계열은 thinkingLevel 을 지원하지 않고, 낮은 temperature 로 일관된 출력을 얻는 기존 방식이 유효하다
    config.temperature = 0.1;
  }

  return config;
}

export function parseGeminiResponse(text) {
  let words = null;

  // 구조화 출력(responseMimeType: application/json)이면 순수 JSON 이 오므로 그대로 파싱을 먼저 시도한다
  try {
    words = JSON.parse(text);
  } catch {
    words = null;
  }

  if (!Array.isArray(words)) {
    // 스키마를 강제해도 maxOutputTokens 에 걸려 잘리면 JSON 이 불완전해진다. 코드 펜스 제거 → 배열 매칭 →
    // 마지막으로 완성된 항목까지만 잘라 닫는 순서로 복구를 시도한다.
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    let candidate = stripped.match(/\[[\s\S]*\]/)?.[0] ?? null;

    if (!candidate) {
      const arrStart = stripped.indexOf('[');
      if (arrStart !== -1) {
        const partial = stripped.slice(arrStart);
        const lastComplete = partial.lastIndexOf('}');
        if (lastComplete !== -1) {
          candidate = partial.slice(0, lastComplete + 1) + ']';
        }
      }
    }

    if (candidate) {
      try {
        words = JSON.parse(candidate);
      } catch {
        words = null;
      }
    }
  }

  if (!Array.isArray(words)) {
    throw new Error(`JSON 파싱 실패. Gemini 응답: "${text.slice(0, 200)}"`);
  }

  return words;
}

export async function extractWordsFromImage(base64Image, mimeType, step, chapter, textbook) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('설정에서 Gemini API 키를 먼저 입력해주세요.');

  const model = getModel();
  const url = `${API_BASE}/${model}:generateContent`;

  const prompt = `이 일본어 교재 사진에서 단어를 추출해주세요.

## 절대 금지 (NEVER)
- **절대로** 사진에 보이지 않는 단어를 만들어내지 마세요.
- **절대로** 반대어, 유의어, 관련어를 추가하지 마세요. 예: "長い"가 보인다고 "短い"를 추가하면 안 됩니다.
- **절대로** 쌍(pair)을 만들지 마세요. 사진에 "きれいだ"만 있으면 "きたない"를 추가하면 안 됩니다.
- 사진에 보이지 않는 단어(직접 만들어낸 단어)가 하나라도 포함되면 실패입니다.

## 스캔 방법
- 사진이 회전되어 있을 수 있습니다. 텍스트 방향을 먼저 파악한 후 읽어주세요.
- 페이지에 여러 섹션(い형용사, な형용사, 명사, 동사 등)이 있을 수 있습니다. **모든 섹션**을 끝까지 스캔하세요.
- 단어 하나라도 누락하지 마세요. 페이지 전체를 꼼꼼히 확인하세요.

## 구분 기준
- **인쇄된 일본어 단어**와 **손글씨로 적힌 일본어 단어** 모두 추출하세요. 단, 체크 표시(✓)나 동그라미(○) 등의 기호는 무시하세요. 손글씨가 인쇄된 단어의 보충 설명이나 메모인 경우에는 별도 단어로 추출하지 말고, 독립적으로 적힌 단어만 추출하세요.
- 손글씨로 한국어 뜻이 적혀 있다면 meaning에 활용해도 좋습니다.
- 교재에 한국어 뜻이 없는 경우, 일본어 단어의 뜻을 한국어로 직접 작성하세요. meaning을 빈 문자열로 두지 마세요.
- 교재에서 가장 크게/중심으로 인쇄된 표기를 word로 추출하세요. 괄호 안 보조 표기나 후리가나(振り仮名)는 word에 넣지 말고, reading 작성 시 참고하세요.
- 페이지 제목, 문법 설명, 예문은 제외하고 **단어 목록 항목만** 추출하세요.

## 출력 형식
각 항목의 필드 의미는 다음과 같습니다 (형식은 스키마로 지정되어 있으니 내용에 집중하세요):
- word: 일본어 단어. 교재에서 메인으로 인쇄된 표기 그대로 (한자 메인이면 한자, 괄호 안 보조 표기와 후리가나는 제외)
- reading: 히라가나 읽기
- meaning: 한국어 뜻. 뜻이 여러 개면 "높다, 비싸다" 처럼 쉼표로 구분
- pos: 품사. 반드시 다음 목록 중 하나를 그대로 사용: 명사, 대명사, 동사, い형용사, な형용사, 부사, 조사, 접속사, 감탄사, 기타. 한자 표기(形容詞 등)를 쓰지 마세요.

## 예시
- 초급 히라가나 교재에 "とけい 시계" → {"word":"とけい","reading":"とけい","meaning":"시계","pos":"명사"}
- 한자 메인 + 후리가나 "時計(とけい)" → {"word":"時計","reading":"とけい","meaning":"시계","pos":"명사"}
- 인쇄된 "高い" 옆에 손글씨로 "비싸다도 됨" 메모 → 메모는 별도 단어로 만들지 않고 인쇄 단어 1개만: {"word":"高い","reading":"たかい","meaning":"높다, 비싸다","pos":"い형용사"}
- な형용사 "きれいだ" → {"word":"きれいだ","reading":"きれいだ","meaning":"예쁘다, 깨끗하다","pos":"な형용사"}`;

  const response = await fetch(url, {
    method: 'POST',
    // API 키는 URL 쿼리(?key=)보다 헤더로 보내는 편이 로그나 히스토리에 남지 않아 안전하다
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image,
            },
          },
        ],
      }],
      generationConfig: buildGenerationConfig(model),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || '';
    if (response.status === 429 || msg.includes('quota') || msg.includes('rate')) {
      const retry = msg.match(/retry in ([\d.]+)s/i);
      const wait = retry ? Math.ceil(Number(retry[1])) : null;
      throw new Error(
        `쿼터 초과: 현재 모델(${model})의 무료 사용량을 초과했습니다.` +
        (wait ? ` ${wait}초 후 재시도하거나,` : '') +
        ' 설정에서 다른 모델로 변경해보세요.'
      );
    }
    if (response.status === 503 || msg.includes('high demand') || msg.includes('overloaded')) {
      throw new Error('서버 과부하: 잠시 후 다시 시도해주세요.');
    }
    // 서비스가 종료된 모델을 호출하면 404 또는 "not found"/"is not supported" 메시지가 온다.
    // 다른 모델로 바꾸면 해결되는 문제라서 설정 화면으로 안내한다.
    if (response.status === 404 || msg.includes('not found') || msg.includes('is not supported')) {
      throw new Error(`선택한 모델(${model})을 더 이상 사용할 수 없습니다. 설정에서 다른 모델을 선택해주세요.`);
    }
    if (response.status === 400) {
      throw new Error('요청 오류: API 키가 올바른지 확인해주세요.');
    }
    throw new Error(msg || `API 요청 실패 (${response.status})`);
  }

  const data = await response.json();
  // 사고 과정(thought) 파트가 함께 올 수 있으므로, 사고 파트가 아닌 첫 텍스트 파트를 단어 목록으로 본다
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.find(p => typeof p.text === 'string' && !p.thought)?.text || '';

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason || '응답 없음';
    throw new Error(`추출 실패: ${reason}`);
  }

  const words = parseGeminiResponse(text);
  // 로컬 타임존 기준 날짜를 사용하여 KST 자정~오전 9시에 전날로 처리되는 버그 방지
  const today = getLocalDateString();

  return words.map(w => ({
    word: w.word,
    reading: w.reading,
    meaning: w.meaning,
    pos: normalizePos(w.pos),
    // step은 교재 단계. 입력이 비어 있으면 1로 저장한다 (step 누락 = step 1 규칙과 일치)
    step: step || 1,
    chapter: chapter || 0,
    textbook: textbook || '',
    createdAt: today,
  }));
}
