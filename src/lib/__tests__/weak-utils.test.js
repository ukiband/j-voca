import { describe, it, expect } from 'vitest';
import { calculateWeakWords } from '../weak-utils';

const words = [
  { id: 'w1', chapter: 1, word: '食べる', reading: 'たべる', meaning: '먹다' },
  { id: 'w2', chapter: 1, word: '飲む', reading: 'のむ', meaning: '마시다' },
  { id: 'w3', chapter: 2, word: '走る', reading: 'はしる', meaning: '달리다' },
  { id: 'w4', chapter: 2, word: '歩く', reading: 'あるく', meaning: '걷다' },
];

const reviews = [
  { wordId: 'w1', due: '2026-01-01T00:00:00.000Z', lapses: 3, reps: 5, state: 2 },
  { wordId: 'w2', due: '2026-01-01T00:00:00.000Z', lapses: 0, reps: 4, state: 2 },
  { wordId: 'w3', due: '2026-01-01T00:00:00.000Z', lapses: 1, reps: 3, state: 2 },
  { wordId: 'w4', due: '2026-01-01T00:00:00.000Z', lapses: 0, reps: 0, state: 0 },
];

// ReviewSession에서 grade를 문자열로 저장 ('again', 'hard', 'good', 'easy')
function log(wordId, grade) {
  return { id: Math.random(), wordId, review_date: '2026-01-01', grade };
}

describe('calculateWeakWords', () => {
  it('모든 응답이 good/easy이면 취약 단어 없음', () => {
    const logs = [
      log('w1', 'good'), log('w1', 'easy'), // good, easy
      log('w2', 'good'), log('w2', 'good'), // good, good
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(0);
  });

  it('모든 응답이 again이면 failRate 1.0', () => {
    const logs = [
      log('w1', 'again'), log('w1', 'again'), log('w1', 'again'), // again 3회
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(1);
    expect(result[0].word.id).toBe('w1');
    expect(result[0].failRate).toBe(1);
    expect(result[0].againCount).toBe(3);
    expect(result[0].hardCount).toBe(0);
    expect(result[0].totalReviews).toBe(3);
  });

  it('again과 hard 혼합 시 올바른 failRate 계산', () => {
    const logs = [
      log('w1', 'again'), // again
      log('w1', 'hard'), // hard
      log('w1', 'good'), // good
      log('w1', 'easy'), // easy
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(1);
    expect(result[0].failRate).toBe(0.5); // 2/4
    expect(result[0].againCount).toBe(1);
    expect(result[0].hardCount).toBe(1);
  });

  it('리뷰 로그가 없는 단어는 제외', () => {
    const logs = [
      log('w1', 'again'), // w1만 로그 있음
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(1);
    expect(result[0].word.id).toBe('w1');
  });

  it('failRate 내림차순 정렬 (가장 취약한 단어가 먼저)', () => {
    const logs = [
      log('w1', 'again'), log('w1', 'good'),         // w1: failRate = 0.5
      log('w2', 'again'), log('w2', 'again'), log('w2', 'good'), // w2: failRate = 0.667
      log('w3', 'hard'), log('w3', 'good'), log('w3', 'good'), log('w3', 'good'), // w3: failRate = 0.25
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(3);
    expect(result[0].word.id).toBe('w2'); // 0.667
    expect(result[1].word.id).toBe('w1'); // 0.5
    expect(result[2].word.id).toBe('w3'); // 0.25
  });

  it('동일 failRate이면 총 리뷰 수가 많은 단어가 먼저', () => {
    const logs = [
      log('w1', 'again'), log('w1', 'good'),                         // w1: 1/2 = 0.5
      log('w2', 'again'), log('w2', 'again'), log('w2', 'good'), log('w2', 'good'), // w2: 2/4 = 0.5
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(2);
    expect(result[0].word.id).toBe('w2'); // 리뷰 4회
    expect(result[1].word.id).toBe('w1'); // 리뷰 2회
  });

  it('failRate 0인 단어는 제외', () => {
    const logs = [
      log('w1', 'good'), log('w1', 'easy'), // 모두 good/easy
      log('w2', 'again'),                // again 1회
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(1);
    expect(result[0].word.id).toBe('w2');
  });

  it('빈 입력 시 빈 배열 반환', () => {
    expect(calculateWeakWords([], [], [])).toEqual([]);
  });

  it('words에 없는 wordId의 로그는 무시', () => {
    const logs = [
      log('deleted-word', 'again'), log('deleted-word', 'again'),
    ];
    const result = calculateWeakWords(words, reviews, logs);
    expect(result).toHaveLength(0);
  });

  it('review가 없는 단어도 포함 (review는 null)', () => {
    const logsOnly = [
      log('w4', 'again'), // w4에는 review가 있지만, review가 없는 경우를 테스트
    ];
    // review 목록에서 w4를 제외
    const partialReviews = reviews.filter(r => r.wordId !== 'w4');
    const result = calculateWeakWords(words, partialReviews, logsOnly);
    expect(result).toHaveLength(1);
    expect(result[0].word.id).toBe('w4');
    expect(result[0].review).toBeNull();
  });
});
