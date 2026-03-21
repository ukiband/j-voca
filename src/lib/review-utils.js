import { db } from './db';
import { isDue, State } from './fsrs';

// Learning/Relearning 상태 카드 제외 — 이미 오늘 복습을 시작한 카드
function isNewOrReviewDue(review) {
  return isDue(review) && review.state !== State.Learning && review.state !== State.Relearning;
}

export async function getDueWords() {
  const now = new Date().toISOString();
  const dueReviews = await db.reviews.where('due').belowOrEqual(now).toArray();
  // Learning/Relearning 카드는 복습 세션 내에서 자체 관리
  const filtered = dueReviews.filter(r => r.state !== State.Learning && r.state !== State.Relearning);
  if (filtered.length === 0) return [];

  const wordIds = filtered.map(r => r.wordId);
  return db.words.where('id').anyOf(wordIds).toArray();
}

export function getDueCount(words, reviews) {
  const wordIds = new Set(words.map(w => w.id));
  return reviews.filter(r => wordIds.has(r.wordId) && isNewOrReviewDue(r)).length;
}
