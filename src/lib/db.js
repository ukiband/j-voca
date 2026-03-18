import Dexie from 'dexie';

export const db = new Dexie('j-voca');

db.version(1).stores({
  words: '++id, chapter, textbook, createdAt',
  reviews: 'wordId, nextReview, lastReview',
});

export async function addWords(words) {
  return db.words.bulkAdd(words, { allKeys: true });
}

export async function updateWord(id, changes) {
  return db.words.update(id, changes);
}

export async function deleteWord(id) {
  await db.words.delete(id);
  await db.reviews.delete(id);
}

export async function putReview(review) {
  return db.reviews.put(review);
}

export async function exportData() {
  const words = await db.words.toArray();
  const reviews = await db.reviews.toArray();
  return { words, reviews, exportedAt: new Date().toISOString() };
}

export async function importData({ words, reviews }) {
  await db.transaction('rw', db.words, db.reviews, async () => {
    await db.words.clear();
    await db.reviews.clear();
    if (words?.length) await db.words.bulkAdd(words);
    if (reviews?.length) await db.reviews.bulkAdd(reviews);
  });
}
