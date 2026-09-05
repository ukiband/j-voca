import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 실제 public/data/words.json을 읽어 데이터 무결성을 검증한다.
// 단어 추가는 앱에서 GitHub API로 직접 커밋되므로, 스키마가 깨진 채 배포되는 것을 여기서 잡는다.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../../../public/data/words.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const isPositiveInt = v => Number.isInteger(v) && v > 0;

describe('public/data/words.json', () => {
  it('words 배열과 lastId가 있다', () => {
    expect(Array.isArray(data.words)).toBe(true);
    expect(data.words.length).toBeGreaterThan(0);
    expect(Number.isInteger(data.lastId)).toBe(true);
  });

  it('모든 단어에 step이 양의 정수로 들어 있다', () => {
    const bad = data.words.filter(w => !isPositiveInt(w.step));
    expect(bad.map(w => w.id)).toEqual([]);
  });

  it('모든 단어의 chapter가 양의 정수다', () => {
    const bad = data.words.filter(w => !isPositiveInt(w.chapter));
    expect(bad.map(w => w.id)).toEqual([]);
  });

  it('id가 양의 정수이며 중복이 없다', () => {
    const ids = data.words.map(w => w.id);
    expect(ids.every(isPositiveInt)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lastId는 최대 id 이상이다', () => {
    const maxId = Math.max(...data.words.map(w => w.id));
    expect(data.lastId).toBeGreaterThanOrEqual(maxId);
  });
});
