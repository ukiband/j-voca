import { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { fetchWordsData } from './lib/github';
import { openDb, syncWordsFromData, ensureReviewsExist } from './lib/db';

const Dashboard = lazy(() => import('./components/Dashboard'));
const WordInput = lazy(() => import('./components/WordInput'));
const WordList = lazy(() => import('./components/WordList'));
const ReviewSession = lazy(() => import('./components/ReviewSession'));
const Settings = lazy(() => import('./components/Settings'));
const Statistics = lazy(() => import('./components/Statistics'));
const WeakWords = lazy(() => import('./components/WeakWords'));
const LessonSelect = lazy(() => import('./components/LessonSelect'));

const NAV_ITEMS = [
  { to: '/', icon: '\u{1F3E0}', label: '\uD648' },
  { to: '/input', icon: '\u{1F4F7}', label: '\uC785\uB825' },
  { to: '/words', icon: '\u{1F4D6}', label: '\uB2E8\uC5B4' },
  { to: '/lesson-select', icon: '\u{1F504}', label: '\uBCF5\uC2B5' },
  { to: '/settings', icon: '\u2699\uFE0F', label: '\uC124\uC815' },
];

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const loadData = useCallback(async () => {
    setSyncError(null);
    try {
      await openDb();
      try {
        const data = await fetchWordsData();
        if (data.words.length > 0) {
          await syncWordsFromData(data.words);
        }
        await ensureReviewsExist();
      } catch (err) {
        console.error('Data sync error:', err);
        setSyncError(err.message || '데이터 동기화 실패');
      }
      setReady(true);
    } catch (err) {
      console.error('DB open error:', err);
      setSyncError(err.message || 'DB 초기화 실패');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        {syncError ? (
          <div className="text-center px-4">
            <p className="text-sm text-red-600 mb-3">{syncError}</p>
            <button onClick={loadData} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm">재시도</button>
          </div>
        ) : (
          <PageLoader />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <main className="flex-1 pb-24 px-4 pt-4 safe-top">
        {syncError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
            <p className="text-sm text-red-600">{syncError}</p>
            <button onClick={loadData} className="text-xs text-red-600 font-medium ml-2 whitespace-nowrap">재시도</button>
          </div>
        )}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/input" element={<WordInput />} />
            <Route path="/words" element={<WordList />} />
            <Route path="/lesson-select" element={<LessonSelect />} />
            <Route path="/review" element={<ReviewSession />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/stats" element={<Statistics />} />
            <Route path="/weak-words" element={<WeakWords />} />
          </Routes>
        </Suspense>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-bottom">
        <div className="max-w-lg mx-auto flex justify-around">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`
              }
            >
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
