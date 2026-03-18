import Dexie from 'dexie';

export const db = new Dexie('j-voca');

db.version(2).stores({
  words: 'id, chapter, textbook, createdAt',
  reviews: 'wordId, nextReview, lastReview',
});

export async function syncWordsFromData(words) {
  await db.transaction('rw', db.words, async () => {
    await db.words.clear();
    if (words?.length) await db.words.bulkPut(words);
  });
}

export async function putReview(review) {
  return db.reviews.put(review);
}

export async function deleteReview(wordId) {
  return db.reviews.delete(wordId);
}

export async function exportData() {
  const words = await db.words.toArray();
  const reviews = await db.reviews.toArray();
  return { words, reviews, exportedAt: new Date().toISOString() };
}

export async function importReviews(reviews) {
  await db.transaction('rw', db.reviews, async () => {
    await db.reviews.clear();
    if (reviews?.length) await db.reviews.bulkPut(reviews);
  });
}

export async function clearAllReviews() {
  await db.reviews.clear();
}

export async function clearAllData() {
  await db.transaction('rw', db.words, db.reviews, async () => {
    await db.words.clear();
    await db.reviews.clear();
  });
}
