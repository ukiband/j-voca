import { isKanji } from './kanji';
import { getStep, isValidLessonNumber } from './lesson-utils';
import { createInitialReview } from './fsrs';

export function kanjiReviewId(step, chapter, kanjiId) {
  return `kanji:${step}:${chapter}:${kanjiId}`;
}

/** 단어 등록 순서대로 추출한다. 사전 내용은 복제하지 않고 kanjiId로 참조한다. */
export function buildKanjiItems(words) {
  const items = new Map();
  for (const word of [...words].sort((a, b) => a.id - b.id)) {
    const step = getStep(word);
    const chapter = word.chapter;
    if (!isValidLessonNumber(step) || !isValidLessonNumber(chapter)) continue;
    for (const kanjiId of word.word ?? '') {
      if (!isKanji(kanjiId)) continue;
      const id = kanjiReviewId(step, chapter, kanjiId);
      if (!items.has(id)) items.set(id, { id, kanjiId, step, chapter, position: items.size });
    }
  }
  return [...items.values()];
}

/** 처음 만난 한자는 즉시 복습 대상. 실제 기록은 평가할 때 저장한다. */
export function getKanjiReviews(items, reviews) {
  const byId = new Map(reviews.map(review => [review.wordId, review]));
  return items.map(item => byId.get(item.id) ?? createInitialReview(item.id));
}
