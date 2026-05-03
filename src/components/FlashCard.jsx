import { useState } from 'react';
import { speak } from '../lib/speech';

export default function FlashCard({ word, onGrade, onPrev, onNext, reverse }) {
  const [flipped, setFlipped] = useState(false);
  const browseMode = !onGrade;

  function handleFlip() {
    if (!flipped) setFlipped(true);
  }

  function handleGrade(grade) {
    setFlipped(false);
    onGrade(grade);
  }

  function handleNav(fn) {
    setFlipped(false);
    fn();
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="card-flip w-full" style={{ minHeight: '450px' }} onClick={handleFlip}>
        <div className={`card-flip-inner relative w-full ${flipped ? 'flipped' : ''}`} style={{ minHeight: '450px' }}>
          {/* Front — reverse 모드에서는 한국어 뜻을 표시 */}
          <div className="card-front absolute inset-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center p-6">
            {reverse ? (
              <>
                <p className="text-3xl font-bold text-slate-800 mb-2">{word.meaning}</p>
                <p className="text-sm text-slate-400">탭하여 뒤집기</p>
              </>
            ) : (
              <>
                <p className="text-4xl font-bold text-slate-800 mb-2">{word.word}</p>
                <p className="text-sm text-slate-400">탭하여 뒤집기</p>
              </>
            )}
          </div>

          {/* Back — reverse 모드에서는 일본어 단어+읽기를 표시 */}
          <div className="card-back absolute inset-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center p-6">
            <p className="text-2xl font-bold text-slate-800 mb-1">{word.word}</p>
            <p className="text-xl text-indigo-600 mb-2">{word.reading}</p>
            <button
              onClick={(e) => { e.stopPropagation(); speak(word.word); }}
              className="text-slate-400 hover:text-indigo-500 transition-colors mb-2"
              aria-label="발음 듣기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
              </svg>
            </button>
            <p className="text-lg text-slate-600">{word.meaning}</p>
            {word.pos && <p className="text-xs text-slate-400 mt-2">{word.pos}</p>}
          </div>
        </div>
      </div>

      {flipped && !browseMode && (
        <div className="grid grid-cols-3 gap-2 w-full">
          {[
            { grade: 'again', label: '모름', color: 'bg-red-500' },
            { grade: 'hard', label: '애매', color: 'bg-orange-400' },
            { grade: 'good', label: '앎', color: 'bg-green-500' },
          ].map(({ grade, label, color }) => (
            <button
              key={grade}
              onClick={() => handleGrade(grade)}
              className={`${color} text-white py-3 rounded-xl text-sm font-medium`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {browseMode && (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => handleNav(onPrev)}
            disabled={!onPrev}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-30"
          >
            ← 이전
          </button>
          <button
            onClick={() => handleNav(onNext)}
            disabled={!onNext}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-30"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
