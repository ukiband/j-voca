import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import KanjiText from './KanjiText';
import KanjiModal from './KanjiModal';

export default function ListeningModal({ player }) {
  const dialogRef = useRef(null);
  const startRef = useRef(null);
  const headingId = useId();
  const timeId = useId();
  const [selectedKanji, setSelectedKanji] = useState(null);
  const { settings, currentWord: word } = player;
  const japaneseFirst = settings.language === 'ja';
  const answerLanguage = japaneseFirst ? '한국어' : '일본어';

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    startRef.current.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function selectKanji(character) {
    player.stop();
    setSelectedKanji(character);
  }

  function japaneseWord() {
    return <>
      <p className="jp-text text-3xl font-bold leading-relaxed" lang="ja"><KanjiText text={word.word} onSelect={selectKanji} /></p>
      {word.reading && word.reading !== word.word && <p className="jp-text mt-1 text-lg text-indigo-600 dark:text-indigo-300" lang="ja">{word.reading}</p>}
    </>;
  }

  const status = {
    ready: '재생 준비', prompt: `${japaneseFirst ? '일본어' : '한국어'} 듣는 중`,
    thinking: `생각할 시간 · ${player.remaining}초`, answer: `${answerLanguage} 정답`,
    gap: '다음 단어 준비', stopped: '정지됨', complete: '듣기 완료', error: '재생 중단',
  }[player.phase];

  return createPortal(<>
    <dialog ref={dialogRef} aria-labelledby={headingId}
      className="listening-modal m-auto w-[calc(100%-24px)] max-w-lg max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0 text-slate-800 dark:text-slate-100"
      onCancel={event => { event.preventDefault(); player.close(); }}
      onClick={event => { if (event.target === event.currentTarget) player.close(); }}>
      <div className="p-5 safe-bottom-min">
        <header className="flex items-center justify-between gap-2 mb-4">
          <h2 id={headingId} className="text-lg font-bold">듣기 학습</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">{player.index + 1} / {player.queue.length}</span>
            <button type="button" onClick={player.close} className="min-h-11 px-2 text-sm text-slate-500 dark:text-slate-400" aria-label="듣기 닫기">닫기</button>
          </div>
        </header>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">듣기 언어</legend>
          <div className="grid grid-cols-2 gap-2">
            {[['ja', '일본어'], ['ko', '한국어']].map(([language, label]) => (
              <label key={language} className="cursor-pointer">
                <input type="radio" name={headingId} value={language} checked={settings.language === language}
                  onChange={() => player.changeSettings({ language })} className="peer sr-only" />
                <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 text-sm peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-400">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-3 min-h-12 py-3 text-sm cursor-pointer">
          <input type="checkbox" checked={settings.includeAnswer} onChange={event => player.changeSettings({ includeAnswer: event.target.checked })}
            className="h-5 w-5 accent-indigo-600" />
          {answerLanguage} 정답 추가
        </label>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor={timeId}>생각할 시간</label>
            <output htmlFor={timeId} className="font-semibold text-indigo-600 dark:text-indigo-300 tabular-nums">{settings.thinkSeconds}초</output>
          </div>
          <input id={timeId} type="range" min="0" max="15" step="1" value={settings.thinkSeconds}
            aria-valuetext={`${settings.thinkSeconds}초`} aria-describedby={`${timeId}-help`}
            onChange={event => player.changeSettings({ thinkSeconds: Number(event.target.value) })} className="w-full h-9 accent-indigo-600" />
          <p id={`${timeId}-help`} className="text-xs text-slate-500 dark:text-slate-400">{settings.includeAnswer ? '정답을 듣기 전까지 기다립니다.' : '다음 단어를 듣기 전까지 기다립니다.'}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-center break-words">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3" role="status" aria-live="off">{status}</p>
          {japaneseFirst ? japaneseWord() : <p className="text-2xl font-semibold leading-relaxed">{word.meaning}</p>}
          {settings.includeAnswer && player.answerRevealed && (
            <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4" data-listening-answer>
              {japaneseFirst ? <p className="text-xl leading-relaxed">{word.meaning}</p> : japaneseWord()}
            </div>
          )}
        </div>

        {player.error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{player.error}</p>}
        <div className="grid grid-cols-[1fr_1.5fr_1fr] gap-2 mt-5">
          <button type="button" onClick={player.prev ?? undefined} disabled={!player.prev} className="min-h-12 rounded-xl border border-slate-200 dark:border-slate-600 text-sm disabled:opacity-30">이전</button>
          <button ref={startRef} type="button" onClick={player.playing ? player.stop : player.start} className="min-h-12 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
            {player.playing ? '정지' : player.phase === 'complete' ? '다시 듣기' : '재생'}
          </button>
          <button type="button" onClick={player.next ?? undefined} disabled={!player.next} className="min-h-12 rounded-xl border border-slate-200 dark:border-slate-600 text-sm disabled:opacity-30">다음</button>
        </div>
      </div>
    </dialog>
    {selectedKanji && <KanjiModal character={selectedKanji} onClose={() => setSelectedKanji(null)} />}
  </>, document.body);
}
