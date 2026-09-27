/**
 * 예문(sentences.json 항목)을 다루는 순수 함수 모음.
 * 브라우저(FlashCard/ReviewSession)와 Node 배치(scripts/generate-sentences.mjs, scripts/check-sentences.mjs)가 함께 import 하므로
 * DOM·Dexie·import.meta.env 같은 환경 의존 코드를 넣지 않는다.
 *
 * 예문 한 건의 형태:
 * { wordId, date: 'YYYY-MM-DD', source: { word, reading, meaning }, sentence, reading, meaning, check? }
 * 단어당 예문은 1건만 둔다. 단어를 등록한 뒤 일주일 동안은 배치가 매일 새 문장으로 교체하고, 그 뒤로는 마지막 문장을 그대로 둔다.
 * sentence/reading 안의 [[ ]] 는 목표 단어(활용형)를 표시하는 표식이다.
 *
 * check 는 검사 배치가 남기는 판정이다.
 * - { date, ok: true }: 검사를 통과했거나, 검사를 통과한 수정안으로 교체한 예문
 * - { date, ok: false, problem }: 틀렸다고 판정됐지만 아직 고치지 못한 예문. 앱에서 숨기고, 숨긴 날(date)로부터 RECENT_WORD_DAYS 동안
 *   다시 검사한다. 재검사까지 통과한 수정안으로 교체될 때만 바뀌고, 그 기간이 지나면 숨긴 채로 두고 더 검사하지 않는다
 * 생성 배치가 새로 만든 항목에는 check 가 없으므로, 문장이 바뀌면 자동으로 "검사 전"이 된다.
 */

// 단어 등록일(createdAt)로부터 이 일수 안에 있는 단어만 예문을 새로 만든다. 지금 배우는 단어에만 호출을 쓰기 위한 것이다.
// 검사 배치도 같은 기간을 쓴다(만든 지 이 일수 안인 예문을 검사하고, 숨긴 예문은 숨긴 지 이 일수 안에만 다시 시도)
export const RECENT_WORD_DAYS = 7;

// 앱이 예문 파일을 다시 받는 최소 간격. 배치는 하루 1회 돌고 단어 등록 직후에도 한 번 도니, 그보다 잦게 받을 이유가 없다
export const SENTENCE_REFRESH_MIN_MS = 10 * 60 * 1000;

/** 마지막으로 예문을 받은 시각(lastAt, ms) 기준으로 지금(now) 다시 받아야 하는지. 아직 받은 적이 없거나(0) force 면 간격을 무시한다 */
export function shouldRefreshSentences(lastAt, now, force = false) {
  return force || !lastAt || now - lastAt >= SENTENCE_REFRESH_MIN_MS;
}

/** 한 단어의 예문 배열에서 가장 최근(date 가 가장 큰) 것. 없으면 null */
export function latestSentence(sentences) {
  if (!Array.isArray(sentences) || sentences.length === 0) return null;
  return sentences.reduce((a, b) => (b.date > a.date ? b : a));
}

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

/** 한자·숫자 읽기와 띄어쓰기를 제외하면 원문을 그대로 유지해야 한다. */
function matchesReadingSegment(sentence, reading) {
  const compact = text => text.normalize('NFC').replace(/\s/g, '');
  const kana = '[\\p{Script=Hiragana}ー]+';
  const parts = compact(sentence).split(/([\p{Script=Han}0-9０-９]+)/u);
  const pattern = parts.map((part, index) => {
    if (index % 2 === 0) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 숫자+조수사의 불규칙 읽기(300円 → さんびゃくえん, 3日 → みっか)도 허용한다.
    // 숫자를 그대로 적을 때는 원래 숫자와 같아야 한다 (3人 → 4にん 방지).
    if (!/[0-9０-９]/u.test(part)) return kana;
    const withNumbers = part.match(/[\p{Script=Han}]+|[0-9０-９]+/gu)
      .map(run => HAN_RE.test(run) ? kana : `(?:${run}|${kana})`).join('');
    return `(?:${kana}|${withNumbers})`;
  }).join('');
  return new RegExp(`^${pattern}$`, 'u').test(compact(reading));
}

/** 강조 앞·안·뒤를 따로 비교해, 읽기의 강조 위치가 다른 단어로 옮겨진 경우도 거부한다. */
function hasMatchingReading(sentence, reading) {
  const split = text => {
    const match = [...text.matchAll(HIGHLIGHT_RE)][0];
    return [text.slice(0, match.index), match[1], text.slice(match.index + match[0].length)];
  };
  const sentenceParts = split(sentence);
  const readingParts = split(reading);
  return sentenceParts.every((part, index) => matchesReadingSegment(part, readingParts[index]));
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

/** 검사 배치가 틀렸다고 판정했고 아직 고치지 못해 숨긴 예문인지 */
export function isRejectedByCheck(sentence) {
  return sentence?.check?.ok === false;
}

/**
 * 한 단어의 예문 목록에서 화면에 보여 줄 것만 남긴다. 단어가 없으면(삭제됨) 빈 배열.
 * source 가 현재 단어와 맞아야 하고, 검사에서 틀렸다고 판정한 예문은 뺀다. 아직 검사하지 않은 예문은 보여 준다.
 */
export function filterUsableSentences(sentences, word) {
  if (!word || !Array.isArray(sentences)) return [];
  return sentences.filter(s => s.wordId === word.id && matchesSource(s, word) && !isRejectedByCheck(s));
}

/** 'YYYY-MM-DD' 를 1970-01-01 기준 일수로 바꾼다. 날짜별 순환의 인덱스 계산용 */
function toEpochDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** dateStr('YYYY-MM-DD')이 오늘(todayDay, epoch-day)로부터 0~RECENT_WORD_DAYS 일 안인지. 형식이 다르거나 미래 날짜면 false */
function isRecentDate(dateStr, todayDay) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const age = todayDay - toEpochDay(dateStr);
  return age >= 0 && age <= RECENT_WORD_DAYS;
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
 * - 한자·숫자의 읽기와 띄어쓰기를 제외한 원문 표기(가타카나·조사·문장부호 등) 및 강조 위치를 유지해야 한다
 * - 같은 단어에 이미 저장된 문장과 표식을 뗀 본문이 같으면 거부 (다른 상황·표현을 요구했는데 반복한 경우)
 */
export function validateSentence(candidate, existing = []) {
  if (!candidate || typeof candidate !== 'object') return '후보가 객체가 아님';
  const { sentence, reading, meaning } = candidate;
  for (const [name, value] of [['sentence', sentence], ['reading', reading], ['meaning', meaning]]) {
    if (typeof value !== 'string' || value.trim() === '') return `${name} 이 비어 있음`;
  }
  if (HAN_RE.test(reading)) return 'reading 에 한자가 남아 있음';
  if (/\p{Script=Hangul}/u.test(sentence + reading)) return '일본어 예문 또는 읽기에 한국어가 섞여 있음';
  if (countHighlights(sentence) !== 1) return 'sentence 의 [[ ]] 가 정확히 1개가 아님';
  if (countHighlights(reading) !== 1) return 'reading 의 [[ ]] 가 정확히 1개가 아님';
  // 짝이 맞는 표식을 뗀 뒤에도 "[[" 나 "]]" 가 남아 있으면 표식이 깨진 것이다
  if (/\[\[|\]\]/.test(stripHighlight(sentence)) || /\[\[|\]\]/.test(stripHighlight(reading))) {
    return '짝이 맞지 않는 표식이 있음';
  }
  if ([sentence, reading].some(text => [...text.matchAll(HIGHLIGHT_RE)][0][1].trim() === '')) {
    return '강조한 목표 단어가 비어 있음';
  }
  if (!hasMatchingReading(sentence, reading)) return 'sentence 와 reading 의 표기 또는 강조 위치가 다름';
  const plain = stripHighlight(sentence).trim();
  if (existing.some(e => stripHighlight(e?.sentence).trim() === plain)) return '기존 예문과 같은 문장';
  return null;
}

/**
 * 예문 생성 대상 단어: 등록일(createdAt, 'YYYY-MM-DD')이 오늘(today, KST)로부터 RECENT_WORD_DAYS 안에 있는 단어를 id 순으로 돌려준다.
 * 등록일이 없거나 형식이 다른 단어는 대상에서 뺀다. 레슨·step 은 보지 않는다.
 */
export function getRecentWords(words, today) {
  const todayDay = toEpochDay(today);
  return words
    .filter(w => isRecentDate(w.createdAt, todayDay))
    .sort((a, b) => a.id - b.id);
}

/**
 * 파일에서 지울 예문을 걸러낸다.
 * - 삭제된 단어(words 에 없는 wordId)의 예문은 모두 제거
 * - 생성 대상 단어(activeWordIds)는 source 가 현재 데이터와 다르면 제거 — 그 자리를 새 예문으로 다시 채우기 때문
 * - 그 외 단어의 source 불일치는 다시 생성하지 않으므로 파일에 남기고 화면(filterUsableSentences)에서만 제외한다
 */
export function pruneSentences(sentences, words, activeWordIds) {
  const wordsById = new Map(words.map(w => [w.id, w]));
  return sentences.filter(s => {
    const word = wordsById.get(s.wordId);
    if (!word) return false;
    return !(activeWordIds.has(s.wordId) && !matchesSource(s, word));
  });
}

/**
 * 오늘 예문을 새로 만들(교체할) 단어를 고른다. recentWords 는 getRecentWords 결과, byWord 는 wordId → (정리가 끝난) 예문 배열 Map.
 * 오늘(today, KST) 이미 만든 단어만 빼서, 같은 날 재실행해도 다시 만들지 않는다.
 */
export function selectTargets(recentWords, byWord, today) {
  return recentWords.filter(w => latestSentence(byWord.get(w.id))?.date !== today);
}

/**
 * 검사 배치가 검사할 예문을 고른다. today 는 KST 'YYYY-MM-DD'.
 * - check 가 없고 date 가 오늘로부터 RECENT_WORD_DAYS 안인 예문: 새로 만든 예문만 검사하고, 고정된 옛 예문과 date 형식이 이상한 예문은 뺀다
 * - 숨긴 예문(check.ok === false): 항목 date 와 상관없이 숨긴 날(check.date)로부터 RECENT_WORD_DAYS 안일 때만 다시 본다.
 *   모델이 원문을 맞다고 보는 예문은 수정안을 받을 수 없어 끝없이 재시도하게 되므로, 호출과 요약 표 소음을 기간으로 제한한다.
 *   숨김을 유지할 때는 check 를 바꾸지 않으므로 check.date 가 처음 숨긴 날이다. 형식이 이상한 check.date 는 뺀다
 * - 단어가 삭제됐거나 source 가 현재 단어와 다른 예문은 뺀다. 화면에서 이미 숨겨지고, 최근 단어라면 생성 배치가 다시 만든다
 * 요청 상한에 걸리면 뒤쪽이 다음 실행으로 밀리므로 지금 화면에 보이는 검사 전 예문을 앞에, 숨긴 예문을 뒤에 둔다(각각 wordId 순).
 */
export function selectCheckTargets(sentences, words, today) {
  const wordsById = new Map(words.map(w => [w.id, w]));
  const todayDay = toEpochDay(today);
  const unchecked = [];
  const rejected = [];
  for (const s of sentences) {
    if (!matchesSource(s, wordsById.get(s.wordId))) continue;
    if (isRejectedByCheck(s)) {
      if (isRecentDate(s.check.date, todayDay)) rejected.push(s);
    } else if (!s.check && isRecentDate(s.date, todayDay)) {
      unchecked.push(s);
    }
  }
  const byWordId = (a, b) => a.wordId - b.wordId;
  return [...unchecked.sort(byWordId), ...rejected.sort(byWordId)];
}

/**
 * 검사에서 받은 수정안(fix: { sentence, reading, meaning })을 재검사로 넘겨도 되는지 본다. 통과하면 null, 아니면 거부 이유.
 * 저장 규칙은 validateSentence 와 같지만 원래 예문을 existing 으로 넘기지 않는다. 번역만·읽기만 고친 수정안은 문장이 원래와 같아
 * "기존 예문과 같은 문장"으로 막히기 때문이다. 대신 세 필드가 모두 원래와 같으면 고친 것이 없으므로 거부한다.
 */
export function validateCheckFix(original, fix) {
  const reason = validateSentence(fix);
  if (reason) return reason;
  const unchanged = ['sentence', 'reading', 'meaning'].every(key =>
    fix[key].trim() === (typeof original?.[key] === 'string' ? original[key].trim() : '')
  );
  return unchanged ? '원래 예문과 같음' : null;
}

// problem 은 앱이 읽지 않는 기록용이다. 모델이 긴 설명을 돌려줘도 파일이 불어나지 않게 자른다
const CHECK_PROBLEM_MAX_LENGTH = 200;

/**
 * 검사 결과를 반영한 새 예문 배열을 돌려준다(입력은 바꾸지 않는다). 단어당 예문이 1건이라는 파일 규칙을 전제로 wordId 로 항목을 찾는다.
 * - fixed(Map<wordId, { sentence, reading, meaning }>): 수정안으로 교체하고 date 를 오늘로 바꾼다.
 *   같은 날 생성 배치가 다시 돌아도(단어 등록 시 실행) 오늘 만든 예문으로 보고 건너뛰어 검증한 문장이 유지된다
 * - passed(Set<wordId>): check 만 통과로 표시한다
 * - rejected(Map<wordId, problem>): 틀렸다고 표시해 앱에서 숨긴다
 * 이미 숨긴 예문은 fixed 만 반영하고 passed·rejected 에 있어도 그대로 둔다. 원문 통과로 되살리면 틀린 문장이 우연히 통과할 기회가
 * 실행마다 쌓이고, 다시 숨길 때마다 check 를 고치면 생성할 단어가 없는 날에도 매일 커밋이 생기기 때문이다.
 * 바뀐 항목을 끝으로 옮기지 않고 제자리에서 바꿔 커밋 diff 를 작게 유지한다.
 */
export function applyCheckResults(sentences, { passed = new Set(), fixed = new Map(), rejected = new Map() }, today) {
  return sentences.map(s => {
    if (fixed.has(s.wordId)) {
      const fix = fixed.get(s.wordId);
      return {
        wordId: s.wordId,
        date: today,
        source: s.source,
        sentence: fix.sentence.trim(),
        reading: fix.reading.trim(),
        meaning: fix.meaning.trim(),
        check: { date: today, ok: true },
      };
    }
    if (isRejectedByCheck(s)) return s;
    if (passed.has(s.wordId)) return { ...s, check: { date: today, ok: true } };
    if (rejected.has(s.wordId)) {
      const problem = String(rejected.get(s.wordId)).trim().slice(0, CHECK_PROBLEM_MAX_LENGTH);
      return { ...s, check: { date: today, ok: false, problem } };
    }
    return s;
  });
}
