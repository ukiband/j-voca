import { useEffect, useRef, useState } from 'react';

const HOLD_MS = 2000;

/** Touch lock only. Playback stays owned by the listening session. */
export default function ListeningScreenLock({ headingId, index, count, status, onUnlock }) {
  const buttonRef = useRef(null);
  const timerRef = useRef(null);
  const pointerRef = useRef(null);
  const readyRef = useRef(false);
  const [holding, setHolding] = useState(false);
  const [ready, setReady] = useState(false);

  function cancelHold() {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    pointerRef.current = null;
    readyRef.current = false;
    setHolding(false);
    setReady(false);
  }

  useEffect(() => {
    buttonRef.current.focus({ preventScroll: true });
    const cancelWhenHidden = () => { if (document.hidden) cancelHold(); };
    document.addEventListener('visibilitychange', cancelWhenHidden);
    return () => {
      clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', cancelWhenHidden);
    };
  }, []);

  function beginHold(event) {
    if (!event.isPrimary || event.button !== 0) { cancelHold(); return; }
    cancelHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    setHolding(true);
    timerRef.current = setTimeout(() => {
      readyRef.current = true;
      setReady(true);
    }, HOLD_MS);
  }

  function endHold(event) {
    event.preventDefault();
    event.stopPropagation();
    const unlock = pointerRef.current === event.pointerId && readyRef.current;
    cancelHold();
    // Wait for release so a finger held on the screen cannot press controls underneath.
    if (unlock) onUnlock();
  }

  return (
    <div className="listening-screen-lock">
      <div className="my-auto text-center">
        <svg className="mx-auto mb-5 h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="3" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <h2 id={headingId} className="text-lg font-medium">화면 잠금</h2>
        <p className="mt-3 text-sm" aria-live="off">{status}</p>
        <p className="mt-2 text-sm tabular-nums">{index + 1} / {count}</p>
      </div>
      <button ref={buttonRef} type="button" className={`listening-unlock ${holding ? 'is-holding' : ''}`}
        style={{ '--hold-duration': `${HOLD_MS}ms` }} aria-label="화면 잠금 해제"
        onPointerDown={beginHold} onPointerUp={endHold} onPointerCancel={cancelHold}
        onLostPointerCapture={cancelHold} onBlur={cancelHold}
        onPointerMove={event => {
          if (pointerRef.current !== event.pointerId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cancelHold();
        }}
        onContextMenu={event => event.preventDefault()}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          // Keyboard and assistive-technology activation do not have a pointer hold.
          if (event.detail === 0) { cancelHold(); onUnlock(); }
        }}>
        <span aria-hidden="true" className="listening-unlock-progress" />
        <span className="relative">{ready ? '손을 떼면 잠금 해제' : '2초간 길게 눌러 잠금 해제'}</span>
      </button>
    </div>
  );
}
