import { Suspense, lazy } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

const Dashboard = lazy(() => import('./components/Dashboard'));
const WordInput = lazy(() => import('./components/WordInput'));
const WordList = lazy(() => import('./components/WordList'));
const ReviewSession = lazy(() => import('./components/ReviewSession'));
const Settings = lazy(() => import('./components/Settings'));

const NAV_ITEMS = [
  { to: '/', icon: '\u{1F3E0}', label: '\uD648' },
  { to: '/input', icon: '\u{1F4F7}', label: '\uC785\uB825' },
  { to: '/words', icon: '\u{1F4D6}', label: '\uB2E8\uC5B4' },
  { to: '/review', icon: '\u{1F504}', label: '\uBCF5\uC2B5' },
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
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <main className="flex-1 pb-20 px-4 pt-4">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/input" element={<WordInput />} />
            <Route path="/words" element={<WordList />} />
            <Route path="/review" element={<ReviewSession />} />
            <Route path="/settings" element={<Settings />} />
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
