import { fsrs, createEmptyCard, Rating, State } from 'ts-fsrs';

// FSRS 인스턴스 (기본 파라미터 사용)
const f = fsrs();

// grade 문자열을 ts-fsrs Rating으로 매핑
export const GRADE_MAP = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/**
 * FSRS 카드 객체를 DB 저장용 리뷰 객체로 변환
 * Date 객체를 ISO 문자열로 직렬화한다.
 */
function cardToReview(card, wordId) {
  return {
    wordId,
    due: card.due instanceof Date ? card.due.toISOString() : card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review instanceof Date
      ? card.last_review.toISOString()
      : card.last_review ?? null,
  };
}

/**
 * DB 저장용 리뷰 객체를 FSRS 카드 객체로 변환
 * ISO 문자열을 Date 객체로 역직렬화한다.
 */
function reviewToCard(review) {
  return {
    due: new Date(review.due),
    stability: review.stability,
    difficulty: review.difficulty,
    elapsed_days: review.elapsed_days,
    scheduled_days: review.scheduled_days,
    reps: review.reps,
    lapses: review.lapses,
    state: review.state,
    last_review: review.last_review ? new Date(review.last_review) : undefined,
  };
}

/**
 * 복습 결과를 FSRS로 계산하여 업데이트된 리뷰 객체를 반환한다.
 * 입력 review 객체는 변경하지 않는다 (불변성 보장).
 */
export function gradeCard(review, grade) {
  const rating = GRADE_MAP[grade];
  if (rating === undefined) {
    throw new Error(`알 수 없는 grade: ${grade}`);
  }

  const card = reviewToCard(review);
  const now = new Date();
  const result = f.repeat(card, now);
  const updated = result[rating].card;

  return cardToReview(updated, review.wordId);
}

/**
 * 새 단어에 대한 초기 리뷰 객체를 생성한다.
 * due를 현재 시각으로 설정하여 즉시 복습 대상이 된다.
 */
export function createInitialReview(wordId) {
  const card = createEmptyCard(new Date());
  return cardToReview(card, wordId);
}

/**
 * 리뷰가 복습 예정인지 판단한다.
 * due가 현재 시각 이전이면 true를 반환한다.
 */
export function isDue(review) {
  const dueDate = new Date(review.due);
  return dueDate <= new Date();
}

export { Rating, State };
