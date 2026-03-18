const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (권장)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
];

export function getApiKey() {
  return localStorage.getItem('gemini-api-key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('gemini-api-key', key);
}

export function getModel() {
  return localStorage.getItem('gemini-model') || MODELS[0].id;
}

export function setModel(model) {
  localStorage.setItem('gemini-model', model);
}

export async function extractWordsFromImage(base64Image, mimeType, chapter, textbook) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('설정에서 Gemini API 키를 먼저 입력해주세요.');

  const model = getModel();
  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

  const prompt = `이 일본어 교재 사진에서 단어를 추출해주세요.

## 절대 금지 (NEVER)
- **절대로** 사진에 보이지 않는 단어를 만들어내지 마세요.
- **절대로** 반대어, 유의어, 관련어를 추가하지 마세요. 예: "長い"가 보인다고 "短い"를 추가하면 안 됩니다.
- **절대로** 쌍(pair)을 만들지 마세요. 사진에 "きれいだ"만 있으면 "きたない"를 추가하면 안 됩니다.
- 사진에 인쇄되어 있지 않은 단어가 하나라도 포함되면 실패입니다.

## 스캔 방법
- 사진이 회전되어 있을 수 있습니다. 텍스트 방향을 먼저 파악한 후 읽어주세요.
- 페이지에 여러 섹션(い형용사, な형용사, 명사, 동사 등)이 있을 수 있습니다. **모든 섹션**을 끝까지 스캔하세요.
- 단어 하나라도 누락하지 마세요. 페이지 전체를 꼼꼼히 확인하세요.

## 구분 기준
- **인쇄된 일본어 단어**만 추출하세요. 손글씨(필기, 체크, 동그라미)는 무시하세요.
- 손글씨로 한국어 뜻이 적혀 있다면 meaning에 활용해도 좋습니다.
- 교재에 한국어 뜻이 없는 경우, 일본어 단어의 뜻을 한국어로 직접 작성하세요. meaning을 빈 문자열로 두지 마세요.
- 교재에서 가장 크게/중심으로 인쇄된 표기를 word로 추출하세요. 괄호 안 보조 표기나 후리가나(振り仮名)는 word에 넣지 말고, reading 작성 시 참고하세요.
- 페이지 제목, 문법 설명, 예문은 제외하고 **단어 목록 항목만** 추출하세요.

## 출력 형식
JSON 배열만 반환하고 다른 텍스트는 포함하지 마세요:
- word: 일본어 단어 (교재에서 메인으로 인쇄된 표기 그대로. 괄호 안 보조 표기는 제외)
- reading: 히라가나 읽기
- meaning: 한국어 뜻
- pos: 품사 (명사, 동사, い형용사, な형용사, 부사, 조사, 접속사, 감탄사, 기타)

예시(초급 교재): [{"word":"とけい","reading":"とけい","meaning":"시계","pos":"명사"}]
예시(한자 메인 교재): [{"word":"時計","reading":"とけい","meaning":"시계","pos":"명사"}]`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
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
    if (response.status === 400) {
      throw new Error('요청 오류: API 키가 올바른지 확인해주세요.');
    }
    throw new Error(msg || `API 요청 실패 (${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason || '응답 없음';
    throw new Error(`추출 실패: ${reason}`);
  }

  // Strip markdown code fences (```json ... ```)
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  let jsonMatch = stripped.match(/\[[\s\S]*\]/);

  // Truncated response: try to recover complete entries
  if (!jsonMatch) {
    const arrStart = stripped.indexOf('[');
    if (arrStart !== -1) {
      const partial = stripped.slice(arrStart);
      const lastComplete = partial.lastIndexOf('}');
      if (lastComplete !== -1) {
        jsonMatch = [partial.slice(0, lastComplete + 1) + ']'];
      }
    }
  }

  if (!jsonMatch) throw new Error(`JSON 파싱 실패. Gemini 응답: "${text.slice(0, 200)}"`);

  const words = JSON.parse(jsonMatch[0]);
  const today = new Date().toISOString().split('T')[0];

  return words.map(w => ({
    word: w.word,
    reading: w.reading,
    meaning: w.meaning,
    pos: w.pos || '기타',
    chapter: chapter || 0,
    textbook: textbook || '',
    createdAt: today,
  }));
}
