import { isKanji } from './kanji';
import { getStep, isSameLesson } from './lesson-utils';

const normalize = text => (text ?? '').normalize('NFC').replace(/\s/g, '')
  .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const readingKey = reading => reading.replace(/^-|-$/g, '');

/** 현재 단어를 먼저 두고, 같은 Step·Lesson의 단어만 연결한다. 예문은 별도 출처로 전달한다. */
export function getKanjiSourceWords(words, character, context, currentSource = null) {
  const candidates = words.filter(word => isSameLesson(word, getStep(context), context?.chapter))
    .sort((a, b) => a.id - b.id);
  const seen = new Set();
  return [currentSource, ...candidates].filter(word => {
    if (!word?.word?.includes(character)) return false;
    const key = JSON.stringify([word.word, word.reading, word.meaning]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 오쿠리가나가 사전형 또는 확인 가능한 활용형일 때만 연결한다.
// 가능형·사역형 등 다른 표제어와 겹치기 쉬운 확장은 하지 않는다.
const GODAN_ENDINGS = {
  う: ['い', 'わない', 'って', 'った'], く: ['き', 'かない', 'いて', 'いた'],
  ぐ: ['ぎ', 'がない', 'いで', 'いだ'], す: ['し', 'さない', 'して', 'した'],
  つ: ['ち', 'たない', 'って', 'った'], ぬ: ['に', 'なない', 'んで', 'んだ'],
  ぶ: ['び', 'ばない', 'んで', 'んだ'], む: ['み', 'まない', 'んで', 'んだ'],
  る: ['り', 'らない', 'って', 'った'],
};
const MASU = ['ます', 'ました', 'ません', 'ませんでした'];
const boundary = rest => !rest || /^[^ぁ-ゖー]/u.test(rest) || /^(?:を|が|は|に|と|へ|で|も|の|から|まで|か|ね|よ)/u.test(rest);

function matchesEnding(character, stem, ending, following) {
  const forms = new Set([ending]);
  const base = ending.slice(0, -1);
  const last = ending.slice(-1);
  const godan = GODAN_ENDINGS[last];
  if (godan) {
    forms.add(base + godan[0]);
    for (const suffix of MASU) forms.add(base + godan[0] + suffix);
    for (const suffix of godan.slice(1)) forms.add(base + suffix);
  }
  if (last === 'る') {
    // る 동사는 양쪽 활용을 대조하되, 후보가 여러 개 성립하면 아래에서 확정하지 않는다.
    for (const suffix of [...MASU, 'ない', 'て', 'た']) forms.add(base + suffix);
    if (base) forms.add(base);
  }
  if (last === 'い') for (const suffix of ['く', 'くない', 'かった', 'くて']) forms.add(base + suffix);
  if (character === '行' && stem === 'い' && ending === 'く') {
    forms.add('って'); forms.add('った');
  }
  return [...forms].some(form => form && following.startsWith(form) &&
    (boundary(following.slice(form.length)) || /[てで]$/.test(form)));
}

/** 가나를 경계로 원문과 읽기를 맞춘다. 경계가 둘 이상 가능하면 추측하지 않는다. */
function alignBlocks(word, reading) {
  const parts = word.split(/([\p{Unified_Ideograph}々0-9０-９]+)/u);
  const memo = new Map();
  function visit(index, offset) {
    if (index === parts.length) return offset === reading.length ? [[]] : [];
    const key = `${index}:${offset}`;
    if (memo.has(key)) return memo.get(key);
    const result = [];
    if (index % 2 === 0) {
      if (reading.startsWith(parts[index], offset)) result.push(...visit(index + 1, offset + parts[index].length));
    } else {
      for (let end = offset + 1; end <= reading.length && result.length < 2; end++) {
        const fragment = reading.slice(offset, end);
        if (!/^[ぁ-ゖー0-9０-９]+$/u.test(fragment)) break;
        for (const rest of visit(index + 1, end)) {
          result.push([{ text: parts[index], start: parts.slice(0, index).join('').length, reading: fragment, following: parts[index + 1] }, ...rest]);
          if (result.length === 2) break;
        }
      }
    }
    memo.set(key, result.slice(0, 2));
    return memo.get(key);
  }
  const results = visit(0, 0);
  return results.length === 1 ? results[0] : [];
}

function candidatesFor(character, data, following) {
  if (!data) return [];
  const candidates = new Map();
  for (const kind of ['kun', 'on']) for (const raw of data[kind]) {
    const reading = readingKey(raw);
    const [stem, ending] = normalize(reading).split('.');
    if (!stem || (ending && !matchesEnding(character, stem, ending, following))) continue;
    const candidate = { kind, reading, sound: stem };
    candidates.set(`${kind}:${reading}`, candidate);
  }
  const values = [...candidates.values()];
  // 出て → で（る）, 高かった → たか（い）, 死ぬ → し（ぬ）:
  // 오쿠리가나까지 맞는 표제어를 같은 소리의 접사·명사형·음독보다 우선한다.
  return values.filter(candidate => candidate.reading.includes('.') ||
    !values.some(other => other.kind === 'kun' && other.sound === candidate.sound && other.reading.includes('.')));
}

function matchBlock(block, character, dictionary, selectedIndex) {
  const chars = [...block.text];
  // 숫자와 반복 부호가 섞인 덩어리는 단어 전체 읽기로 남긴다.
  if (chars.some(c => !isKanji(c))) return [];
  const memo = new Map();
  function visit(index, offset) {
    if (index === chars.length) return offset === block.reading.length ? [[]] : [];
    const key = `${index}:${offset}`;
    if (memo.has(key)) return memo.get(key);
    const results = new Map();
    const choices = candidatesFor(chars[index], dictionary[chars[index]], index === chars.length - 1 ? block.following : '');
    for (const candidate of choices) {
      if (!block.reading.startsWith(candidate.sound, offset)) continue;
      for (const rest of visit(index + 1, offset + candidate.sound.length)) {
        const position = block.start + chars.slice(0, index).join('').length;
        const selected = chars[index] === character && (selectedIndex == null || selectedIndex === position);
        const matches = selected ? [candidate, ...rest] : rest;
        results.set(JSON.stringify(matches), matches);
        // 대상 글자의 읽기가 여러 개 성립하면 확정하지 않는다.
        if (results.size > 1) break;
      }
      if (results.size > 1) break;
    }
    memo.set(key, [...results.values()]);
    return memo.get(key);
  }
  const results = visit(0, 0);
  return results.length === 1 ? results[0] : [];
}

export function matchKanjiReadings(character, word, dictionary) {
  const text = normalize(word.word);
  const reading = normalize(word.reading);
  if (!text.includes(character) || !reading || text.length > 500 || reading.length > 1000) return [];
  const selectedIndex = Number.isInteger(word.characterIndex)
    ? normalize([...word.word].slice(0, word.characterIndex).join('')).length : null;
  return alignBlocks(text, reading).filter(block => block.text.includes(character) &&
    (selectedIndex == null || (selectedIndex >= block.start && selectedIndex < block.start + block.text.length)))
    .flatMap(block => matchBlock(block, character, dictionary, selectedIndex));
}

export function buildStudyReadings(character, words, dictionary) {
  const readings = { kun: [], on: [] };
  const rows = words.map(word => {
    const matches = matchKanjiReadings(character, word, dictionary);
    for (const { kind, reading } of matches) if (!readings[kind].includes(reading)) readings[kind].push(reading);
    return { word, matched: matches.length > 0 };
  });
  return { ...readings, rows };
}
