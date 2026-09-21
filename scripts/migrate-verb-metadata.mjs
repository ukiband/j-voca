import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isPracticeVerb } from '../src/lib/verb-utils.js';

const planPath = new URL('./data/verb-metadata-20260921.json', import.meta.url);
export const verbMigrationPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

/** 검토한 173개 항목만 갱신한다. 원문이 달라졌으면 파일을 쓰기 전에 중단한다. 재실행해도 같은 결과다. */
export function migrateVerbMetadata(data, plan = verbMigrationPlan) {
  const byId = new Map(plan.map(entry => [entry.id, entry]));
  return {
    ...data,
    words: data.words.map(word => {
      const entry = byId.get(word.id);
      if (!entry) return word;
      if (word.pos !== '동사' || word.word !== entry.word || word.reading !== entry.reading) {
        throw new Error(`동사 ${word.id}의 원문이 변경되었습니다. 분류를 다시 확인하세요.`);
      }
      const updated = { ...word, verbGroup: entry.verbGroup, isDictionaryForm: entry.isDictionaryForm, potentialAllowed: entry.potentialAllowed };
      if (updated.isDictionaryForm && !isPracticeVerb(updated)) throw new Error(`동사 ${word.id}의 분류·어미 불일치`);
      return updated;
    }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = new URL('../public/data/words.json', import.meta.url);
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const migrated = migrateVerbMetadata(data);
  fs.writeFileSync(path, JSON.stringify(migrated, null, 2) + '\n');
  const verbs = migrated.words.filter(w => w.pos === '동사');
  console.log(`동사 ${verbs.length}개 확인 · 사전형 ${verbs.filter(isPracticeVerb).length}개 · 기존 단어와 학습 기록 유지`);
}
