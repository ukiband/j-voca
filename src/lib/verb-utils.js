// 사전형으로 확인한 동사만 활용한다. 사전형 복원이나 어미를 통한 동사 분류 추측은 하지 않는다.
export const VERB_FORMS = [
  { id: 'te', label: 'て형', example: '書く → 書いて' },
  { id: 'nai', label: 'ない형', example: '書く → 書かない' },
  { id: 'ta', label: 'た형', example: '書く → 書いた' },
  { id: 'potential', label: '가능형', example: '書く → 書ける' },
];

const GODAN = {
  う: { te: 'って', ta: 'った', nai: 'わない', potential: 'える' },
  つ: { te: 'って', ta: 'った', nai: 'たない', potential: 'てる' },
  る: { te: 'って', ta: 'った', nai: 'らない', potential: 'れる' },
  む: { te: 'んで', ta: 'んだ', nai: 'まない', potential: 'める' },
  ぶ: { te: 'んで', ta: 'んだ', nai: 'ばない', potential: 'べる' },
  ぬ: { te: 'んで', ta: 'んだ', nai: 'なない', potential: 'ねる' },
  く: { te: 'いて', ta: 'いた', nai: 'かない', potential: 'ける' },
  ぐ: { te: 'いで', ta: 'いだ', nai: 'がない', potential: 'げる' },
  す: { te: 'して', ta: 'した', nai: 'さない', potential: 'せる' },
};
const ICHIDAN = { te: 'て', ta: 'た', nai: 'ない', potential: 'られる' };
const SURU = { te: 'して', ta: 'した', nai: 'しない', potential: 'できる' };
const KURU = { te: 'きて', ta: 'きた', nai: 'こない', potential: 'こられる' };
const textOf = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
const hiragana = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 기존 읽기가 히라가나로 저장되어 있어도 표기의 가타카나 단어는 그대로 보여 준다.
export function verbReading(word) {
  let reading = textOf(word.reading);
  let cursor = 0;
  for (const part of textOf(word.word).match(/[ァ-ヺー]+/g) || []) {
    const candidates = [reading.indexOf(part, cursor), reading.indexOf(hiragana(part), cursor)].filter(i => i >= 0);
    if (!candidates.length) continue;
    const index = Math.min(...candidates);
    reading = reading.slice(0, index) + part + reading.slice(index + part.length);
    cursor = index + part.length;
  }
  return reading;
}

/** 메타데이터와 표기·읽기의 어미가 맞지 않으면 출제하지 않는다. */
export function isPracticeVerb(word) {
  if (word?.pos !== '동사' || word.isDictionaryForm !== true || ![1, 2, 3].includes(word.verbGroup)) return false;
  const text = textOf(word.word);
  const reading = hiragana(textOf(word.reading));
  if (!text || !/^[ぁ-ゖァ-ヺー\s]+$/.test(reading) || /(?:ます|です)$/.test(reading)) return false;
  if (word.verbGroup === 3) {
    return (text.endsWith('する') && reading.endsWith('する')) ||
      (/(?:来る|くる)$/.test(text) && reading.endsWith('くる'));
  }
  const ending = text.slice(-1);
  if (!Object.hasOwn(GODAN, ending) || !reading.endsWith(ending)) return false;
  return word.verbGroup === 1 || ending === 'る';
}

/** 저장 전에도 적용하여 불명확한 분류나 어미가 맞지 않는 항목의 출제를 막는다. */
export function normalizeVerbMetadata(entry) {
  const { verbGroup, isDictionaryForm, potentialAllowed, ...base } = entry;
  if (base.pos !== '동사') return base;
  const normalized = {
    ...base,
    verbGroup: [1, 2, 3].includes(verbGroup) ? verbGroup : null,
    isDictionaryForm: isDictionaryForm === true,
    potentialAllowed: potentialAllowed === true,
  };
  if (!isPracticeVerb(normalized)) {
    normalized.isDictionaryForm = false;
    normalized.potentialAllowed = false;
  }
  return normalized;
}

/** 표기·읽기를 수정하면 종전 동사의 분류를 자동 승계하지 않는다. 사용자가 다시 확인할 수 있다. */
export function editVerbEntry(entry, changes) {
  const changed = ['word', 'reading'].some(key => Object.hasOwn(changes, key) && changes[key] !== entry[key]);
  return {
    ...entry,
    ...(changed && entry.pos === '동사' ? { verbGroup: null, isDictionaryForm: false, potentialAllowed: false } : {}),
    ...changes,
  };
}

// ある의 부정형은 らない가 아니며, 行く의 음편은 일반적인 く와 다르다.
const isIku = text => /[行往逝]く$/.test(text) || /(?:^|[\sをにはへとが])(?:いく|ゆく)$/.test(text);
const isAru = text => /(?:^|[\sをにはへとが])ある$/.test(text) || /[有在]る$/.test(text);

export function conjugateVerb(word, form) {
  if (!VERB_FORMS.some(f => f.id === form) || !isPracticeVerb(word)) return null;
  if (form === 'potential' && word.potentialAllowed !== true) return null;
  const text = textOf(word.word);
  const reading = verbReading(word);
  let remove = 1;
  let readingRemove = 1;
  let suffix;
  let readingSuffix;
  let rule;

  if (word.verbGroup === 3) {
    if (text.endsWith('する')) {
      remove = readingRemove = 2;
      suffix = SURU[form];
      rule = `する → ${suffix}`;
    } else {
      readingRemove = 2;
      readingSuffix = KURU[form];
      remove = text.endsWith('来る') ? 1 : 2;
      suffix = text.endsWith('来る') ? readingSuffix.slice(1) : readingSuffix;
      rule = `くる → ${readingSuffix}`;
    }
  } else if (word.verbGroup === 2) {
    suffix = ICHIDAN[form];
    rule = `る → ${suffix}`;
  } else if ((form === 'te' || form === 'ta') && isIku(text)) {
    suffix = form === 'te' ? 'って' : 'った';
    rule = `行く는 예외 · く → ${suffix}`;
  } else if (form === 'nai' && isAru(text)) {
    remove = readingRemove = 2;
    suffix = 'ない';
    rule = 'ある는 예외 · ある → ない';
  } else if ((form === 'te' || form === 'ta') && /(?:問う|請う|乞う)$/.test(text)) {
    suffix = form === 'te' ? 'うて' : 'うた';
    rule = `음편 예외 · う → ${suffix}`;
  } else {
    const ending = text.slice(-1);
    suffix = GODAN[ending][form];
    rule = `${ending} → ${suffix}`;
  }
  return {
    word: text.slice(0, -remove) + suffix,
    reading: reading.slice(0, -readingRemove) + (readingSuffix ?? suffix),
    rule: `${word.verbGroup}류 동사 · ${rule}`,
  };
}

/** 레슨만 다른 같은 표기·읽기·분류는 한 번 출제한다. 동음이의어는 읽기만으로 합치지 않는다. */
export function getPracticeVerbs(words) {
  const unique = new Map();
  for (const word of words) {
    if (!isPracticeVerb(word)) continue;
    const key = JSON.stringify([textOf(word.word).replace(/\s/g, ''), verbReading(word).replace(/\s/g, ''), word.verbGroup]);
    const previous = unique.get(key);
    // 중복 항목의 가능형 적합성이 다르면 보수적으로 해당 형태만 제외한다.
    unique.set(key, previous ? { ...previous, potentialAllowed: previous.potentialAllowed === true && word.potentialAllowed === true } : word);
  }
  return [...unique.values()];
}

/** 복습 일정과 학습 기록을 참조하지 않는다. 중복되거나 잘못된 형태 선택도 걸러 낸다. */
export function buildVerbQuestions(words, forms) {
  const selected = VERB_FORMS.filter(f => forms.includes(f.id));
  return getPracticeVerbs(words).flatMap(word => selected.flatMap(form => {
    const answer = conjugateVerb(word, form.id);
    return answer ? [{ word, form: form.id, label: form.label, answer }] : [];
  }));
}
