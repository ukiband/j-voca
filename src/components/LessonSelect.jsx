import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { getDueCount, getDueCountByLesson, getDueCountByTag, getAllTags } from '../lib/review-utils';

export default function LessonSelect() {
  const [words, setWords] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reverse, setReverse] = useState(() => localStorage.getItem('review-reverse') === 'true');
  // 복습 순서 모드: 랜덤/순차 선호 저장
  const [order, setOrder] = useState(() => localStorage.getItem('review-order') === 'sequential' ? 'sequential' : 'random');

  const loadData = useCallback(async () => {
    const [w, r] = await Promise.all([
      db.words.toArray(),
      db.reviews.toArray(),
    ]);
    setWords(w);
    setReviews(r);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const { total: totalDue, reconfirm: totalReconfirm } = getDueCount(words, reviews);
  const byLesson = getDueCountByLesson(words, reviews);
  const byTag = getDueCountByTag(words, reviews);
  const allTags = getAllTags(words);

  // 전체 lesson 목록 (due 없는 lesson도 포함)
  const chapters = [...new Set(words.map(w => w.chapter))].sort((a, b) => a - b);

  // 쿼리 파라미터에 reverse/order 추가하는 헬퍼
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

  if (words.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-medium text-slate-800">단어가 없습니다</p>
        <Link to="/input" className="text-indigo-600 font-medium text-sm mt-4 inline-block">
          단어 추가하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">복습</h1>
        <div className="flex items-center gap-2">
          {/* 복습 순서 토글: 랜덤/순차 */}
          <button
            onClick={() => setOrder(v => {
              const next = v === 'sequential' ? 'random' : 'sequential';
              localStorage.setItem('review-order', next);
              return next;
            })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              order === 'sequential'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {order === 'sequential' ? '순차' : '랜덤'}
          </button>
          {/* 역방향 토글: 한→일 */}
          <button
            onClick={() => setReverse(v => { const next = !v; localStorage.setItem('review-reverse', String(next)); return next; })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              reverse
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {reverse ? '한→일' : '일→한'}
          </button>
        </div>
      </div>

      {/* 전체 복습 */}
      <Link
        to={reviewPath('/review')}
        className={`block rounded-2xl p-4 shadow-sm ${
          totalDue > 0
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-100 text-slate-400 pointer-events-none'
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

      {/* lesson별 복습 */}
      <div className="space-y-2">
        {chapters.map(ch => {
          const counts = byLesson[ch] || { total: 0, reconfirm: 0 };
          const hasDue = counts.total > 0;
          return (
            <Link
              key={ch}
              to={hasDue ? reviewPath(`/review?lesson=${ch}`) : '#'}
              className={`block rounded-xl p-4 border ${
                hasDue
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-50 border-slate-100 pointer-events-none'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className={`font-medium ${hasDue ? 'text-slate-800' : 'text-slate-400'}`}>
                  Lesson {ch}
                </span>
                <div className="text-right">
                  <span className={`font-bold ${hasDue ? 'text-indigo-600' : 'text-slate-300'}`}>
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

      {/* 카테고리별 복습 */}
      {allTags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">카테고리별</h2>
          <div className="grid grid-cols-2 gap-2">
            {allTags.map(tag => {
              const counts = byTag[tag] || { total: 0, reconfirm: 0 };
              const hasDue = counts.total > 0;
              return (
                <Link
                  key={tag}
                  to={hasDue ? reviewPath(`/review?tag=${encodeURIComponent(tag)}`) : '#'}
                  className={`block rounded-xl p-3 border ${
                    hasDue
                      ? 'bg-white border-slate-200 shadow-sm'
                      : 'bg-slate-50 border-slate-100 pointer-events-none'
                  }`}
                >
                  <p className={`text-sm font-medium ${hasDue ? 'text-slate-800' : 'text-slate-400'}`}>
                    {tag}
                  </p>
                  <p className={`text-lg font-bold ${hasDue ? 'text-indigo-600' : 'text-slate-300'}`}>
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
        <p className="text-center text-sm text-slate-400 py-4">복습할 단어가 없습니다</p>
      )}
    </div>
  );
}
