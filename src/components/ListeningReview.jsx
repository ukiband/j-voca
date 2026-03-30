import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { createListeningSession } from '../lib/listening';
import { getLocalDateString } from '../lib/date-utils';

const TIMER_OPTIONS = [10, 15, 20, 30, 45, 60]; // 분 단위 선택지

export default function ListeningReview() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('setup'); // 'setup' | 'playing' | 'finished'
  const [todayWords, setTodayWords] = useState([]);
  const [loading, setLoading] = useState(true);

  // 재생 중 상태
  const [currentWord, setCurrentWord] = useState(null);
  const [playPhase, setPlayPhase] = useState(null); // 'japanese' | 'waiting' | 'korean' | 'next'
  const [selectedMin, setSelectedMin] = useState(30);
  const [remainingSec, setRemainingSecState] = useState(0);
  const sessionRef = useRef(null);
  const endTimeRef = useRef(null);

  // 오늘 생성된 단어 조회
  useEffect(() => {
    const today = getLocalDateString();
    db.words.where('createdAt').equals(today).toArray().then(words => {
      setTodayWords(words);
      setLoading(false);
    });
  }, []);

  // 타이머 카운트다운
  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setRemainingSecState(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const startSession = useCallback(() => {
    endTimeRef.current = Date.now() + selectedMin * 60 * 1000;
    setRemainingSecState(selectedMin * 60);
    setPhase('playing');

    sessionRef.current = createListeningSession(todayWords, selectedMin, {
      onWordChange: (word) => setCurrentWord(word),
      onPhaseChange: (p) => setPlayPhase(p),
      onFinish: () => setPhase('finished'),
    });
  }, [todayWords, selectedMin]);

  const stopSession = useCallback(() => {
    sessionRef.current?.stop();
    setPhase('finished');
  }, []);

  // 언마운트 시 세션 정리
  useEffect(() => {
    return () => sessionRef.current?.stop();
  }, []);

  // 남은 시간 표시 포맷
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // phase별 안내 텍스트
  const phaseLabel = {
    japanese: '듣고 뜻을 떠올려 보세요',
    waiting: '뜻을 떠올려 보세요...',
    korean: '정답 확인',
    next: '다음 단어로...',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 오늘 추가된 단어가 없는 경우
  if (todayWords.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-4">🎧</p>
        <p className="text-lg font-medium text-slate-700 mb-2">오늘 추가된 단어가 없습니다</p>
        <p className="text-sm text-slate-400 mb-6">단어를 먼저 입력한 뒤 다시 시도하세요</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm"
        >
          홈으로
        </button>
      </div>
    );
  }

  // 설정 화면 — 타이머 선택
  if (phase === 'setup') {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">자전거 복습</h1>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">오늘 단어</p>
          <p className="text-3xl font-bold text-slate-800">{todayWords.length}개</p>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-600 mb-3">복습 시간 설정</p>
          <div className="grid grid-cols-3 gap-3">
            {TIMER_OPTIONS.map(min => (
              <button
                key={min}
                onClick={() => setSelectedMin(min)}
                className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                  selectedMin === min
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {min}분
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
          <p>🔊 일본어 발음 → 5초 대기 → 한국어 뜻</p>
          <p>🔁 설정한 시간 동안 무한 반복</p>
          <p>📱 화면 꺼짐 방지 자동 적용</p>
        </div>

        <button
          onClick={startSession}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-lg font-medium"
        >
          시작하기
        </button>
      </div>
    );
  }

  // 재생 화면
  if (phase === 'playing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8">
        {/* 남은 시간 */}
        <div className="text-sm text-slate-400">
          남은 시간 {formatTime(remainingSec)}
        </div>

        {/* 현재 단어 표시 */}
        {currentWord && (
          <div className="text-center space-y-4">
            <p className="text-4xl font-bold text-slate-800">
              {currentWord.word}
            </p>
            {/* 한국어 뜻은 korean phase일 때만 표시 */}
            {(playPhase === 'korean' || playPhase === 'next') && (
              <p className="text-2xl text-indigo-600">{currentWord.meaning}</p>
            )}
            {currentWord.reading && currentWord.reading !== currentWord.word &&
              (playPhase === 'korean' || playPhase === 'next') && (
              <p className="text-lg text-slate-400">{currentWord.reading}</p>
            )}
          </div>
        )}

        {/* 상태 안내 */}
        <p className="text-sm text-slate-500">
          {phaseLabel[playPhase] || '준비 중...'}
        </p>

        {/* 대기 시 카운트다운 인디케이터 */}
        {playPhase === 'waiting' && (
          <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-300 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}

        {/* 중지 버튼 */}
        <button
          onClick={stopSession}
          className="px-6 py-3 bg-red-500 text-white rounded-xl text-sm font-medium"
        >
          중지
        </button>
      </div>
    );
  }

  // 완료 화면
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
      <p className="text-5xl">✅</p>
      <p className="text-xl font-bold text-slate-800">복습 완료!</p>
      <p className="text-sm text-slate-500">{todayWords.length}개 단어를 반복 학습했습니다</p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium"
      >
        홈으로
      </button>
    </div>
  );
}
