import { useState } from 'react';

export default function FlashCard({ word, onGrade }) {
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    if (!flipped) setFlipped(true);
  }

  function handleGrade(grade) {
    setFlipped(false);
    onGrade(grade);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="card-flip w-full" style={{ minHeight: '240px' }} onClick={handleFlip}>
        <div className={`card-flip-inner relative w-full ${flipped ? 'flipped' : ''}`} style={{ minHeight: '240px' }}>
          {/* Front */}
          <div className="card-front absolute inset-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center p-6">
            <p className="text-4xl font-bold text-slate-800 mb-2">{word.word}</p>
            <p className="text-sm text-slate-400">탭하여 뒤집기</p>
          </div>

          {/* Back */}
          <div className="card-back absolute inset-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center p-6">
            <p className="text-2xl font-bold text-slate-800 mb-1">{word.word}</p>
            <p className="text-xl text-indigo-600 mb-2">{word.reading}</p>
            <p className="text-lg text-slate-600">{word.meaning}</p>
            {word.pos && <p className="text-xs text-slate-400 mt-2">{word.pos}</p>}
          </div>
        </div>
      </div>

      {flipped && (
        <div className="grid grid-cols-4 gap-2 w-full">
          {[
            { grade: 'again', label: '다시', color: 'bg-red-500' },
            { grade: 'hard', label: '어려움', color: 'bg-orange-500' },
            { grade: 'good', label: '좋음', color: 'bg-green-500' },
            { grade: 'easy', label: '쉬움', color: 'bg-blue-500' },
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
    </div>
  );
}
