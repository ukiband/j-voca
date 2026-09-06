/**
 * 예문(sentences.json 항목)을 다루는 순수 함수 모음.
 * 브라우저(FlashCard/ReviewSession)와 Node 배치(scripts/generate-sentences.mjs)가 함께 import 하므로
 * DOM·Dexie·import.meta.env 같은 환경 의존 코드를 넣지 않는다.
 *
 * 예문 한 건의 형태:
 * { wordId, date: 'YYYY-MM-DD', source: { word, reading, meaning }, sentence, reading, meaning }
 * sentence/reading 안의 [[ ]] 는 목표 단어(활용형)를 표시하는 표식이다.
 */

const HIGHLIGHT_RE = /\[\[([\s\S]*?)\]\]/g;
// 유니코드 Han 스크립트 = 한자. 읽기 줄에는 히라가나·가타카나만 있어야 하므로 이 문자가 남아 있으면 거부한다
const HAN_RE = /\p{Script=Han}/u;

/**
 * "[[ ]]" 표식이 든 문자열을 { text, highlight } 세그먼트 배열로 나눈다.
 * 화면에서는 highlight 세그먼트만 굵게·색을 바꿔 그린다.
 * 단어 문자열을 검색해 강조하지 않는 이유: 예문 속 단어는 활용형(飲む → 飲みたい)으로 나와 검색이 실패하기 때문이다.
 * 짝이 맞지 않는 "[[" 는 일반 텍스트로 남긴다.
 */
export function parseHighlight(text) {
  if (typeof text !== 'string' || text === '') return [];
  const segments = [];
  let last = 0;
  for (const match of text.matchAll(HIGHLIGHT_RE)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), highlight: false });
    segments.push({ text: match[1], highlight: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), highlight: false });
  return segments;
}

/** 표식을 떼어낸 순수 문장. 중복 문장 비교에 쓴다 */
export function stripHighlight(text) {
  return typeof text === 'string' ? text.replace(HIGHLIGHT_RE, '$1') : '';
}

function countHighlights(text) {
  return typeof text === 'string' ? [...text.matchAll(HIGHLIGHT_RE)].length : 0;
}

/**
 * 예문의 source(생성 당시 단어 표기·읽기·뜻)가 현재 단어와 일치하는지 본다.
 * 사용자가 앱에서 단어를 고친 뒤에는 옛 뜻으로 만든 예문이 어긋날 수 있어, 세 필드가 모두 같을 때만 사용한다.
 */
export function matchesSource(sentence, word) {
  const src = sentence?.source;
  if (!src || !word) return false;
  return src.word === word.word && src.reading === word.reading && src.meaning === word.meaning;
}

/** 한 단어의 예문 목록에서 현재 단어 데이터와 맞는 것만 남긴다. 단어가 없으면(삭제됨) 빈 배열 */
export function filterUsableSentences(sentences, word) {
  if (!word || !Array.isArray(sentences)) return [];
  return sentences.filter(s => s.wordId === word.id && matchesSource(s, word));
}

/** 'YYYY-MM-DD' 를 1970-01-01 기준 일수로 바꾼다. 날짜별 순환의 인덱스 계산용 */
function toEpochDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * 오늘 보여줄 예문 1개를 고른다.
 * 1) 오늘(today, KST 문자열) 생성한 예문이 있으면 그것을 우선한다 (새로 만든 문장을 그날 바로 보게 하려는 의도)
 * 2) 없으면 date 오름차순으로 정렬한 뒤 (오늘의 epoch-day % 개수) 번째를 고른다.
 *    날짜만으로 결정되므로 같은 날에는 몇 번 열어도 같은 문장이 나오고, 다음 날에는 다음 문장으로 넘어간다.
 * 예문이 없으면 null.
 */
export function pickSentence(sentences, today) {
  if (!Array.isArray(sentences) || sentences.length === 0) return null;
  const todays = sentences.find(s => s.date === today);
  if (todays) return todays;
  const sorted = [...sentences].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted[toEpochDay(today) % sorted.length];
}

/**
 * Gemini 가 만든 예문 후보를 저장해도 되는지 검사한다. 통과하면 null, 아니면 거부 이유 문자열.
 * - sentence/reading/meaning 중 빈 값이 있으면 거부
 * - reading 에 한자가 남아 있으면 거부 (읽기 줄은 가나만 있어야 발음용으로 쓸 수 있다)
 * - sentence 와 reading 각각에 [[ ]] 가 정확히 1개씩 있어야 한다 (0개면 강조 불가, 2개 이상이면 위치가 모호). 짝이 깨진 표식도 거부
 * - 같은 단어에 이미 저장된 문장과 표식을 뗀 본문이 같으면 거부 (다른 상황·표현을 요구했는데 반복한 경우)
 */
export function validateSentence(candidate, existing = []) {
  if (!candidate || typeof candidate !== 'object') return '후보가 객체가 아님';
  const { sentence, reading, meaning } = candidate;
  for (const [name, value] of [['sentence', sentence], ['reading', reading], ['meaning', meaning]]) {
    if (typeof value !== 'string' || value.trim() === '') return `${name} 이 비어 있음`;
  }
  if (HAN_RE.test(reading)) return 'reading 에 한자가 남아 있음';
  if (countHighlights(sentence) !== 1) return 'sentence 의 [[ ]] 가 정확히 1개가 아님';
  if (countHighlights(reading) !== 1) return 'reading 의 [[ ]] 가 정확히 1개가 아님';
  // 짝이 맞는 표식을 뗀 뒤에도 "[[" 나 "]]" 가 남아 있으면 표식이 깨진 것이다
  if (/\[\[|\]\]/.test(stripHighlight(sentence)) || /\[\[|\]\]/.test(stripHighlight(reading))) {
    return '짝이 맞지 않는 표식이 있음';
  }
  const plain = stripHighlight(sentence).trim();
  if (existing.some(e => stripHighlight(e?.sentence).trim() === plain)) return '기존 예문과 같은 문장';
  return null;
}
