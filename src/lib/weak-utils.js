/**
 * 취약 단어(오답노트) 계산 유틸리티
 * DB 접근 없이 순수 함수로 구성하여 테스트 용이성을 확보한다.
 */

/**
 * 단어별 오답률을 계산하고, 취약한 단어를 오답률 내림차순으로 반환한다.
 * @param {Array} words - 전체 단어 배열 (db.words)
 * @param {Array} reviews - 전체 리뷰 배열 (db.reviews)
 * @param {Array} reviewLogs - 전체 리뷰 로그 배열 (db.reviewLogs)
 * @returns {Array<{word: object, review: object, failRate: number, totalReviews: number, againCount: number, hardCount: number}>}
 *   failRate > 0이고 리뷰 로그가 1개 이상인 단어만 포함, failRate 내림차순 정렬
 */
export function calculateWeakWords(words, reviews, reviewLogs) {
  // wordId 기준으로 리뷰 로그를 집계
  const logsByWordId = new Map();
  for (const log of reviewLogs) {
    if (!logsByWordId.has(log.wordId)) {
      logsByWordId.set(log.wordId, []);
    }
    logsByWordId.get(log.wordId).push(log);
  }

  const wordById = new Map(words.map(w => [w.id, w]));
  const reviewByWordId = new Map(reviews.map(r => [r.wordId, r]));

  const result = [];

  for (const [wordId, logs] of logsByWordId) {
    const word = wordById.get(wordId);
    if (!word) continue; // 단어가 삭제된 경우 무시

    const totalReviews = logs.length;
    // ReviewSession에서 grade를 문자열로 저장
    const againCount = logs.filter(l => l.grade === 'again').length;
    const hardCount = logs.filter(l => l.grade === 'hard').length;
    const failRate = (againCount + hardCount) / totalReviews;

    // failRate가 0보다 큰 경우만 취약 단어로 분류
    if (failRate > 0) {
      result.push({
        word,
        review: reviewByWordId.get(wordId) ?? null,
        failRate,
        totalReviews,
        againCount,
        hardCount,
      });
    }
  }

  // 오답률 내림차순 정렬 (동일 오답률이면 총 리뷰 수 내림차순)
  result.sort((a, b) => b.failRate - a.failRate || b.totalReviews - a.totalReviews);

  return result;
}
