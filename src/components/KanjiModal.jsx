import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useKanjiData } from '../hooks/useKanjiData';
import KanjiContent, { KanjiReplayButton } from './KanjiContent';

export default function KanjiModal({ character, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();
  const { data, status, retry } = useKanjiData(character);
  const [replay, setReplay] = useState(0);

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

      <KanjiContent key={character} character={character} data={data} status={status} replay={replay} descriptionId={descriptionId} />
    </dialog>,
    document.body,
  );
}
