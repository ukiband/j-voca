import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { isKanji, kanjiChunkName } from '../kanji';

const directory = new URL('../../../public/data/kanji/', import.meta.url);
const chunks = Object.fromEntries(readdirSync(directory).filter(name => /^[0-9a-f]{3}\.json$/.test(name))
  .map(name => [name.slice(0, -5), JSON.parse(readFileSync(new URL(name, directory), 'utf8'))]));
const entries = Object.assign({}, ...Object.values(chunks));

describe('배포하는 한자 데이터', () => {
  it('전체 파일·글자 수와 검토한 보정 사전의 해시가 출처 기록과 일치한다', () => {
    const sources = JSON.parse(readFileSync(new URL('sources.json', directory), 'utf8'));
    expect(Object.keys(chunks).sort()).toEqual(sources.chunks);
    expect(Object.keys(entries)).toHaveLength(sources.characters);
    const corrections = readFileSync(new URL('../../../scripts/kanji-korean-overrides.json', import.meta.url));
    expect(createHash('sha256').update(corrections).digest('hex')).toBe(sources.koreanOverridesSha256);
    // Regeneration must actually apply the reviewed values, not just record their hash.
    for (const group of JSON.parse(corrections).groups) {
      for (const [c, meanings] of Object.entries(group.entries)) {
        if (entries[c]) expect(entries[c].meaningsKo, c).toEqual(meanings);
      }
    }
  });

  it('전체 사전의 훈음은 뜻과 한글 음으로 구성되고 이체자 메모가 노출되지 않는다', () => {
    for (const [c, entry] of Object.entries(entries)) {
      for (const field of ['meaningsKo', 'meaningsEn', 'on', 'kun', 'strokes']) {
        expect(Array.isArray(entry[field]), `${c} ${field}`).toBe(true);
        for (const value of entry[field]) expect(typeof value, `${c} ${field}`).toBe('string');
        expect(new Set(entry[field]).size, `${c} ${field} 중복`).toBe(entry[field].length);
      }
      for (const gloss of entry.meaningsKo) {
        expect(gloss, c).toMatch(/^[가-힣(][가-힣 ()·/ㆍa-zA-Z-]* [가-힣]$/);
      }
      for (const reading of entry.on) expect(reading, c).toMatch(/^[\p{Script=Katakana}ー.\-]+$/u);
      // Unit names such as インチ are valid KANJIDIC kun readings in katakana.
      for (const reading of entry.kun) expect(reading, c).toMatch(/^[\p{Script=Hiragana}\p{Script=Katakana}ー.\-]+$/u);
      expect(entry.strokes.length, c).toBeGreaterThan(0);
    }
  });

  it('발견된 오타·음 누락·잘못된 이체자 대응을 다시 표시하지 않는다', () => {
    const expected = {
      備: '갖출 비', 準: '준할 준', 凖: '준할 준', 強: '강할 강', 答: '대답 답',
      景: '볕 경', 並: '아우를 병', 姉: '손윗누이 자', 鉄: '쇠 철', 顔: '얼굴 안',
      冑: '투구 주', 緲: '아득할 묘', 担: '멜 담', 辮: '땋을 변', 体: '몸 체',
    };
    for (const [c, gloss] of Object.entries(expected)) expect(entries[c].meaningsKo[0], c).toBe(gloss);
    expect(entries['備'].on).toEqual(['ビ']);
    expect(entries['備'].kun).toEqual(['そな.える', 'そな.わる', 'つぶさ.に']);
    expect(entries['備'].strokes).toHaveLength(12);
    expect(entries['準'].on).toEqual(['ジュン']);
    expect(entries['準'].kun).toContain('じゅん.ずる');
    expect(entries['準'].strokes).toHaveLength(13);
  });

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
