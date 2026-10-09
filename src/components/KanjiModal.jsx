import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { formatKanjiReading, loadKanji } from '../lib/kanji';
import { playKanjiStrokes } from '../lib/kanji-animation';
import { getKanjiIllustration, getKanjiIllustrationsEnabled, subscribeToKanjiIllustrations } from '../lib/kanji-illustrations';

export default function KanjiModal({ character, onClose }) {
  const illustrationsEnabled = useSyncExternalStore(subscribeToKanjiIllustrations, getKanjiIllustrationsEnabled);
  const illustration = illustrationsEnabled ? getKanjiIllustration(character) : null;
  const dialogRef = useRef(null);
  const svgRef = useRef(null);
  const closeRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [replay, setReplay] = useState(0);
  const [stroke, setStroke] = useState(0);
  const [finished, setFinished] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setData(null);
    loadKanji(character).then(entry => {
      if (cancelled) return;
      setData(entry);
      setStatus(entry ? 'ready' : 'missing');
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [character, attempt]);

  useLayoutEffect(() => {
    if (!data) return;
    // 좁은 글자(自 등)도 109×109 원본의 빈 여백이 아니라 실제 획 크기로 확대한다.
    const svg = svgRef.current;
    const box = svg.querySelector('.kanji-outline').getBBox();
    const padding = 6;
    svg.setAttribute('viewBox', `${box.x - padding} ${box.y - padding} ${box.width + padding * 2} ${box.height + padding * 2}`);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    setFinished(false);
    return playKanjiStrokes({
      paths: [...svgRef.current.querySelectorAll('[data-kanji-stroke]')],
      pen: svgRef.current.querySelector('[data-kanji-pen]'),
      onProgress: setStroke,
      onComplete: () => setFinished(true),
    });
  }, [data, replay]);

  function dismiss(event) {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  function restart(event) {
    event.stopPropagation();
    if (status === 'error') setAttempt(value => value + 1);
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
          <button type="button" className="kanji-replay" onClick={restart} aria-label="획순 다시 보기" disabled={status === 'loading' || status === 'missing'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.4 8M3 4v6h6" /></svg>
            다시 보기
          </button>
          <button ref={closeRef} type="button" aria-label="한자 팝업 닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
            닫기
          </button>
        </div>
      </header>

      <div
        className="kanji-canvas"
        onClick={event => event.stopPropagation()}
        // 따라 그리다가 영역 밖에서 손을 떼어도 닫기 클릭으로 이어지지 않게 한다.
        onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)}
      >
        {data && illustration && (
          <img
            key={character}
            className="kanji-illustration"
            src={illustration.src}
            alt=""
            aria-hidden="true"
            draggable="false"
            onError={event => { event.currentTarget.style.visibility = 'hidden'; }}
          />
        )}
        {data ? (
          <svg ref={svgRef} viewBox="0 0 109 109" className="kanji-drawing" role="img" aria-label={`${character}, 총 ${data.strokes.length}획`}>
            <g className="kanji-guides" fill="none" stroke="currentColor" strokeWidth="0.25" strokeDasharray="1.4 1.5">
              <path d="M54.5 4V105M4 54.5H105M4 4L105 105M105 4L4 105" />
            </g>
            <g className="kanji-outline" fill="none" stroke="currentColor" strokeWidth="3.7" strokeLinecap="round" strokeLinejoin="round">
              {data.strokes.map((path, i) => <path key={i} d={path} />)}
            </g>
            <g fill="none" strokeWidth="3.7" strokeLinecap="round" strokeLinejoin="round">
              {data.strokes.map((path, i) => <path key={i} data-kanji-stroke d={path} pathLength="1" strokeDasharray="1" strokeDashoffset="1" />)}
            </g>
            <circle data-kanji-pen className="kanji-pen" r="1.2" visibility="hidden" />
          </svg>
        ) : <span lang="ja" className="kanji-fallback-character">{character}</span>}
      </div>

      <div className="kanji-details" id={descriptionId}>
        {status === 'loading' && <p role="status">한자 정보를 불러오는 중…</p>}
        {status === 'error' && <p role="alert">한자 정보를 불러오지 못했어요. 연결을 확인한 뒤 다시 보기를 눌러주세요.</p>}
        {status === 'missing' && <p role="status">아직 이 한자의 뜻과 획순을 제공하지 않아요.</p>}
        {data && <>
          <div className="kanji-meaning-heading">
            <h3>{data.meaningsKo[0] || data.meaningsEn[0] || character}</h3>
            <span className="kanji-stroke-count">{stroke} / {data.strokes.length}획</span>
          </div>
          {!data.meaningsKo.length && <p className="kanji-secondary-meaning">뜻 (영어)</p>}
          {data.meaningsKo.length > 1 && <p className="kanji-secondary-meaning">{data.meaningsKo.slice(1).join(' · ')}</p>}
          <dl className="kanji-readings">
            {data.kun.length > 0 && <div><dt>훈독</dt><dd lang="ja">{data.kun.slice(0, 3).map(formatKanjiReading).join(' · ')}</dd></div>}
            {data.on.length > 0 && <div><dt>음독</dt><dd lang="ja">{data.on.slice(0, 3).join(' · ')}</dd></div>}
          </dl>
        </>}
      </div>
      <p className="kanji-attribution">획순 KanjiVG · 뜻·읽기 KANJIDIC2 / libhangul</p>
      <span className="sr-only" role="status">{finished ? `${character}의 획순 재생이 끝났습니다.` : ''}</span>
    </dialog>,
    document.body,
  );
}
