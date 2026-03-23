import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gradeCard, createInitialReview, isDue, GRADE_MAP, Rating, State } from '../fsrs';

const FIXED_DATE = new Date('2026-03-19T12:00:00Z');

beforeEach(() => {
  vi.setSystemTime(FIXED_DATE);
});

afterEach(() => {
  vi.setSystemTime(vi.getRealSystemTime());
});

describe('GRADE_MAP', () => {
  it('각 grade 문자열을 ts-fsrs Rating으로 매핑 (3등급)', () => {
    expect(GRADE_MAP.again).toBe(Rating.Again);
    expect(GRADE_MAP.hard).toBe(Rating.Hard);
    expect(GRADE_MAP.good).toBe(Rating.Good);
    expect(GRADE_MAP.easy).toBeUndefined();
  });

  it('Rating 값이 올바른 숫자', () => {
    expect(GRADE_MAP.again).toBe(1);
    expect(GRADE_MAP.hard).toBe(2);
    expect(GRADE_MAP.good).toBe(3);
  });
});

describe('createInitialReview', () => {
  it('올바른 구조의 초기 리뷰 객체를 생성', () => {
    const review = createInitialReview(42);

    expect(review.wordId).toBe(42);
    expect(review).toHaveProperty('due');
    expect(review).toHaveProperty('stability');
    expect(review).toHaveProperty('difficulty');
    expect(review).toHaveProperty('elapsed_days');
    expect(review).toHaveProperty('scheduled_days');
    expect(review).toHaveProperty('reps');
    expect(review).toHaveProperty('lapses');
    expect(review).toHaveProperty('state');
    expect(review).toHaveProperty('last_review');
  });

  it('초기 상태는 New(0)', () => {
    const review = createInitialReview(1);
    expect(review.state).toBe(State.New);
  });

  it('초기 reps와 lapses는 0', () => {
    const review = createInitialReview(1);
    expect(review.reps).toBe(0);
    expect(review.lapses).toBe(0);
  });

  it('due가 ISO 문자열 형식', () => {
    const review = createInitialReview(1);
    // ISO 문자열로 파싱 가능한지 확인
    expect(() => new Date(review.due)).not.toThrow();
    expect(new Date(review.due).toISOString()).toBe(review.due);
  });
});

describe('isDue', () => {
  it('due가 오늘 날짜이면 true', () => {
    const review = createInitialReview(1);
    // 초기 카드의 due는 현재 시각 -> 같은 날이므로 true
    expect(isDue(review)).toBe(true);
  });

  it('due가 미래 날짜면 false', () => {
    const review = createInitialReview(1);
    review.due = new Date('2099-12-31T00:00:00Z').toISOString();
    expect(isDue(review)).toBe(false);
  });

  it('due가 정확히 오늘이면 true', () => {
    const review = createInitialReview(1);
    review.due = FIXED_DATE.toISOString();
    expect(isDue(review)).toBe(true);
  });

  it('due가 어제면 true', () => {
    const review = createInitialReview(1);
    review.due = new Date('2026-03-18T23:59:59Z').toISOString();
    expect(isDue(review)).toBe(true);
  });

  it('due가 내일이면 false', () => {
    const review = createInitialReview(1);
    const tomorrow = new Date(FIXED_DATE);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    review.due = tomorrow.toISOString();
    expect(isDue(review)).toBe(false);
  });

  it('due가 오늘 늦은 시각이어도 true (날짜 기준)', () => {
    const review = createInitialReview(1);
    const laterToday = new Date(FIXED_DATE);
    laterToday.setHours(23, 59, 59, 0);
    review.due = laterToday.toISOString();
    expect(isDue(review)).toBe(true);
  });

  it('Learning 상태: due가 미래 시각이면 false', () => {
    const review = createInitialReview(1);
    review.state = 1; // Learning
    const tenMinLater = new Date(FIXED_DATE.getTime() + 10 * 60 * 1000);
    review.due = tenMinLater.toISOString();
    expect(isDue(review)).toBe(false);
  });

  it('Learning 상태: due가 과거 시각이면 true', () => {
    const review = createInitialReview(1);
    review.state = 1; // Learning
    const oneMinAgo = new Date(FIXED_DATE.getTime() - 60 * 1000);
    review.due = oneMinAgo.toISOString();
    expect(isDue(review)).toBe(true);
  });

  it('Relearning 상태: due가 미래 시각이면 false', () => {
    const review = createInitialReview(1);
    review.state = 3; // Relearning
    const fiveMinLater = new Date(FIXED_DATE.getTime() + 5 * 60 * 1000);
    review.due = fiveMinLater.toISOString();
    expect(isDue(review)).toBe(false);
  });

  it('Review 상태: due가 오늘 늦은 시각이어도 true (날짜 기준)', () => {
    const review = createInitialReview(1);
    review.state = 2; // Review
    const laterToday = new Date(FIXED_DATE);
    laterToday.setHours(23, 59, 59, 0);
    review.due = laterToday.toISOString();
    expect(isDue(review)).toBe(true);
  });
});

describe('gradeCard', () => {
  function makeNewReview(wordId = 1) {
    return createInitialReview(wordId);
  }

  it('again으로 채점하면 유효한 리뷰 반환', () => {
    const review = makeNewReview();
    const result = gradeCard(review, 'again');

    expect(result.wordId).toBe(1);
    expect(result).toHaveProperty('due');
    expect(result).toHaveProperty('stability');
    expect(result).toHaveProperty('difficulty');
    expect(result).toHaveProperty('state');
  });

  it('hard로 채점하면 유효한 리뷰 반환', () => {
    const result = gradeCard(makeNewReview(), 'hard');
    expect(result.wordId).toBe(1);
    expect(result.reps).toBe(1);
  });

  it('good으로 채점하면 유효한 리뷰 반환', () => {
    const result = gradeCard(makeNewReview(), 'good');
    expect(result.wordId).toBe(1);
    expect(result.reps).toBe(1);
  });

  it('easy는 지원하지 않으므로 에러 발생', () => {
    expect(() => gradeCard(makeNewReview(), 'easy')).toThrow('알 수 없는 grade');
  });

  it('알 수 없는 grade는 에러 발생', () => {
    expect(() => gradeCard(makeNewReview(), 'unknown')).toThrow('알 수 없는 grade');
  });

  it('연속 good 채점 시 interval이 증가', () => {
    let review = makeNewReview();

    review = gradeCard(review, 'good');
    const firstScheduled = review.scheduled_days;

    review = gradeCard(review, 'good');
    const secondScheduled = review.scheduled_days;

    review = gradeCard(review, 'good');
    const thirdScheduled = review.scheduled_days;

    // FSRS에서 연속 good은 점진적으로 간격이 늘어남
    expect(thirdScheduled).toBeGreaterThanOrEqual(secondScheduled);
  });

  it('again은 lapses를 증가시키고 state를 변경', () => {
    let review = makeNewReview();

    // Review 상태로 전환: good 반복으로 Learning→Review 졸업
    // Learning 카드의 due가 미래이므로 시간을 due 시점으로 진행
    review = gradeCard(review, 'good');
    vi.setSystemTime(new Date(review.due));
    review = gradeCard(review, 'good');
    expect(review.state).toBe(State.Review);

    const lapsesBefore = review.lapses;
    review = gradeCard(review, 'again');

    // again 후 lapses 증가
    expect(review.lapses).toBe(lapsesBefore + 1);
    // again 후 state가 Relearning으로 변경
    expect(review.state).toBe(State.Relearning);
  });

  it('입력 review 객체를 변경하지 않음 (불변성)', () => {
    const original = makeNewReview();
    const frozen = { ...original };
    gradeCard(original, 'good');
    expect(original).toEqual(frozen);
  });

  it('due와 last_review가 ISO 문자열로 저장', () => {
    const result = gradeCard(makeNewReview(), 'good');
    // ISO 문자열 형식 확인
    expect(typeof result.due).toBe('string');
    expect(() => new Date(result.due)).not.toThrow();
    expect(typeof result.last_review).toBe('string');
    expect(() => new Date(result.last_review)).not.toThrow();
  });

  it('wordId가 보존됨', () => {
    const review = createInitialReview(999);
    const result = gradeCard(review, 'good');
    expect(result.wordId).toBe(999);
  });
});
