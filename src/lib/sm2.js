// SM-2 algorithm implementation
// quality: 0-5 (Again=1, Hard=2, Good=3, Easy=4 mapped to SM-2 scale)

const QUALITY_MAP = {
  again: 1,
  hard: 2,
  good: 4,
  easy: 5,
};

export function mapQuality(grade) {
  return QUALITY_MAP[grade] ?? 3;
}

export function sm2(review, grade) {
  const quality = mapQuality(grade);
  let { easiness, interval, repetitions } = review;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions += 1;
  }

  easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easiness < 1.3) easiness = 1.3;

  const today = new Date();
  const nextReview = new Date(today);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ...review,
    easiness,
    interval,
    repetitions,
    nextReview: nextReview.toISOString().split('T')[0],
    lastReview: today.toISOString().split('T')[0],
  };
}

export function createInitialReview(wordId) {
  const today = new Date().toISOString().split('T')[0];
  return {
    wordId,
    easiness: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: today,
    lastReview: null,
  };
}
