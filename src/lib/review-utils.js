import { db } from './db';
import { isDue } from './fsrs';

// FSRS State: New=0, Learning=1, Review=2, Relearning=3
// enum import 대신 리터럴 사용 — 번들링 환경 차이에 의한 비교 오류 방지
const LEARNING = 1;
const RELEARNING = 3;

// Learning/Relearning 상태 카드 제외 — 이미 오늘 복습을 시작한 카드
function isNewOrReviewDue(review) {
  return isDue(review) && review.state !== LEARNING && review.state !== RELEARNING;
}

export async function getDueWords() {
  const now = new Date().toISOString();
  const dueReviews = await db.reviews.where('due').belowOrEqual(now).toArray();
  const filtered = dueReviews.filter(r => r.state !== LEARNING && r.state !== RELEARNING);
  if (filtered.length === 0) return [];

  const wordIds = filtered.map(r => r.wordId);
  return db.words.where('id').anyOf(wordIds).toArray();
}

export function getDueCount(words, reviews) {
  const wordIds = new Set(words.map(w => w.id));
  return reviews.filter(r => wordIds.has(r.wordId) && isNewOrReviewDue(r)).length;
}
