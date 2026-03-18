import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, putReview } from '../lib/db';
import { sm2, createInitialReview } from '../lib/sm2';
import FlashCard from './FlashCard';

export default function ReviewSession() {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({ again: 0, hard: 0, good: 0, easy: 0 });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    db.reviews.where('nextReview').belowOrEqual(today).toArray().then(async (dueReviews) => {
      if (dueReviews.length === 0) {
        setDone(true);
        setLoading(false);
        return;
      }
      const wordIds = dueReviews.map(r => r.wordId);
      const words = await db.words.where('id').anyOf(wordIds).toArray();
      setQueue(words.sort(() => Math.random() - 0.5));
      setLoading(false);
    });
  }, []);

  const currentWord = queue[currentIndex];

  async function handleGrade(grade) {
    if (!currentWord) return;

    let review = await db.reviews.get(currentWord.id);
    if (!review) review = createInitialReview(currentWord.id);

    await putReview(sm2(review, grade));
    setResults(prev => ({ ...prev, [grade]: prev[grade] + 1 }));

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDone(true);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (done && queue.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">&#x1F389;</p>
        <p className="text-lg font-medium text-slate-800">복습할 단어가 없습니다</p>
        <p className="text-sm text-slate-400 mt-2">내일 다시 확인해보세요</p>
        <Link to="/" className="text-indigo-600 font-medium text-sm mt-4 inline-block">홈으로</Link>
      </div>
    );
  }

  if (done) {
    const total = results.again + results.hard + results.good + results.easy;
    return (
      <div className="text-center py-12 space-y-6">
        <p className="text-4xl">&#x2705;</p>
        <p className="text-lg font-medium text-slate-800">복습 완료!</p>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-red-500 font-medium">{results.again}</p>
            <p className="text-slate-400">다시</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-orange-500 font-medium">{results.hard}</p>
            <p className="text-slate-400">어려움</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-green-500 font-medium">{results.good}</p>
            <p className="text-slate-400">좋음</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-blue-500 font-medium">{results.easy}</p>
            <p className="text-slate-400">쉬움</p>
          </div>
        </div>
        <p className="text-sm text-slate-400">{total}개 단어 복습 완료</p>
        <Link to="/" className="text-indigo-600 font-medium text-sm inline-block">홈으로</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">복습</h1>
        <span className="text-sm text-slate-400">{currentIndex + 1} / {queue.length}</span>
      </div>

      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      {currentWord && <FlashCard key={currentWord.id} word={currentWord} onGrade={handleGrade} />}
    </div>
  );
}
