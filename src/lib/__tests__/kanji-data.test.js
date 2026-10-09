import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { isKanji, kanjiChunkName } from '../kanji';

const directory = new URL('../../../public/data/kanji/', import.meta.url);
const chunks = Object.fromEntries(readdirSync(directory).filter(name => /^[0-9a-f]{3}\.json$/.test(name))
  .map(name => [name.slice(0, -5), JSON.parse(readFileSync(new URL(name, directory), 'utf8'))]));

describe('배포하는 한자 데이터', () => {
  it('현재 단어·예문의 모든 한자에 한국어 뜻과 실제 획 경로가 있다', () => {
    const characters = new Set();
    for (const [file, field] of [['words', 'word'], ['sentences', 'sentence']]) {
      const data = JSON.parse(readFileSync(new URL(`../../../public/data/${file}.json`, import.meta.url), 'utf8'));
      const rows = Array.isArray(data) ? data : data[file];
      for (const row of rows) for (const c of row[field]) if (isKanji(c)) characters.add(c);
    }
    for (const c of characters) {
      const entry = chunks[kanjiChunkName(c)]?.[c];
      expect(entry, c).toBeDefined();
      expect(entry.meaningsKo.length, `${c} 한국어 뜻`).toBeGreaterThan(0);
      expect(entry.strokes.length, `${c} 획순`).toBeGreaterThan(0);
    }
  });

  it('모든 경로는 실행 코드가 없는 SVG 좌표이고 파일 구분이 글자의 코드와 일치한다', () => {
    for (const [chunk, entries] of Object.entries(chunks)) for (const [c, entry] of Object.entries(entries)) {
      expect(kanjiChunkName(c)).toBe(chunk);
      for (const path of entry.strokes) expect(path).toMatch(/^[Mm][MmLlHhVvCcSsQqTtAaZzEe\d.,\s+\-]+$/);
    }
    expect(chunks['05f']['待'].strokes).toHaveLength(9);
    expect(chunks['05b']['学'].meaningsKo).toContain('배울 학');
    expect(chunks['04f']['体'].meaningsKo).toContain('몸 체');
  });
});
