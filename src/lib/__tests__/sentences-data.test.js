import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSentence } from '../sentence-utils';

// 실제 public/data/sentences.json 을 읽어 정합성을 검증한다.
// 이 파일은 GitHub Actions 배치가 매일 커밋하므로, 배치의 검증이 뚫렸을 때 여기서 잡는다.
// 아직 생성 전이면 빈 배열이므로 "항목이 있어야 한다"는 조건은 두지 않는다.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../../public/data');
const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'sentences.json'), 'utf8'));
const words = JSON.parse(fs.readFileSync(path.join(dataDir, 'words.json'), 'utf8')).words;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isPositiveInt = v => Number.isInteger(v) && v > 0;

describe('public/data/sentences.json', () => {
  it('최상위에 sentences 배열이 있다', () => {
    expect(Array.isArray(data.sentences)).toBe(true);
  });

  it('wordId 는 양의 정수이고 words.json 에 존재한다 (삭제된 단어의 예문은 배치가 정리해야 함)', () => {
    const ids = new Set(words.map(w => w.id));
    const bad = data.sentences.filter(s => !isPositiveInt(s.wordId) || !ids.has(s.wordId));
    expect(bad.map(s => s.wordId)).toEqual([]);
  });

  it('date 는 YYYY-MM-DD 형식이다', () => {
    const bad = data.sentences.filter(s => !DATE_RE.test(s.date));
    expect(bad.map(s => `${s.wordId}:${s.date}`)).toEqual([]);
  });

  it('source 에 word/reading/meaning 문자열이 있다', () => {
    const bad = data.sentences.filter(s =>
      !s.source || ['word', 'reading', 'meaning'].some(k => typeof s.source[k] !== 'string')
    );
    expect(bad.map(s => s.wordId)).toEqual([]);
  });

  it('모든 항목이 저장 규칙(빈 값·reading 한자·[[ ]] 1회)을 만족한다', () => {
    const bad = data.sentences
      .map(s => ({ wordId: s.wordId, date: s.date, reason: validateSentence(s) }))
      .filter(r => r.reason);
    expect(bad).toEqual([]);
  });

  it('(wordId, date) 조합이 유일하다 (Dexie 기본 키)', () => {
    const keys = data.sentences.map(s => `${s.wordId}|${s.date}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('단어당 예문이 7개를 넘지 않는다', () => {
    const counts = new Map();
    for (const s of data.sentences) counts.set(s.wordId, (counts.get(s.wordId) || 0) + 1);
    const over = [...counts].filter(([, n]) => n > 7).map(([id]) => id);
    expect(over).toEqual([]);
  });
});
