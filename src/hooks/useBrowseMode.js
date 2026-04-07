import { useState, useEffect, useRef, useCallback } from 'react';
import { shuffle } from '../lib/shuffle';
import { getPrerenderedAudioUrl } from '../lib/speech';

export function useBrowseMode() {
  const [browseIndex, setBrowseIndex] = useState(null);
  const [browseQueue, setBrowseQueue] = useState([]);
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const wakeLockRef = useRef(null);

  const isOpen = browseIndex !== null && browseQueue.length > 0 && browseIndex < browseQueue.length;
  const currentWord = isOpen ? browseQueue[browseIndex] : null;

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    speechSynthesis.cancel();
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // onend 콜백 체인 방식: iOS Safari에서 async/await 루프 + cancel()을 반복하면
  // 유저 제스처 컨텍스트를 벗어나 speechSynthesis가 차단됨.
  // cancel()은 최초 1회만 호출하고, onend → setTimeout → 다음 speak() 체인으로 연결.
  const startListening = useCallback((queue, startIdx) => {
    speechSynthesis.cancel();
    listeningRef.current = true;
    setListening(true);

    try {
      if (navigator.wakeLock) {
        navigator.wakeLock.request('screen').then(lock => {
          wakeLockRef.current = lock;
        }).catch(() => {});
      }
    } catch {}

    async function playWord(index) {
      if (!listeningRef.current || index >= queue.length) {
        stopListening();
        return;
      }

      setBrowseIndex(index);
      const word = queue[index].word;
      const next = () => {
        if (!listeningRef.current) return;
        setTimeout(() => playWord(index + 1), 3000);
      };

      // 사전 생성된 VOICEVOX Nemo wav 우선 재생
      const url = await getPrerenderedAudioUrl(word);
      if (url) {
        const audio = new Audio(url);
        audio.onended = next;
        audio.onerror = next;
        audio.play().catch(next);
        return;
      }

      // 폴백: Web Speech API
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'ja-JP';
      u.rate = 0.8;
      u.onend = next;
      u.onerror = next;
      speechSynthesis.speak(u);
    }

    playWord(startIdx);
  }, [stopListening]);

  function open(words) {
    setBrowseQueue(shuffle(words));
    setBrowseIndex(0);
  }

  function openWithListening(words) {
    const q = shuffle(words);
    setBrowseQueue(q);
    setBrowseIndex(0);
    startListening(q, 0);
  }

  function close() {
    stopListening();
    setBrowseIndex(null);
    setBrowseQueue([]);
  }

  function prev() {
    stopListening();
    setBrowseIndex(browseIndex - 1);
  }

  function next() {
    stopListening();
    setBrowseIndex(browseIndex + 1);
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  return {
    isOpen,
    currentWord,
    browseIndex,
    browseQueue,
    listening,
    open,
    openWithListening,
    close,
    prev: browseIndex > 0 ? prev : null,
    next: browseIndex < browseQueue.length - 1 ? next : null,
    startListening,
    stopListening,
  };
}
