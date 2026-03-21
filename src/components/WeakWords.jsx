import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { calculateWeakWords } from '../lib/weak-utils';
import { useBrowseMode } from '../hooks/useBrowseMode';
import FlashCard from './FlashCard';

export default function WeakWords() {
  const words = useLiveQuery(() => db.words.toArray(), [], []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), [], []);
  const reviewLogs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);
  const browse = useBrowseMode();

  const weakWords = calculateWeakWords(words, reviews, reviewLogs);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">오답노트</h1>

      {weakWords.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => browse.open(weakWords.map(w => w.word))}
            className="flex-1 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium"
          >
            취약 단어 연습 ({weakWords.length}개)
          </button>
          <button
            onClick={() => browse.openWithListening(weakWords.map(w => w.word))}
            className="flex-1 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-600 font-medium"
          >
            듣기 모드
          </button>
        </div>
      )}

      {browse.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-hidden touch-none"
          onClick={browse.close}
        >
          <div className="bg-slate-50 rounded-2xl p-4 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">{browse.browseIndex + 1} / {browse.browseQueue.length}</span>
              <div className="flex items-center gap-3">
                {browse.listening ? (
                  <button onClick={browse.stopListening} className="text-emerald-500 text-sm font-medium">■ 정지</button>
                ) : (
                  <button onClick={() => browse.startListening(browse.browseQueue, browse.browseIndex)} className="text-emerald-500 text-sm font-medium">▶ 듣기</button>
                )}
                <button onClick={browse.close} className="text-slate-400 text-lg">&times;</button>
              </div>
            </div>
            <FlashCard
              key={browse.currentWord.id}
              word={browse.currentWord}
              onPrev={browse.prev}
              onNext={browse.next}
            />
          </div>
        </div>
      )}

      {weakWords.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">취약 단어가 없습니다</p>
          <p className="text-sm mt-2">복습을 진행하면 오답 기록이 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {weakWords.map(({ word, review, failRate, totalReviews, againCount, hardCount }) => (
            <div key={word.id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium text-slate-800">{word.word}</span>
                  <span className="text-slate-400 text-sm ml-2">{word.reading}</span>
                  <p className="text-sm text-slate-500">{word.meaning}</p>
                </div>
                {/* 오답률 배지: 비율에 따라 색상 변화 */}
                <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                  failRate >= 0.7 ? 'bg-red-100 text-red-700' :
                  failRate >= 0.4 ? 'bg-amber-100 text-amber-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {Math.round(failRate * 100)}%
                </span>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-slate-400">
                <span>전체 {totalReviews}회</span>
                <span className="text-red-400">again {againCount}</span>
                <span className="text-amber-400">hard {hardCount}</span>
                {review && review.lapses > 0 && (
                  <span className="text-orange-400">lapses {review.lapses}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
