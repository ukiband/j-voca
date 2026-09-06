import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { db, getSentencesByWordIds } from '../lib/db';
import { gradeCard, createInitialReview } from '../lib/fsrs';
import { getDueWords } from '../lib/review-utils';
import { formatLesson, parseLessonNumber } from '../lib/lesson-utils';
import { filterUsableSentences, pickSentence } from '../lib/sentence-utils';
import { getKstDateString } from '../lib/date-utils';
import { useImmersive } from '../hooks/useImmersive';
import FlashCard from './FlashCard';

// 앞면 "뒤집기"와 뒷면 평가 버튼이 같은 자리에 있어서, 뒤집은 직후 연속 탭이 평가로 처리되지 않도록 잠시 막는 시간
const GRADE_READY_DELAY_MS = 300;

const GRADE_BUTTONS = [
  { grade: 'again', label: '모름', color: 'bg-red-600' },
  { grade: 'hard', label: '애매', color: 'bg-amber-700' },
  { grade: 'good', label: '앎', color: 'bg-green-700' },
];

export default function ReviewSession() {
  const [params] = useSearchParams();
  const lessonParam = params.get('lesson');
  const stepParam = params.get('step');
  const tagParam = params.get('tag');
  const reverse = params.get('reverse') === 'true';
  const order = params.get('order');
  // lesson 파라미터가 양의 정수면 해당 lesson만, 없거나 비정상 값(?lesson=abc)이면 전체 복습
  const chapter = parseLessonNumber(lessonParam) ?? undefined;
  // step 파라미터가 없거나 비정상이면 step 1로 간주한다 (step 도입 전 URL ?lesson=N 호환). lesson이 없으면 step도 의미 없음
  const step = chapter != null ? (parseLessonNumber(stepParam) ?? 1) : undefined;
  // 네비게이션마다 고유한 key가 바뀌므로, 같은 경로 재진입 시에도 데이터를 새로 읽음
  const locationKey = useLocation().key;

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [noWords, setNoWords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState({ again: 0, hard: 0, good: 0 });
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [gradeReady, setGradeReady] = useState(false);
  // wordId → 예문 배열. 큐가 정해진 뒤 한 번에 읽어 두고 카드마다 골라 쓴다
  const [sentenceMap, setSentenceMap] = useState(() => new Map());
  const scrollRef = useRef(null);
  const readyTimerRef = useRef(null);

  useEffect(() => {
    getDueWords(step, chapter, tagParam).then(words => {
      if (words.length === 0) {
        setNoWords(true);
      } else {
        // 순차 모드: words.json 입력 순서대로 복습 (id 오름차순), 그 외: 랜덤 셔플
        const ordered = order === 'sequential'
          ? [...words].sort((a, b) => a.id - b.id)
          : [...words].sort(() => Math.random() - 0.5);
        setQueue(ordered);
        setWordCount(ordered.length);
        // 예문은 보조 정보이므로 읽기에 실패해도 복습은 그대로 진행한다
        getSentencesByWordIds(ordered.map(w => w.id))
          .then(rows => {
            const map = new Map();
            for (const row of rows) {
              if (!map.has(row.wordId)) map.set(row.wordId, []);
              map.get(row.wordId).push(row);
            }
            setSentenceMap(map);
          })
          .catch(err => console.warn('Sentence load error:', err));
      }
      setLoading(false);
    }).catch((err) => {
      console.error('ReviewSession load error:', err);
      setError(err.message || '데이터를 불러올 수 없습니다');
      setLoading(false);
    });
  }, [step, chapter, tagParam, order, locationKey]);

  const currentWord = queue[currentIndex];
  const done = !loading && queue.length > 0 && currentIndex >= queue.length;
  const currentWordId = currentWord?.id;

  // 카드 구간에서만 하단 탭을 숨기고 화면 높이를 고정한다. 로딩·오류·완료 화면은 일반 레이아웃을 쓴다
  useImmersive(!loading && !error && !noWords && !done && currentWord != null);

  // 새 카드로 넘어가면 스크롤을 맨 위로 되돌리고, 이전 카드의 평가 활성화 타이머를 정리한다
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    return () => clearTimeout(readyTimerRef.current);
  }, [currentIndex]);

  // 같은 날에는 같은 문장이 나오도록 날짜 기준으로 고른다. 카드가 바뀌거나 예문이 로드됐을 때만 다시 계산한다
  const sentence = useMemo(() => {
    if (!currentWord) return null;
    const usable = filterUsableSentences(sentenceMap.get(currentWord.id), currentWord);
    return pickSentence(usable, getKstDateString());
  }, [currentWordId, sentenceMap]);

  function handleFlip() {
    if (flipped) return;
    setFlipped(true);
    clearTimeout(readyTimerRef.current);
    readyTimerRef.current = setTimeout(() => setGradeReady(true), GRADE_READY_DELAY_MS);
  }

  async function handleGrade(grade) {
    if (!currentWord || saving) return;
    setSaving(true);

    try {
      let review = await db.reviews.get(currentWord.id);
      if (!review) review = createInitialReview(currentWord.id);
      const updated = gradeCard(review, grade);
      // 단일 트랜잭션으로 review와 log를 함께 저장
      await db.transaction('rw', db.reviews, db.reviewLogs, async () => {
        await db.reviews.put(updated);
        await db.reviewLogs.add({
          wordId: currentWord.id,
          review_date: new Date().toISOString(),
          grade,
        });
      });
    } catch (err) {
      // 저장에 실패한 평가는 기록되지 않았으므로 카드를 넘기지 않고 현재 카드에서 다시 누를 수 있게 둔다
      console.error('Review save error:', err);
      setSaveError(err.message || '저장 실패');
      setSaving(false);
      return;
    }

    setSaveError(null);
    setSaving(false);
    setResults(prev => ({ ...prev, [grade]: prev[grade] + 1 }));

    if (grade === 'again') {
      // 모름: 큐 뒤쪽에 재삽입하여 같은 세션에서 다시 복습
      setQueue(prev => [...prev, currentWord]);
    }

    // 다음 카드는 앞면부터. 인덱스와 같은 렌더에서 함께 바꿔야 뒷면이 한 프레임 비치지 않는다
    setFlipped(false);
    setGradeReady(false);
    setCurrentIndex(prev => prev + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">&#x26A0;&#xFE0F;</p>
        <p className="text-lg font-medium text-slate-800">데이터 로드 실패</p>
        <p className="text-sm text-slate-400 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm"
        >
          새로고침
        </button>
      </div>
    );
  }

  if (noWords) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">&#x1F389;</p>
        <p className="text-lg font-medium text-slate-800">복습할 단어가 없습니다</p>
        <p className="text-sm text-slate-400 mt-2">내일 다시 확인해보세요</p>
        <Link to="/lesson-select" className="text-indigo-600 font-medium text-sm mt-4 inline-block">돌아가기</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-12 space-y-6">
        <p className="text-4xl">&#x2705;</p>
        <p className="text-lg font-medium text-slate-800">복습 완료!</p>
        {/* 결과 칸 색은 평가 버튼(red-600 / amber-700 / green-700)과 같은 계열로 맞춘다 */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-red-600 font-medium">{results.again}</p>
            <p className="text-slate-400">모름</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-amber-700 font-medium">{results.hard}</p>
            <p className="text-slate-400">애매</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-green-700 font-medium">{results.good}</p>
            <p className="text-slate-400">앎</p>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          {chapter != null ? `${formatLesson(step, chapter)} · ` : tagParam ? `${tagParam} · ` : ''}{wordCount}개 단어 복습 완료
        </p>
        <Link to="/lesson-select" className="text-indigo-600 font-medium text-sm inline-block">돌아가기</Link>
      </div>
    );
  }

  // 일반 복습 구간과 재복습(again) 구간을 분리하여 진행률 계산
  const isReview = currentIndex < wordCount;
  const progressCurrent = isReview ? currentIndex + 1 : currentIndex - wordCount + 1;
  const progressTotal = isReview ? wordCount : queue.length - wordCount;
  const progressPct = (progressCurrent / progressTotal) * 100;

  const title = (chapter != null ? formatLesson(step, chapter) : tagParam || '전체 복습') + (reverse ? ' · 한→일' : '');

  // 3단 고정 레이아웃: 헤더와 하단 조작 영역은 shrink-0 로 고정하고 본문(카드)만 스크롤한다.
  // 그래야 문장 길이나 예문 유무와 상관없이 뒤집기/평가 버튼이 항상 같은 자리에 온다.
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="shrink-0 safe-top">
        <div className="flex items-center gap-2 h-[72px] pl-1 pr-4">
          <Link
            to="/lesson-select"
            aria-label="복습 닫기"
            className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-500 text-2xl"
          >
            &times;
          </Link>
          <h1 className="flex-1 min-w-0 truncate text-[1rem] font-bold text-slate-800">{title}</h1>
          <span className="shrink-0 text-sm text-slate-500">
            {isReview ? `${progressCurrent} / ${progressTotal}` : `재복습 ${progressCurrent} / ${progressTotal}`}
          </span>
        </div>
        <div className="h-[3px] bg-slate-200">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      {saveError && (
        <p className="shrink-0 mx-4 mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">저장 오류: {saveError}. 다시 평가해주세요.</p>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col px-5 py-4">
        <FlashCard word={currentWord} sentence={sentence} reverse={reverse} flipped={flipped} onFlip={handleFlip} />
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 pt-2 safe-bottom-min">
        {flipped ? (
          <div className="grid grid-cols-3 gap-2">
            {GRADE_BUTTONS.map(({ grade, label, color }) => (
              <button
                key={grade}
                onClick={() => handleGrade(grade)}
                disabled={!gradeReady || saving}
                className={`${color} h-14 rounded-xl text-white text-[1rem] font-medium disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={handleFlip}
            className="w-full h-14 rounded-xl bg-indigo-600 text-white text-[1rem] font-medium"
          >
            뒤집기
          </button>
        )}
      </footer>
    </div>
  );
}
