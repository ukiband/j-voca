import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db, putReview, putReviewLog } from '../lib/db';
import { gradeCard, createInitialReview } from '../lib/fsrs';
import { getDueWords } from '../lib/review-utils';
import { checkAnswer } from '../lib/writing-utils';
import { shuffle } from '../lib/shuffle';

export default function WritingMode() {
  const [mode, setMode] = useState(null); // 'due' | 'all'
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null); // { correct, expected, reading }
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // 모드 선택 후 단어 로드
  useEffect(() => {
    if (!mode) return;
    setLoading(true);
    setError(null);

    const loadWords = mode === 'due'
      ? getDueWords()
      : db.words.toArray();

    loadWords.then(words => {
      if (words.length === 0) {
        setDone(true);
      } else {
        setQueue(shuffle(words));
      }
      setLoading(false);
    }).catch(err => {
      console.error('WritingMode load error:', err);
      setError(err.message || '단어를 불러올 수 없습니다');
      setLoading(false);
    });
  }, [mode]);

  // 새 문제가 나타나면 입력 필드에 포커스
  useEffect(() => {
    if (!result && !done && mode && !loading) {
      inputRef.current?.focus();
    }
  }, [currentIndex, result, done, mode, loading]);

  const currentWord = queue[currentIndex];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentWord || result) return;

    const answer = checkAnswer(input, currentWord);
    setResult(answer);
    setScore(prev => ({
      correct: prev.correct + (answer.correct ? 1 : 0),
      total: prev.total + 1,
    }));

    // 복습 예정 단어 모드일 때만 FSRS 채점 수행
    if (mode === 'due') {
      try {
        let review = await db.reviews.get(currentWord.id);
        if (!review) review = createInitialReview(currentWord.id);
        // 정답이면 good, 오답이면 again으로 채점
        const grade = answer.correct ? 'good' : 'again';
        const updated = gradeCard(review, grade);
        await putReview(updated);
        await putReviewLog({
          wordId: currentWord.id,
          review_date: new Date().toISOString(),
          grade,
        });
      } catch (err) {
        console.error('FSRS grade error:', err);
      }
    }
  }

  function handleNext() {
    setResult(null);
    setInput('');
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDone(true);
    }
  }

  // 모드 선택 화면
  if (!mode) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">쓰기 연습</h1>
        <p className="text-sm text-slate-500">뜻을 보고 일본어를 직접 입력하세요.</p>
        <div className="space-y-3">
          <button
            onClick={() => setMode('due')}
            className="w-full p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left"
          >
            <p className="font-medium text-amber-800">복습 예정 단어</p>
            <p className="text-sm text-amber-600 mt-1">오늘 복습할 단어로 쓰기 연습</p>
          </button>
          <button
            onClick={() => setMode('all')}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left"
          >
            <p className="font-medium text-slate-800">전체 단어</p>
            <p className="text-sm text-slate-500 mt-1">등록된 모든 단어로 쓰기 연습</p>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
          className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm"
        >
          새로고침
        </button>
      </div>
    );
  }

  // 완료 화면
  if (done) {
    if (queue.length === 0) {
      return (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">&#x1F4DD;</p>
          <p className="text-lg font-medium text-slate-800">
            {mode === 'due' ? '복습할 단어가 없습니다' : '등록된 단어가 없습니다'}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            {mode === 'due' ? '내일 다시 확인해보세요' : '단어를 먼저 추가해주세요'}
          </p>
          <Link to="/" className="text-amber-600 font-medium text-sm mt-4 inline-block">홈으로</Link>
        </div>
      );
    }

    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="text-center py-12 space-y-6">
        <p className="text-4xl">&#x2705;</p>
        <p className="text-lg font-medium text-slate-800">쓰기 연습 완료!</p>
        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">{score.correct}</p>
            <p className="text-sm text-slate-500">정답</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-red-500">{score.total - score.correct}</p>
            <p className="text-sm text-slate-500">오답</p>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          {score.total}개 중 {score.correct}개 정답 ({pct}%)
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              setMode(null);
              setQueue([]);
              setCurrentIndex(0);
              setScore({ correct: 0, total: 0 });
              setDone(false);
              setResult(null);
              setInput('');
            }}
            className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm"
          >
            다시 하기
          </button>
          <Link to="/" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm">
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  // 문제 풀기 화면
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">쓰기 연습</h1>
        <span className="text-sm text-slate-400">{currentIndex + 1} / {queue.length}</span>
      </div>

      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      {currentWord && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          {/* 뜻과 품사를 힌트로 표시 */}
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800">{currentWord.meaning}</p>
            {currentWord.pos && (
              <p className="text-sm text-slate-400 mt-1">{currentWord.pos}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={!!result}
              placeholder="일본어를 입력하세요"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center text-lg
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
                disabled:bg-slate-50 disabled:text-slate-400"
              autoComplete="off"
              autoCapitalize="off"
              lang="ja"
            />
            {!result && (
              <button
                type="submit"
                className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium
                  hover:bg-amber-600 transition-colors"
              >
                확인
              </button>
            )}
          </form>

          {/* 결과 표시 */}
          {result && (
            <div className={`rounded-xl p-4 ${result.correct ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-center font-bold text-lg ${result.correct ? 'text-green-600' : 'text-red-600'}`}>
                {result.correct ? '정답!' : '오답'}
              </p>
              {!result.correct && (
                <div className="text-center mt-2 space-y-1">
                  <p className="text-slate-700">
                    <span className="text-sm text-slate-500">정답: </span>
                    <span className="font-bold text-lg">{result.expected}</span>
                  </p>
                  {result.reading && result.reading !== result.expected && (
                    <p className="text-sm text-slate-500">읽기: {result.reading}</p>
                  )}
                </div>
              )}
              <button
                onClick={handleNext}
                className="w-full mt-3 py-3 bg-slate-800 text-white rounded-xl font-medium
                  hover:bg-slate-900 transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
