import { useState, useEffect, useRef, useCallback } from 'react';
import { shuffle } from '../lib/shuffle';
import { keepListeningScreenAwake, loadListeningSettings, normalizeListeningSettings, playListening, saveListeningSettings } from '../lib/listening';

const idleState = index => ({ index, phase: 'ready', remaining: 0, answerRevealed: false, playing: false, error: '' });

export function useListeningMode() {
  const [queue, setQueue] = useState([]);
  const [settings, setSettings] = useState(loadListeningSettings);
  const [state, setState] = useState(() => idleState(0));
  const stopRef = useRef(null);

  const cancelPlayback = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cancelPlayback();
    setState(value => ({ ...value, playing: false, phase: 'stopped', remaining: 0 }));
  }, [cancelPlayback]);

  function open(words) {
    cancelPlayback();
    setQueue(shuffle(words));
    setState(idleState(0));
  }

  function close() {
    cancelPlayback();
    setQueue([]);
    setState(idleState(0));
  }

  function start(index = state.phase === 'complete' ? 0 : state.index) {
    cancelPlayback();
    stopRef.current = playListening({ queue, startIndex: index, settings, onChange: setState });
  }

  function move(offset) {
    const index = state.index + offset;
    if (index < 0 || index >= queue.length) return;
    if (state.playing) start(index);
    else { cancelPlayback(); setState(idleState(index)); }
  }

  function changeSettings(patch) {
    cancelPlayback();
    const next = normalizeListeningSettings({ ...settings, ...patch });
    setSettings(next);
    saveListeningSettings(next);
    setState(idleState(state.index));
  }

  useEffect(() => { if (state.playing) return keepListeningScreenAwake(); }, [state.playing]);
  useEffect(() => cancelPlayback, [cancelPlayback]);

  return {
    ...state, queue, settings, isOpen: queue.length > 0,
    currentWord: queue[state.index],
    open, close, start: () => start(), stop, changeSettings,
    prev: state.index > 0 ? () => move(-1) : null,
    next: state.index < queue.length - 1 ? () => move(1) : null,
  };
}
