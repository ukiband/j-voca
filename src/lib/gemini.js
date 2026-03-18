const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export function getApiKey() {
  return localStorage.getItem('gemini-api-key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('gemini-api-key', key);
}

export async function extractWordsFromImage(base64Image, mimeType, chapter, textbook) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Gemini API 키를 설정해주세요.');

  const prompt = `이 일본어 교재 사진에서 단어를 추출해주세요.
각 단어에 대해 다음 정보를 JSON 배열로 반환해주세요:
- word: 일본어 단어 (한자 포함)
- reading: 히라가나 읽기
- meaning: 한국어 뜻
- pos: 품사 (명사, 동사, 형용사, 부사, 조사, 접속사, 감탄사, 기타)

JSON 배열만 반환하고 다른 텍스트는 포함하지 마세요.
예시: [{"word":"時計","reading":"とけい","meaning":"시계","pos":"명사"}]`;

  const response = await fetch(`${API_URL}?key=${apiKey}`, {
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
    throw new Error(err.error?.message || `API 요청 실패 (${response.status})`);
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
