import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { loadReviewData, getDueCount, getDueCountByLesson, getDueCountByTag, getAllTags } from '../lib/review-utils';
import { getSteps, getChapters, lessonKey, formatLesson } from '../lib/lesson-utils';

export default function LessonSelect({ kind = 'words' }) {
  const location = useLocation();
  return <Selection key={`${kind}:${location.key}`} kind={kind} />;
}

function Selection({ kind }) {
  const isKanji = kind === 'kanji';
  const reviewBase = isKanji ? '/kanji/review' : '/review';
  const preferenceKey = isKanji ? 'kanji-review' : 'review';
  const homeLink = isKanji && <Link to="/" className="inline-block text-sm text-slate-500 dark:text-slate-400">← 홈</Link>;
  const [words, setWords] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reverse, setReverse] = useState(() => localStorage.getItem(`${preferenceKey}-reverse`) === 'true');
  const [order, setOrder] = useState(() => localStorage.getItem(`${preferenceKey}-order`) === 'sequential' ? 'sequential' : 'random');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    loadReviewData(kind).then(({ items, reviews: rows }) => {
      if (!active) return;
      setWords(items);
      setReviews(rows);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, attempt]);

  const { total: totalDue, reconfirm: totalReconfirm } = getDueCount(words, reviews);
  const byLesson = getDueCountByLesson(words, reviews);
  const byTag = getDueCountByTag(words, reviews);
  const allTags = getAllTags(words);

  // step 목록을 내림차순으로 — 지금 공부 중인 최신 step 섹션이 화면 위에 오도록
  const steps = getSteps(words).reverse();

  const reviewPath = (base) => {
    let path = base;
    if (reverse) {
      path += `${path.includes('?') ? '&' : '?'}reverse=true`;
    }
    if (order === 'sequential') {
      path += `${path.includes('?') ? '&' : '?'}order=sequential`;
    }
    return path;
  };

  if (loading) return <p className="text-center py-16 text-slate-500 dark:text-slate-400" role="status">복습 대상을 불러오는 중…</p>;

  if (error) return <div className="space-y-4">
    {homeLink}
    <p role="alert">복습 대상을 불러오지 못했어요.</p>
    <button onClick={() => setAttempt(value => value + 1)} className="text-indigo-600 dark:text-indigo-400">다시 시도</button>
  </div>;

  if (words.length === 0) {
    return (
      <div className="space-y-4">
        {homeLink}
        <div className="text-center py-16">
          <p className="text-lg font-medium text-slate-800 dark:text-slate-100">{isKanji ? '등록한 단어에 한자가 없습니다' : '단어가 없습니다'}</p>
          <Link to={isKanji ? '/words' : '/input'} className="text-indigo-600 dark:text-indigo-400 font-medium text-sm mt-4 inline-block">
            {isKanji ? '단어 목록 보기' : '단어 추가하기'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {homeLink}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{isKanji ? '한자 복습' : '복습'}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOrder(v => {
              const next = v === 'sequential' ? 'random' : 'sequential';
              localStorage.setItem(`${preferenceKey}-order`, next);
              return next;
            })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              order === 'sequential'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {order === 'sequential' ? '순차' : '랜덤'}
          </button>
          <button
            onClick={() => setReverse(v => { const next = !v; localStorage.setItem(`${preferenceKey}-reverse`, String(next)); return next; })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              reverse
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {isKanji ? (reverse ? '뜻 → 한자' : '한자 → 뜻') : (reverse ? '한→일' : '일→한')}
          </button>
        </div>
      </div>

      <Link
        to={reviewPath(reviewBase)}
        aria-disabled={totalDue === 0}
        onClick={event => { if (!totalDue) event.preventDefault(); }}
        className={`block rounded-2xl p-4 shadow-sm ${
          totalDue > 0
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 pointer-events-none'
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm opacity-70">전체 복습</p>
            <p className="text-2xl font-bold">{totalDue}개</p>
            {totalReconfirm > 0 && (
              <p className="text-xs opacity-70 mt-0.5">재확인 {totalReconfirm}</p>
            )}
          </div>
          {totalDue > 0 && <span className="text-2xl opacity-70">→</span>}
        </div>
      </Link>

      {/* step별 섹션 안의 lesson 카드 (due 없는 lesson도 포함) */}
      {steps.map(step => {
        // step 과 마찬가지로 최신 레슨이 위에 오도록 내림차순. getChapters 는 다른 화면이 오름차순으로 쓰므로 여기서만 뒤집는다
        const chapters = getChapters(words, step).reverse();
        return (
          <div key={step} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Step {step}</h2>
            {chapters.map(ch => {
              const counts = byLesson[lessonKey(step, ch)] || { total: 0, reconfirm: 0 };
              const hasDue = counts.total > 0;
              return (
                <Link
                  key={ch}
                  to={hasDue ? reviewPath(`${reviewBase}?step=${step}&lesson=${ch}`) : '#'}
                  aria-disabled={!hasDue}
                  onClick={event => { if (!hasDue) event.preventDefault(); }}
                  className={`block rounded-xl p-4 border ${
                    hasDue
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/70 pointer-events-none'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${hasDue ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                      {formatLesson(step, ch, { withStep: false })}
                    </span>
                    <div className="text-right">
                      <span className={`font-bold ${hasDue ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-500'}`}>
                        {counts.total}개
                      </span>
                      {counts.reconfirm > 0 && (
                        <p className="text-xs text-slate-400">재확인 {counts.reconfirm}</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        );
      })}

      {allTags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">카테고리별</h2>
          <div className="grid grid-cols-2 gap-2">
            {allTags.map(tag => {
              const counts = byTag[tag] || { total: 0, reconfirm: 0 };
              const hasDue = counts.total > 0;
              return (
                <Link
                  key={tag}
                  to={hasDue ? reviewPath(`${reviewBase}?tag=${encodeURIComponent(tag)}`) : '#'}
                  className={`block rounded-xl p-3 border ${
                    hasDue
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/70 pointer-events-none'
                  }`}
                >
                  <p className={`text-sm font-medium ${hasDue ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                    {tag}
                  </p>
                  <p className={`text-lg font-bold ${hasDue ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-500'}`}>
                    {counts.total}개
                  </p>
                  {counts.reconfirm > 0 && (
                    <p className="text-xs text-slate-400">재확인 {counts.reconfirm}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {totalDue === 0 && (
        <p className="text-center text-sm text-slate-400 py-4">복습할 {isKanji ? '한자가' : '단어가'} 없습니다</p>
      )}
    </div>
  );
}
