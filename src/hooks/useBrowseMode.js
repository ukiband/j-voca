import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useBrowseMode() {
  const [searchParams, setSearchParams] = useSearchParams();
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

    function playWord(index) {
      if (!listeningRef.current || index >= queue.length) {
        stopListening();
        return;
      }

      setBrowseIndex(index);
      setSearchParams({ i: String(index) }, { replace: true });
      const u = new SpeechSynthesisUtterance(queue[index].word);
      u.lang = 'ja-JP';
      u.rate = 0.8;
      u.onend = () => {
        if (!listeningRef.current) return;
        setTimeout(() => playWord(index + 1), 3000);
      };
      u.onerror = () => {
        if (!listeningRef.current) return;
        setTimeout(() => playWord(index + 1), 3000);
      };
      speechSynthesis.speak(u);
    }

    playWord(startIdx);
  }, [stopListening, setSearchParams]);

  // URL 쿼리 파라미터 i와 browseIndex를 동기화
  const updateUrl = useCallback((index) => {
    if (index === null) {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ i: String(index) }, { replace: true });
    }
  }, [setSearchParams]);

  function open(words, startIndex = 0) {
    setBrowseQueue(words);
    setBrowseIndex(startIndex);
    updateUrl(startIndex);
  }

  function openWithListening(words, startIndex = 0) {
    setBrowseQueue(words);
    setBrowseIndex(startIndex);
    updateUrl(startIndex);
    startListening(words, startIndex);
  }

  function close() {
    stopListening();
    setBrowseIndex(null);
    setBrowseQueue([]);
    updateUrl(null);
  }

  function prev() {
    stopListening();
    const idx = browseIndex - 1;
    setBrowseIndex(idx);
    updateUrl(idx);
  }

  function next() {
    stopListening();
    const idx = browseIndex + 1;
    setBrowseIndex(idx);
    updateUrl(idx);
  }

  useEffect(() => {
    if (browseIndex !== null) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [browseIndex !== null]);

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  // URL에서 초기 index를 읽어 반환 (마운트 시 복원용)
  const urlIndex = searchParams.get('i');
  const initialIndex = urlIndex !== null ? Number(urlIndex) : null;

  return {
    isOpen,
    currentWord,
    browseIndex,
    browseQueue,
    listening,
    initialIndex,
    open,
    openWithListening,
    close,
    prev: browseIndex > 0 ? prev : null,
    next: browseIndex < browseQueue.length - 1 ? next : null,
    startListening,
    stopListening,
  };
}
