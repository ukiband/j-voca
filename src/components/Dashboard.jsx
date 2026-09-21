import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../lib/db';
import { getDueCount } from '../lib/review-utils';
import DateTimeQuestion from './DateTimeQuestion';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

export default function Dashboard() {
  const location = useLocation();
  // useLiveQuery 대신 직접 쿼리 — Safari에서 liveQuery 구독이 갱신 안 되는 문제 우회
  const [words, setWords] = useState([]);
  const [reviews, setReviews] = useState([]);

  const loadData = useCallback(async () => {
    const [w, r] = await Promise.all([
      db.words.toArray(),
      db.reviews.toArray(),
    ]);
    setWords(w);
    setReviews(r);
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

  return (
    <div className="space-y-6">
      <DateTimeQuestion key={location.key} />
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">J-VOCA</h1>

      {hasUpdate && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">새 버전이 있습니다</p>
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
        <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 rounded-2xl p-4 relative">
          <button
            onClick={() => { setShowInstall(false); sessionStorage.setItem('hide-install', '1'); }}
            className="absolute top-2 right-3 text-slate-400 text-lg"
          >&times;</button>
          <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-1">홈 화면에 추가하기</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed">
            <strong>iPhone</strong>: Safari 하단 공유(↑) &rarr; "홈 화면에 추가"<br/>
            <strong>Android</strong>: Chrome 메뉴(&#8942;) &rarr; "홈 화면에 추가"<br/>
            앱처럼 전체 화면으로 사용할 수 있습니다.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/70">
          <p className="text-sm text-slate-500 dark:text-slate-400">전체 단어</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{words.length}</p>
        </div>
        <Link to="/lesson-select" className="bg-indigo-600 rounded-2xl p-4 shadow-sm text-white">
          <p className="text-sm text-indigo-200">오늘 복습</p>
          <p className="text-3xl font-bold">{dueCount}</p>
          {reconfirmCount > 0 && <p className="text-xs text-indigo-200 mt-0.5">재확인 {reconfirmCount}</p>}
          {dueCount > 0 && <p className="text-xs text-indigo-200 mt-1">탭하여 시작</p>}
        </Link>
      </div>

      <Link to="/verb-practice" className="block rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-indigo-700 dark:text-indigo-300">동사 활용</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">て형 · ない형 · た형 · 가능형</p>
          </div>
          <span className="text-xl text-indigo-500" aria-hidden="true">→</span>
        </div>
      </Link>

      {words.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg mb-2">아직 단어가 없습니다</p>
          <Link to="/input" className="text-indigo-600 dark:text-indigo-400 font-medium">
            교재 사진으로 단어 추가하기
          </Link>
        </div>
      )}
    </div>
  );
}
