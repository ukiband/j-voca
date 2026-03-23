import { fsrs, createEmptyCard, Rating, State } from 'ts-fsrs';

// FSRS 인스턴스 (기본 파라미터 사용)
const f = fsrs();

// grade 문자열을 ts-fsrs Rating으로 매핑 (3등급: 모름/애매/앎)
export const GRADE_MAP = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
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
    // Learning 단계 진행 추적 (ts-fsrs v5)
    learning_steps: card.learning_steps ?? 0,
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
    learning_steps: review.learning_steps ?? 0,
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
 * 로컬 타임존 기준으로 due의 날짜가 오늘 이전이면 true를 반환한다.
 * (시각이 아닌 날짜 단위 비교 — 밤늦게 학습해도 다음날 아침에 복습 가능)
 */
export function isDue(review) {
  const d = new Date(review.due);
  const now = new Date();

  // Learning/Relearning: 시각 단위 비교 (FSRS가 분 단위로 스케줄링)
  if (review.state === 1 || review.state === 3) {
    return d <= now;
  }

  // Review/New: 날짜 단위 비교 (밤늦게 학습해도 다음날 아침에 복습 가능)
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay <= today;
}

export { Rating, State };
