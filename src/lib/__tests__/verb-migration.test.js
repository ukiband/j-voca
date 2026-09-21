import { describe, it, expect } from 'vitest';
import { migrateVerbMetadata, verbMigrationPlan } from '../../../scripts/migrate-verb-metadata.mjs';
import { isPracticeVerb } from '../verb-utils';

const baseline = {
  lastId: 1047,
  words: verbMigrationPlan.map(({ id, word, reading }) => ({ id, word, reading, pos: '동사', meaning: '기존 뜻', step: 1, chapter: 7, createdAt: '2026-03-18' })),
};

describe('검토한 기존 동사 마이그레이션', () => {
  it('143개 사전형만 출제 가능하게 하고 활용형 30개는 제외한다', () => {
    const migrated = migrateVerbMetadata(baseline);
    expect(migrated.words.filter(isPracticeVerb)).toHaveLength(143);
    expect(migrated.words.filter(w => !w.isDictionaryForm)).toHaveLength(30);
    for (const word of migrated.words) {
      const { verbGroup, isDictionaryForm, potentialAllowed, ...original } = word;
      expect(original).toEqual(baseline.words.find(w => w.id === word.id));
    }
    expect(migrated.lastId).toBe(baseline.lastId);
    expect(baseline.words[0]).not.toHaveProperty('verbGroup');
  });

  it('재실행해도 동일하며 이후 추가된 단어나 다른 데이터는 바꾸지 않는다', () => {
    const unknown = { id: 2000, word: '切る', reading: 'きる', pos: '동사' };
    const input = { ...baseline, words: [...baseline.words, unknown], reviews: [{ wordId: 403, due: '2030-01-01' }] };
    const migrated = migrateVerbMetadata(input);
    expect(migrateVerbMetadata(migrated)).toEqual(migrated);
    expect(migrated.words.at(-1)).toBe(unknown);
    expect(migrated.reviews).toBe(input.reviews);
  });

  it('검토 후 원문이 바뀐 항목은 덮어쓰지 않는다', () => {
    expect(() => migrateVerbMetadata({ ...baseline, words: [{ ...baseline.words[0], word: '別の単語' }] })).toThrow('원문이 변경');
  });
});
