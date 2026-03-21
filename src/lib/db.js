import Dexie from 'dexie';
import { createInitialReview } from './fsrs';
import { createEmptyCard, State } from 'ts-fsrs';

export let db = createDb();

function createDb() {
  const d = new Dexie('j-voca');

  // v2: SM-2 스키마 (기존 사용자 마이그레이션 경로 유지)
  d.version(2).stores({
    words: 'id, chapter, textbook, createdAt',
    reviews: 'wordId, nextReview, lastReview',
  });

  // v3: FSRS 스키마로 마이그레이션
  d.version(3)
    .stores({
      words: 'id, chapter, textbook, createdAt',
      reviews: 'wordId, due, last_review, state',
      reviewLogs: '++id, wordId, review_date, grade',
    })
    .upgrade(async tx => {
      const reviews = await tx.table('reviews').toArray();
      if (reviews.length === 0) return;

      // SM-2 리뷰를 FSRS 형식으로 변환
      const converted = reviews.map(r => {
        const card = createEmptyCard(new Date());

        // easiness(1.3~2.5+)를 difficulty(1~10)로 역매핑
        // easiness가 낮을수록 어려운 카드 -> difficulty가 높아야 함
        const easiness = r.easiness ?? 2.5;
        const difficulty = Math.max(1, Math.min(10, 10 - ((easiness - 1.3) / 1.2) * 9));

        // interval을 stability로 근사 (SM-2의 interval은 FSRS의 stability와 유사한 개념)
        const interval = r.interval ?? 0;
        const stability = interval > 0 ? interval : card.stability;

        // repetitions 기반 state 결정
        const reps = r.repetitions ?? 0;
        const state = reps > 0 ? State.Review : State.New;

        // due 날짜 설정: 기존 nextReview를 사용
        const due = r.nextReview
          ? new Date(r.nextReview + 'T00:00:00').toISOString()
          : new Date().toISOString();

        const lastReview = r.lastReview
          ? new Date(r.lastReview + 'T00:00:00').toISOString()
          : null;

        return {
          wordId: r.wordId,
          due,
          stability,
          difficulty,
          elapsed_days: 0,
          scheduled_days: interval,
          reps,
          lapses: 0,
          state,
          last_review: lastReview,
        };
      });

      // 기존 리뷰 삭제 후 변환된 데이터 삽입
      await tx.table('reviews').clear();
      await tx.table('reviews').bulkPut(converted);
    });

  return d;
}

const SCHEMA_ERRORS = ['VersionError', 'UpgradeError'];

export async function openDb() {
  try {
    await db.open();
  } catch (err) {
    if (SCHEMA_ERRORS.includes(err.name)) {
      await Dexie.delete('j-voca');
      db = createDb();
      await db.open();
    } else {
      throw err;
    }
  }
}

export async function syncWordsFromData(words) {
  await db.transaction('rw', db.words, async () => {
    await db.words.clear();
    if (words?.length) await db.words.bulkPut(words);
  });
}

export async function putReview(review) {
  return db.reviews.put(review);
}

export async function putReviewLog(log) {
  return db.reviewLogs.add(log);
}

export async function deleteReview(wordId) {
  return db.reviews.delete(wordId);
}

export async function exportData() {
  const words = await db.words.toArray();
  const reviews = await db.reviews.toArray();
  const reviewLogs = await db.reviewLogs.toArray();
  return { words, reviews, reviewLogs, exportedAt: new Date().toISOString() };
}

export async function importReviews(reviews, reviewLogs) {
  await db.transaction('rw', db.reviews, db.reviewLogs, async () => {
    await db.reviews.clear();
    if (reviews?.length) await db.reviews.bulkPut(reviews);
    await db.reviewLogs.clear();
    if (reviewLogs?.length) await db.reviewLogs.bulkPut(reviewLogs);
  });
}

export async function ensureReviewsExist() {
  const allWords = await db.words.toArray();
  const existingReviews = await db.reviews.toArray();
  const reviewedIds = new Set(existingReviews.map(r => r.wordId));

  const missing = allWords.filter(w => !reviewedIds.has(w.id));
  if (missing.length > 0) {
    await db.reviews.bulkPut(missing.map(w => createInitialReview(w.id)));
  }
}

export async function clearAllReviews() {
  await db.transaction('rw', db.reviews, db.reviewLogs, async () => {
    await db.reviews.clear();
    await db.reviewLogs.clear();
  });
}

export async function clearAllData() {
  await db.transaction('rw', db.words, db.reviews, db.reviewLogs, async () => {
    await db.words.clear();
    await db.reviews.clear();
    await db.reviewLogs.clear();
  });
}
