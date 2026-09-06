import { speak } from '../lib/speech';
import { parseHighlight } from '../lib/sentence-utils';

/** [[ ]] 로 표시된 목표 단어 부분만 굵게·남색으로 그린다 */
function HighlightedText({ text }) {
  return parseHighlight(text).map((seg, i) =>
    seg.highlight
      ? <span key={i} className="font-bold text-indigo-700">{seg.text}</span>
      : <span key={i}>{seg.text}</span>
  );
}

/**
 * 복습·열람 공용 카드. 뒤집힘 상태(flipped)와 뒤집기 동작(onFlip)은 부모가 소유하는 제어 컴포넌트다.
 * 평가·이전·다음 버튼은 부모의 하단 고정 영역이 담당하므로 여기서는 내용만 그린다.
 * 회전 애니메이션은 두지 않는다. 뒷면 높이가 내용에 따라 달라지면 회전 도중 하단 버튼이 흔들려 보이기 때문이다.
 */
export default function FlashCard({ word, sentence, reverse, flipped, onFlip }) {
  if (!flipped) {
    // 앞면: 단어(역방향이면 뜻) 하나만 본문 가운데에 크게. flex-1 로 본문 영역을 꽉 채우므로 본문 어디를 탭해도 뒤집힌다
    return (
      <div className="flex-1 flex items-center justify-center py-8 text-center" onClick={onFlip}>
        <p className={`text-[1.65rem] font-bold text-slate-800 ${reverse ? '' : 'jp-text'}`}>
          {reverse ? word.meaning : word.word}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col text-left">
      <div className="flex items-center gap-1">
        <p className="text-[1.65rem] font-bold text-slate-800 jp-text">{word.word}</p>
        <button
          onClick={(e) => { e.stopPropagation(); speak(word.word); }}
          className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"
          aria-label="발음 듣기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
            <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>
      {/* 히라가나 단어는 읽기가 표기와 같아 같은 글자를 두 번 보여줄 필요가 없다 */}
      {word.reading && word.reading !== word.word && (
        <p className="text-[1.2rem] text-indigo-600 jp-text">{word.reading}</p>
      )}
      <p className="text-[1rem] text-slate-600 mt-2">
        {word.meaning}
        {word.pos && <span className="text-xs text-slate-400 ml-2">{word.pos}</span>}
      </p>

      {/* 예문이 없는 카드는 구분선도 빈 공간도 두지 않는다. 하단 버튼 위치는 부모가 고정하므로 여기 높이는 자유롭다 */}
      {sentence && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-1">
          <p className="text-[1.4rem] leading-[1.6] text-slate-800 jp-text"><HighlightedText text={sentence.sentence} /></p>
          <p className="text-[1.4rem] leading-[1.6] text-slate-500 jp-text"><HighlightedText text={sentence.reading} /></p>
          <p className="text-[1rem] text-slate-600 pt-1">{sentence.meaning}</p>
        </div>
      )}
    </div>
  );
}
