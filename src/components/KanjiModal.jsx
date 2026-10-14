import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { isValidLessonNumber } from '../lib/lesson-utils';
import { useKanjiData } from '../hooks/useKanjiData';
import KanjiContent, { KanjiReplayButton } from './KanjiContent';

export default function KanjiModal({ character, contextWord, currentSource = contextWord, sourceLabel, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();
  const { data, status, retry } = useKanjiData(character);
  const [replay, setReplay] = useState(0);
  const chapter = contextWord?.chapter;
  const sourceWords = useLiveQuery(async () => {
    if (!isValidLessonNumber(chapter)) return [];
    try { return await db.words.where('chapter').equals(chapter).toArray(); }
    catch { return []; } // 현재 단어는 DB 조회가 실패해도 표시한다.
  }, [chapter]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    closeRef.current.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function dismiss(event) {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  function restart(event) {
    event.stopPropagation();
    if (status === 'error') retry();
    else setReplay(value => value + 1);
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="kanji-modal"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onClick={dismiss}
      onCancel={dismiss}
    >
      <header className="kanji-modal-header">
        <h2 id={headingId}>한자 학습</h2>
        <div className="kanji-modal-actions">
          <KanjiReplayButton onClick={restart} disabled={status === 'loading' || status === 'missing'} />
          <button ref={closeRef} type="button" aria-label="한자 팝업 닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
            닫기
          </button>
        </div>
      </header>

      <KanjiContent key={character} character={character} data={data} status={status} replay={replay} descriptionId={descriptionId}
        context={contextWord} currentSource={currentSource} sourceLabel={sourceLabel} sourceWords={sourceWords} sourcesLoading={!sourceWords} />
    </dialog>,
    document.body,
  );
}
