import { kanjiDrawingTimeScale } from './kanji-settings';

const LEAD_MS = 300;
const DRAW_MS = 650;
const GAP_MS = 210;

export function strokeAnimationDuration(count, speed = 'medium') {
  return count > 0 ? (LEAD_MS + (count - 1) * (DRAW_MS + GAP_MS) + DRAW_MS) * kanjiDrawingTimeScale(speed) : 0;
}

export function strokeAnimationFrame(elapsed, count, speed = 'medium') {
  const finished = elapsed >= strokeAnimationDuration(count, speed);
  const drawingTime = elapsed / kanjiDrawingTimeScale(speed);
  const progress = Array.from({ length: count }, (_, index) =>
    finished ? 1 : Math.min(1, Math.max(0, (drawingTime - LEAD_MS - index * (DRAW_MS + GAP_MS)) / DRAW_MS)));
  return {
    progress,
    current: progress.filter(value => value > 0).length,
    finished,
  };
}

export function playKanjiStrokes({ paths, pen, onProgress, onComplete, animate = true, speed = 'medium' }) {
  if (!animate) {
    paths.forEach(path => {
      path.style.strokeDashoffset = '0';
      path.style.visibility = 'visible';
      path.style.stroke = 'var(--kanji-ink)';
    });
    pen.setAttribute('visibility', 'hidden');
    onProgress(paths.length);
    return () => {};
  }
  const duration = strokeAnimationDuration(paths.length, speed);
  const lengths = paths.map(path => path.getTotalLength());
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, elapsed = 0, previousTime = null, lastCount = -1, disposed = false;

  function paint() {
    const state = strokeAnimationFrame(elapsed, paths.length, speed);
    let active = -1;
    paths.forEach((path, index) => {
      const progress = state.progress[index];
      const visible = motion.matches && progress < 1 ? 0 : progress;
      path.style.strokeDashoffset = String(1 - visible);
      path.style.visibility = visible > 0 ? 'visible' : 'hidden';
      path.style.stroke = progress > 0 && progress < 1 ? 'var(--kanji-active)' : 'var(--kanji-ink)';
      if (progress > 0 && progress < 1) active = index;
    });
    if (active >= 0 && !motion.matches) {
      const point = paths[active].getPointAtLength(lengths[active] * state.progress[active]);
      pen.setAttribute('cx', point.x);
      pen.setAttribute('cy', point.y);
      pen.setAttribute('visibility', 'visible');
    } else pen.setAttribute('visibility', 'hidden');
    if (state.current !== lastCount) {
      lastCount = state.current;
      onProgress(state.current);
    }
    return state.finished;
  }

  function tick(now) {
    if (disposed || document.hidden) return;
    if (previousTime !== null) elapsed = Math.min(duration, elapsed + Math.min(now - previousTime, 80));
    previousTime = now;
    if (paint()) {
      frame = 0;
      onComplete();
    } else frame = requestAnimationFrame(tick);
  }

  function handleVisibility() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    if (!document.hidden && !disposed && elapsed < duration) frame = requestAnimationFrame(tick);
  }

  paint();
  if (!document.hidden) frame = requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
