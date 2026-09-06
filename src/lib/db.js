import Dexie from 'dexie';
import { createInitialReview } from './fsrs';

export let db = createDb();

function createDb() {
  const d = new Dexie('j-voca');

  d.version(3).stores({
    words: 'id, chapter, textbook, createdAt',
    reviews: 'wordId, due, last_review, state',
    reviewLogs: '++id, wordId, review_date, grade',
  });

  // 예문 테이블. 같은 단어에 날짜별로 예문이 쌓이므로 (wordId, date) 복합 키로 한 건씩 식별하고,
  // 카드에서 "이 단어의 예문 전부"를 뽑기 위해 wordId 인덱스를 둔다. 기존 테이블은 구조 변경이 없어 그대로 이어진다.
  d.version(4).stores({
    sentences: '[wordId+date], wordId',
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

/**
 * sentences.json 전체를 받아 테이블을 통째로 바꾼다. 배치가 삭제된 단어의 예문을 파일에서 지우기도 하므로
 * bulkPut 만 하면 지워진 항목이 남는다. words 동기화와 같은 clear → bulkPut 방식을 쓴다.
 */
export async function syncSentencesFromData(sentences) {
  await db.transaction('rw', db.sentences, async () => {
    await db.sentences.clear();
    if (sentences?.length) await db.sentences.bulkPut(sentences);
  });
}

/** 여러 단어의 예문을 한 번에 읽는다. 복습 큐가 정해진 직후 한 번 호출해 카드마다 DB 를 다시 읽지 않게 한다 */
export async function getSentencesByWordIds(wordIds) {
  if (!wordIds?.length) return [];
  return db.sentences.where('wordId').anyOf(wordIds).toArray();
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
  const sentences = await db.sentences.toArray();
  return { words, reviews, reviewLogs, sentences, exportedAt: new Date().toISOString() };
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
  await db.transaction('rw', db.words, db.reviews, db.reviewLogs, db.sentences, async () => {
    await db.words.clear();
    await db.reviews.clear();
    await db.reviewLogs.clear();
    await db.sentences.clear();
  });
}
