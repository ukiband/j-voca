import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { getDueCount } from '../lib/review-utils';
import { calculateStats } from '../lib/stats';
import { calculateWeakWords } from '../lib/weak-utils';
import { getLocalDateString } from '../lib/date-utils';
import { getStep, getSteps, getLatestStep, lessonKey, formatLesson } from '../lib/lesson-utils';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

export default function Dashboard() {
  // useLiveQuery 대신 직접 쿼리 — Safari에서 liveQuery 구독이 갱신 안 되는 문제 우회
  const [words, setWords] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewLogs, setReviewLogs] = useState([]);
  const [todayWordCount, setTodayWordCount] = useState(0);
  // 레슨별 진행률에서 보여줄 step. null이면 "아직 고르지 않음" → 최신 step을 기본으로 쓴다
  const [selectedStep, setSelectedStep] = useState(null);

  const loadData = useCallback(async () => {
    const [w, r, l, todayWords] = await Promise.all([
      db.words.toArray(),
      db.reviews.toArray(),
      db.reviewLogs.toArray(),
      db.words.where('createdAt').equals(getLocalDateString()).count(),
    ]);
    setWords(w);
    setReviews(r);
    setReviewLogs(l);
    setTodayWordCount(todayWords);
  }, []);

  // 마운트 시마다 DB에서 최신 데이터를 직접 읽음
  useEffect(() => { loadData(); }, [loadData]);

  // 새 버전 감지 — version.json과 로컬 빌드 시각 비교
  const [hasUpdate, setHasUpdate] = useState(() => !!window.__HAS_UPDATE__);
  useEffect(() => {
    const handler = () => setHasUpdate(true);
    window.addEventListener('version-updated', handler);
    return () => window.removeEventListener('version-updated', handler);
  }, []);

  const [showInstall, setShowInstall] = useState(() => !isStandalone() && !sessionStorage.getItem('hide-install'));

  const { total: dueCount, reconfirm: reconfirmCount } = getDueCount(words, reviews);
  const { streak, totalReviews, overallAccuracy } = calculateStats(reviewLogs);
  const weakCount = calculateWeakWords(words, reviews, reviewLogs).length;

  // 레슨별 진행률은 (step, chapter) 복합 키로 집계한다.
  // chapter만으로 묶으면 step 2 Lesson 1과 step 1 Lesson 1이 합산되기 때문이다.
  const lessonMap = {};
  for (const w of words) {
    const key = lessonKey(getStep(w), w.chapter);
    if (!lessonMap[key]) lessonMap[key] = { step: getStep(w), chapter: w.chapter, total: 0, reviewed: 0 };
    lessonMap[key].total++;
  }
  const wordById = new Map(words.map(w => [w.id, w]));
  for (const r of reviews) {
    const word = wordById.get(r.wordId);
    if (!word || !(r.reps > 0)) continue;
    const entry = lessonMap[lessonKey(getStep(word), word.chapter)];
    if (entry) entry.reviewed++;
  }

  // 기본은 지금 공부 중인 최신 step만 보여주고, step이 여럿이면 칩으로 전환한다
  const steps = getSteps(words);
  const currentStep = steps.includes(selectedStep) ? selectedStep : getLatestStep(words);
  const lessons = Object.values(lessonMap)
    .filter(l => l.step === currentStep)
    .sort((a, b) => a.chapter - b.chapter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">J-VOCA</h1>

      {hasUpdate && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-emerald-800 mb-1">새 버전이 있습니다</p>
          <button
            onClick={async () => {
              // SW 캐시를 삭제하여 다음 로드 시 최신 파일을 가져오도록 강제
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
              window.location.reload();
            }}
            className="mt-2 px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg"
          >
            지금 업데이트
          </button>
        </div>
      )}

      {showInstall && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 relative">
          <button
            onClick={() => { setShowInstall(false); sessionStorage.setItem('hide-install', '1'); }}
            className="absolute top-2 right-3 text-slate-400 text-lg"
          >&times;</button>
          <p className="text-sm font-medium text-indigo-800 mb-1">홈 화면에 추가하기</p>
          <p className="text-xs text-indigo-600 leading-relaxed">
            <strong>iPhone</strong>: Safari 하단 공유(↑) &rarr; "홈 화면에 추가"<br/>
            <strong>Android</strong>: Chrome 메뉴(&#8942;) &rarr; "홈 화면에 추가"<br/>
            앱처럼 전체 화면으로 사용할 수 있습니다.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">전체 단어</p>
          <p className="text-3xl font-bold text-slate-800">{words.length}</p>
        </div>
        <Link to="/lesson-select" className="bg-indigo-600 rounded-2xl p-4 shadow-sm text-white">
          <p className="text-sm text-indigo-200">오늘 복습</p>
          <p className="text-3xl font-bold">{dueCount}</p>
          {reconfirmCount > 0 && <p className="text-xs text-indigo-200 mt-0.5">재확인 {reconfirmCount}</p>}
          {dueCount > 0 && <p className="text-xs text-indigo-200 mt-1">탭하여 시작</p>}
        </Link>
      </div>

      {/* 학습 통계 카드 */}
      {totalReviews > 0 && (
        <Link
          to="/stats"
          className="block bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 shadow-sm text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-200">학습 통계</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-2xl font-bold">{streak}일 연속</span>
                <span className="text-sm text-blue-200">
                  정확도 {Math.round(overallAccuracy * 100)}%
                </span>
              </div>
            </div>
            <span className="text-2xl text-blue-200">→</span>
          </div>
        </Link>
      )}

      {/* 오답노트 카드 */}
      {weakCount > 0 && (
        <Link to="/weak-words" className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-amber-800">오답노트</p>
              <p className="text-xs text-amber-600 mt-1">취약 단어를 집중 연습하세요</p>
            </div>
            <span className="text-2xl font-bold text-amber-700">{weakCount}</span>
          </div>
        </Link>
      )}

      {/* 듣기 복습 카드 — 오늘 추가된 단어가 있을 때만 표시 */}
      {todayWordCount > 0 && (
        <Link to="/listening" className="block bg-teal-50 border border-teal-200 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-teal-800">자전거 복습</p>
              <p className="text-xs text-teal-600 mt-1">오늘 단어를 들으며 복습하세요</p>
            </div>
            <span className="text-2xl font-bold text-teal-700">{todayWordCount}</span>
          </div>
        </Link>
      )}

      {words.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-medium text-slate-500">레슨별 진행률</h2>
            {steps.length > 1 && (
              <div className="flex gap-1">
                {steps.map(step => (
                  <button
                    key={step}
                    onClick={() => setSelectedStep(step)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      currentStep === step ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    Step {step}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            {lessons.map(ls => {
              const pct = ls.total > 0 ? Math.round((ls.reviewed / ls.total) * 100) : 0;
              return (
                <div key={lessonKey(ls.step, ls.chapter)}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{formatLesson(ls.step, ls.chapter, { withStep: false })}</span>
                    <span className="text-slate-400">{ls.reviewed}/{ls.total}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {words.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg mb-2">아직 단어가 없습니다</p>
          <Link to="/input" className="text-indigo-600 font-medium">
            교재 사진으로 단어 추가하기
          </Link>
        </div>
      )}
    </div>
  );
}
