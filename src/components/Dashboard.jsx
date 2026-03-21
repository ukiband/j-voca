import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { getDueCount } from '../lib/review-utils';
import { calculateWeakWords } from '../lib/weak-utils';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

export default function Dashboard() {
  const words = useLiveQuery(() => db.words.toArray(), [], []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), [], []);
  const [showInstall, setShowInstall] = useState(() => !isStandalone() && !sessionStorage.getItem('hide-install'));

  const reviewLogs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);

  const dueCount = getDueCount(words, reviews);
  const weakCount = calculateWeakWords(words, reviews, reviewLogs).length;

  const chapters = [];
  const chapterMap = {};
  for (const w of words) {
    if (!chapterMap[w.chapter]) chapterMap[w.chapter] = { total: 0, reviewed: 0 };
    chapterMap[w.chapter].total++;
  }
  const wordById = new Map(words.map(w => [w.id, w]));
  for (const r of reviews) {
    const word = wordById.get(r.wordId);
    if (word && chapterMap[word.chapter] && r.reps > 0) {
      chapterMap[word.chapter].reviewed++;
    }
  }
  for (const [ch, data] of Object.entries(chapterMap)) {
    chapters.push({ chapter: Number(ch), ...data });
  }
  chapters.sort((a, b) => a.chapter - b.chapter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">J-VOCA</h1>

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
        <Link to="/review" className="bg-indigo-600 rounded-2xl p-4 shadow-sm text-white">
          <p className="text-sm text-indigo-200">오늘 복습</p>
          <p className="text-3xl font-bold">{dueCount}</p>
          {dueCount > 0 && <p className="text-xs text-indigo-200 mt-1">탭하여 시작</p>}
        </Link>
      </div>

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

      {chapters.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-sm font-medium text-slate-500 mb-3">레슨별 진행률</h2>
          <div className="space-y-3">
            {chapters.map(ch => {
              const pct = ch.total > 0 ? Math.round((ch.reviewed / ch.total) * 100) : 0;
              return (
                <div key={ch.chapter}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">Lesson {ch.chapter}</span>
                    <span className="text-slate-400">{ch.reviewed}/{ch.total}</span>
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
