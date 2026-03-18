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
각 단어에 대해 다음 정보를 JSON 배열로 반환해주세요:
- word: 일본어 단어 (한자 포함)
- reading: 히라가나 읽기
- meaning: 한국어 뜻
- pos: 품사 (명사, 동사, 형용사, 부사, 조사, 접속사, 감탄사, 기타)

JSON 배열만 반환하고 다른 텍스트는 포함하지 마세요.
예시: [{"word":"時計","reading":"とけい","meaning":"시계","pos":"명사"}]`;

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
        maxOutputTokens: 4096,
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
    if (response.status === 400) {
      throw new Error('요청 오류: API 키가 올바른지 확인해주세요.');
    }
    throw new Error(msg || `API 요청 실패 (${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('단어를 추출할 수 없습니다.');

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
