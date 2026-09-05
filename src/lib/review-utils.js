import { db } from './db';
import { isDue } from './fsrs';
import { getStep, lessonKey } from './lesson-utils';

/**
 * 복습 대상 단어를 반환한다.
 * (step, chapter)와 tag는 상호 배타적이다. chapter를 지정하면 해당 lesson만, tag를 지정하면 해당 태그만 필터링한다.
 * step 2부터 chapter 번호가 1부터 다시 시작하므로 lesson 필터는 step과 chapter를 함께 비교한다.
 * step이 null이면 1로 간주한다 (step 도입 전 URL/데이터 호환).
 */
export async function getDueWords(step, chapter, tag) {
  const allReviews = await db.reviews.toArray();
  const dueReviews = allReviews.filter(r => isDue(r));
  if (dueReviews.length === 0) return [];

  const wordIds = dueReviews.map(r => r.wordId);
  const words = await db.words.where('id').anyOf(wordIds).toArray();

  if (chapter != null) {
    const targetStep = step ?? 1;
    return words.filter(w => getStep(w) === targetStep && w.chapter === chapter);
  }
  if (tag != null) return words.filter(w => w.tags && w.tags.includes(tag));
  return words;
}

export function getDueCount(words, reviews) {
  const wordIds = new Set(words.map(w => w.id));
  const dueReviews = reviews.filter(r => wordIds.has(r.wordId) && isDue(r));
  // Learning/Relearning(state 1,3)은 재확인 카드, 나머지는 일반 복습 카드
  const reconfirmCount = dueReviews.filter(r => r.state === 1 || r.state === 3).length;
  return { total: dueReviews.length, reconfirm: reconfirmCount };
}

/**
 * lesson별 due 카운트를 반환한다.
 * { [lessonKey(step, chapter)]: { step, chapter, total, reconfirm } } 형태.
 * 키를 chapter만으로 잡으면 step이 다른 같은 번호 레슨이 합산되므로 (step, chapter) 복합 키를 쓴다.
 * step/chapter를 값에도 넣어 두어 소비 측이 키 문자열을 다시 파싱하지 않아도 되게 한다.
 */
export function getDueCountByLesson(words, reviews) {
  const reviewByWordId = new Map(reviews.map(r => [r.wordId, r]));
  const result = {};

  for (const w of words) {
    const r = reviewByWordId.get(w.id);
    if (!r || !isDue(r)) continue;

    const step = getStep(w);
    const key = lessonKey(step, w.chapter);
    if (!result[key]) result[key] = { step, chapter: w.chapter, total: 0, reconfirm: 0 };
    result[key].total++;
    if (r.state === 1 || r.state === 3) result[key].reconfirm++;
  }

  return result;
}

/**
 * 태그별 due 카운트를 반환한다.
 * { [tag]: { total, reconfirm } } 형태.
 */
export function getDueCountByTag(words, reviews) {
  const reviewByWordId = new Map(reviews.map(r => [r.wordId, r]));
  const result = {};

  for (const w of words) {
    if (!w.tags) continue;
    const r = reviewByWordId.get(w.id);
    if (!r || !isDue(r)) continue;

    for (const tag of w.tags) {
      if (!result[tag]) result[tag] = { total: 0, reconfirm: 0 };
      result[tag].total++;
      if (r.state === 1 || r.state === 3) result[tag].reconfirm++;
    }
  }

  return result;
}

/**
 * words에서 사용 중인 모든 태그를 추출한다.
 */
export function getAllTags(words) {
  const tags = new Set();
  for (const w of words) {
    if (w.tags) w.tags.forEach(t => tags.add(t));
  }
  return [...tags];
}
