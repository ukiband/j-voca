import { useState, useEffect } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { db } from '../lib/db';
import { gradeCard, createInitialReview } from '../lib/fsrs';
import { getDueWords } from '../lib/review-utils';
import FlashCard from './FlashCard';

export default function ReviewSession() {
  const [params] = useSearchParams();
  const lessonParam = params.get('lesson');
  const tagParam = params.get('tag');
  const reverse = params.get('reverse') === 'true';
  const order = params.get('order');
  // lesson 파라미터가 있으면 해당 lesson만, 없으면 전체 복습
  const chapter = lessonParam != null ? Number(lessonParam) : undefined;
  // 네비게이션마다 고유한 key가 바뀌므로, 같은 경로 재진입 시에도 데이터를 새로 읽음
  const locationKey = useLocation().key;

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [noWords, setNoWords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState({ again: 0, hard: 0, good: 0 });
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    getDueWords(chapter, tagParam).then(words => {
      if (words.length === 0) {
        setNoWords(true);
      } else {
        // 순차 모드: words.json 입력 순서대로 복습 (id 오름차순), 그 외: 랜덤 셔플
        const ordered = order === 'sequential'
          ? [...words].sort((a, b) => a.id - b.id)
          : [...words].sort(() => Math.random() - 0.5);
        setQueue(ordered);
        setWordCount(ordered.length);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('ReviewSession load error:', err);
      setError(err.message || '데이터를 불러올 수 없습니다');
      setLoading(false);
    });
  }, [chapter, tagParam, order, locationKey]);

  const currentWord = queue[currentIndex];
  const done = !loading && queue.length > 0 && currentIndex >= queue.length;

  async function handleGrade(grade) {
    if (!currentWord || saving) return;
    setSaving(true);

    try {
      let review = await db.reviews.get(currentWord.id);
      if (!review) review = createInitialReview(currentWord.id);
      const updated = gradeCard(review, grade);
      // 단일 트랜잭션으로 review와 log를 함께 저장
      await db.transaction('rw', db.reviews, db.reviewLogs, async () => {
        await db.reviews.put(updated);
        await db.reviewLogs.add({
          wordId: currentWord.id,
          review_date: new Date().toISOString(),
          grade,
        });
      });
    } catch (err) {
      console.error('Review save error:', err);
      setSaveError(err.message || '저장 실패');
    }

    setSaving(false);
    setResults(prev => ({ ...prev, [grade]: prev[grade] + 1 }));

    if (grade === 'again') {
      // 모름: 큐 뒤쪽에 재삽입하여 같은 세션에서 다시 복습
      setQueue(prev => [...prev, currentWord]);
    }

    setCurrentIndex(prev => prev + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">&#x26A0;&#xFE0F;</p>
        <p className="text-lg font-medium text-slate-800">데이터 로드 실패</p>
        <p className="text-sm text-slate-400 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm"
        >
          새로고침
        </button>
      </div>
    );
  }

  if (noWords) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">&#x1F389;</p>
        <p className="text-lg font-medium text-slate-800">복습할 단어가 없습니다</p>
        <p className="text-sm text-slate-400 mt-2">내일 다시 확인해보세요</p>
        <Link to="/lesson-select" className="text-indigo-600 font-medium text-sm mt-4 inline-block">돌아가기</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-12 space-y-6">
        <p className="text-4xl">&#x2705;</p>
        <p className="text-lg font-medium text-slate-800">복습 완료!</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-red-500 font-medium">{results.again}</p>
            <p className="text-slate-400">모름</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-orange-400 font-medium">{results.hard}</p>
            <p className="text-slate-400">애매</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-green-500 font-medium">{results.good}</p>
            <p className="text-slate-400">앎</p>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          {chapter != null ? `Lesson ${chapter} · ` : tagParam ? `${tagParam} · ` : ''}{wordCount}개 단어 복습 완료
        </p>
        <Link to="/lesson-select" className="text-indigo-600 font-medium text-sm inline-block">돌아가기</Link>
      </div>
    );
  }

  // 일반 복습 구간과 재복습(again) 구간을 분리하여 진행률 계산
  const isReview = currentIndex < wordCount;
  const progressCurrent = isReview ? currentIndex + 1 : currentIndex - wordCount + 1;
  const progressTotal = isReview ? wordCount : queue.length - wordCount;
  const progressPct = (progressCurrent / progressTotal) * 100;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">
          {chapter != null ? `Lesson ${chapter} 복습` : tagParam ? `${tagParam} 복습` : '복습'}
          {reverse && <span className="text-sm font-normal text-indigo-500 ml-2">한→일</span>}
        </h1>
        <span className="text-sm text-slate-400">
          {isReview
            ? `${progressCurrent} / ${progressTotal}`
            : `재복습 ${progressCurrent} / ${progressTotal}`}
        </span>
      </div>

      {saveError && (
        <p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">저장 오류: {saveError}</p>
      )}

      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {currentWord && <FlashCard key={currentIndex} word={currentWord} onGrade={handleGrade} reverse={reverse} />}
    </div>
  );
}
