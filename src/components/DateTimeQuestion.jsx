import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createDateTimeQuestion, dismissDateTimeQuestion, shouldShowDateTimeQuestion } from '../lib/date-time-practice';

export default function DateTimeQuestion() {
  const [question, setQuestion] = useState(() => shouldShowDateTimeQuestion() ? createDateTimeQuestion() : null);
  const [revealed, setRevealed] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const answerRef = useRef(null);

  useEffect(() => {
    if (revealed) answerRef.current?.scrollIntoView({ block: 'nearest' });
  }, [revealed]);

  // 홈을 띄운 채 백그라운드로 갔다가 돌아오면 마운트가 다시 일어나지 않으므로,
  // 화면이 다시 보일 때 숨김 시간이 지났는지 한 번 더 확인해서 질문을 낸다.
  useEffect(() => {
    if (question) return;
    const handler = () => {
      if (document.visibilityState === 'visible' && shouldShowDateTimeQuestion()) {
        setRevealed(false);
        setQuestion(createDateTimeQuestion());
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [question]);

  useEffect(() => {
    if (!question) return;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [question]);

  function dismiss() {
    dismissDateTimeQuestion();
    setQuestion(null);
  }

  if (!question) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="date-time-question"
      onCancel={event => { event.preventDefault(); dismiss(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-0 shadow-xl backdrop:bg-black/50 dark:backdrop:bg-black/70"
    >
      <div className="flex flex-col max-h-[calc(100dvh-2rem-2px)]">
        <div className="min-h-0 overflow-y-auto p-6">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-4">오늘의 질문</p>
          <h2 id="date-time-question" lang="ja" className="text-xl font-bold jp-text">{question.question}</h2>
          <p lang="ja" className="mt-2 text-base text-slate-500 dark:text-slate-400 jp-text">{question.questionReading}</p>

          {revealed && (
            <div ref={answerRef} className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700 space-y-2" aria-live="polite" lang="ja">
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 jp-text">{question.answer}</p>
              <p className="text-base text-slate-500 dark:text-slate-400 jp-text">{question.answerReading}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap gap-3 px-6 pb-6">
          {!revealed && <button onClick={() => { setRevealed(true); closeRef.current?.focus(); }} className="flex-1 min-w-28 min-h-11 py-3 px-3 rounded-xl bg-indigo-600 text-white text-sm font-medium">정답 보기</button>}
          <button ref={closeRef} onClick={dismiss} className={`flex-1 min-w-28 min-h-11 py-3 px-3 rounded-xl text-sm font-medium ${revealed ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>질문 닫기</button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
