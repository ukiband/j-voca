import { db } from './db';
import { isDue } from './fsrs';

export async function getDueWords() {
  // due 인덱스를 활용하여 현재 시각 이전의 리뷰만 조회
  const now = new Date().toISOString();
  const dueReviews = await db.reviews.where('due').belowOrEqual(now).toArray();
  if (dueReviews.length === 0) return [];

  const wordIds = dueReviews.map(r => r.wordId);
  return db.words.where('id').anyOf(wordIds).toArray();
}

export function getDueCount(words, reviews) {
  const wordIds = new Set(words.map(w => w.id));
  return reviews.filter(r => wordIds.has(r.wordId) && isDue(r)).length;
}
