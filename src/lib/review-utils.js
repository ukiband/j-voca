import { db } from './db';
import { isDue } from './fsrs';

export async function getDueWords() {
  const allReviews = await db.reviews.toArray();
  const dueReviews = allReviews.filter(r => isDue(r));
  if (dueReviews.length === 0) return [];

  const wordIds = dueReviews.map(r => r.wordId);
  return db.words.where('id').anyOf(wordIds).toArray();
}

export function getDueCount(words, reviews) {
  const wordIds = new Set(words.map(w => w.id));
  return reviews.filter(r => wordIds.has(r.wordId) && isDue(r)).length;
}
