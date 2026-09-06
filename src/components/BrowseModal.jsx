import { useState, useEffect, useRef } from 'react';
import FlashCard from './FlashCard';
import { getSentencesByWordIds } from '../lib/db';
import { filterUsableSentences, pickSentence } from '../lib/sentence-utils';
import { getKstDateString } from '../lib/date-utils';

/**
 * 단어 열람 바텀시트. 상단(순번·듣기·닫기)과 하단(이전·다음)은 고정하고 가운데 카드만 스크롤한다.
 * 예문이 들어가면 작은 화면에서 내용이 넘치는데, 예전처럼 모달 전체를 가운데 정렬하면 닫기·이동 버튼이 화면 밖으로 밀리기 때문이다.
 * 듣기 모드는 단어만 읽고 3초 간격으로 다음 단어로 넘어간다. 예문 길이는 그 간격에 영향을 주지 않는다.
 */
export default function BrowseModal({ browse }) {
  const [flipped, setFlipped] = useState(false);
  const [sentence, setSentence] = useState(null);
  const scrollRef = useRef(null);
  const word = browse.currentWord;
  const wordId = word?.id;

  // 이전/다음 또는 듣기 모드로 단어가 바뀌면 앞면으로 돌리고 스크롤을 맨 위로 되돌린다
  useEffect(() => {
    setFlipped(false);
    scrollRef.current?.scrollTo(0, 0);
  }, [browse.browseIndex]);

  // 현재 단어 1개의 예문만 읽는다. 단어가 바뀌는 순간 먼저 비워서 이전 단어의 예문이 잠깐 보이지 않게 한다
  useEffect(() => {
    setSentence(null);
    if (wordId == null) return;
    let cancelled = false;
    getSentencesByWordIds([wordId])
      .then(rows => {
        if (cancelled) return;
        setSentence(pickSentence(filterUsableSentences(rows, word), getKstDateString()));
      })
      .catch(err => console.warn('Sentence load error:', err));
    return () => { cancelled = true; };
    // word 객체는 큐 안에서 바뀌지 않으므로 의존성은 id 만 본다
  }, [wordId]);

  if (!browse.isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={browse.close}
    >
      <div
        className="bg-slate-50 rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col max-h-[92dvh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex justify-between items-center pl-4 pr-1 h-14">
          <span className="text-sm text-slate-400">{browse.browseIndex + 1} / {browse.browseQueue.length}</span>
          <div className="flex items-center gap-1">
            {browse.listening ? (
              <button onClick={browse.stopListening} className="text-emerald-500 text-sm font-medium px-2 h-11">■ 정지</button>
            ) : (
              <button onClick={() => browse.startListening(browse.browseQueue, browse.browseIndex)} className="text-emerald-500 text-sm font-medium px-2 h-11">▶ 듣기</button>
            )}
            <button onClick={browse.close} className="w-11 h-11 flex items-center justify-center text-slate-400 text-2xl" aria-label="닫기">&times;</button>
          </div>
        </div>

        {/* 앞면일 때만 카드 탭으로 뒤집는다. 뒷면에서는 예문을 읽거나 스크롤해도 아무 일도 일어나지 않는다 */}
        <div ref={scrollRef} className="flex-1 min-h-[40dvh] overflow-y-auto flex flex-col px-4 py-2">
          <FlashCard word={word} sentence={sentence} flipped={flipped} onFlip={() => setFlipped(true)} />
        </div>

        <div className="shrink-0 flex gap-2 px-4 pt-2 border-t border-slate-200 safe-bottom-min">
          <button
            onClick={browse.prev ?? undefined}
            disabled={!browse.prev}
            className="flex-1 h-14 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-30"
          >
            ← 이전
          </button>
          <button
            onClick={browse.next ?? undefined}
            disabled={!browse.next}
            className="flex-1 h-14 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 disabled:opacity-30"
          >
            다음 →
          </button>
        </div>
      </div>
    </div>
  );
}
