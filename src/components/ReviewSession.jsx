import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { db, getSentencesByWordIds } from '../lib/db';
import { gradeCard, createInitialReview } from '../lib/fsrs';
import { getDueItems, orderReviewItems } from '../lib/review-utils';
import { formatLesson, parseLessonNumber } from '../lib/lesson-utils';
import { filterUsableSentences, pickSentence } from '../lib/sentence-utils';
import { getKstDateString } from '../lib/date-utils';
import { playNextSound, prepareSound } from '../lib/sound';
import { useImmersive } from '../hooks/useImmersive';
import { refreshSentences } from '../lib/sentence-sync';
import FlashCard from './FlashCard';
import { useKanjiData } from '../hooks/useKanjiData';
import KanjiContent, { KanjiReplayButton } from './KanjiContent';

// 앞면 "뒤집기"와 뒷면 평가 버튼이 같은 자리에 있어서, 뒤집은 직후 연속 탭이 평가로 처리되지 않도록 잠시 막는 시간
const GRADE_READY_DELAY_MS = 300;

const GRADE_BUTTONS = [
  { grade: 'again', label: '모름', color: 'bg-red-600' },
  { grade: 'hard', label: '애매', color: 'bg-amber-700' },
  { grade: 'good', label: '앎', color: 'bg-green-700' },
];

export default function ReviewSession({ kind = 'words' }) {
  const location = useLocation();
  return <Session key={`${kind}:${location.key}`} kind={kind} />;
}

function Session({ kind }) {
  const isKanji = kind === 'kanji';
  const returnPath = isKanji ? '/kanji' : '/lesson-select';
  const [params] = useSearchParams();
  const lessonParam = params.get('lesson');
  const stepParam = params.get('step');
  const tagParam = isKanji ? null : params.get('tag');
  const reverse = params.get('reverse') === 'true';
  const order = params.get('order');
  // lesson 파라미터가 양의 정수면 해당 lesson만, 없거나 비정상 값(?lesson=abc)이면 전체 복습
  const chapter = parseLessonNumber(lessonParam) ?? undefined;
  // step 파라미터가 없거나 비정상이면 step 1로 간주한다 (step 도입 전 URL ?lesson=N 호환). lesson이 없으면 step도 의미 없음
  const step = chapter != null ? (parseLessonNumber(stepParam) ?? 1) : undefined;

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
  const [replay, setReplay] = useState(0);
  const [skippedIds, setSkippedIds] = useState(() => new Set());
  // wordId → 예문 배열. 큐가 정해진 뒤 한 번에 읽어 두고 카드마다 골라 쓴다
  const [sentenceMap, setSentenceMap] = useState(() => new Map());
  const scrollRef = useRef(null);
  const readyTimerRef = useRef(null);
  const savingRef = useRef(false);

  // 복습 시작을 기다리게 하지 않고 옆에서 예문을 다시 받는다. 이번 세션의 예문은 아래에서 한 번 읽은 것을 유지하므로
  // 여기서 받은 것은 다음 복습부터 보인다 (읽는 도중 문장이 바뀌지 않게 하려는 기획 원칙)
  useEffect(() => { if (!isKanji) refreshSentences(); }, [isKanji]);

  useEffect(() => {
    let active = true;
    getDueItems(kind, step, chapter, tagParam).then(words => {
      if (!active) return;
      if (words.length === 0) {
        setNoWords(true);
      } else {
        // 단어는 등록 순서, 한자는 해당 단어에서 처음 등장한 순서. 그 외에는 랜덤 셔플
        const ordered = orderReviewItems(words, order);
        setQueue(ordered);
        setWordCount(ordered.length);
        // 예문은 보조 정보이므로 읽기에 실패해도 복습은 그대로 진행한다
        if (!isKanji) getSentencesByWordIds(ordered.map(w => w.id))
          .then(rows => {
            if (!active) return;
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
      if (!active) return;
      console.error('ReviewSession load error:', err);
      setError(err.message || '데이터를 불러올 수 없습니다');
      setLoading(false);
    });
    return () => { active = false; };
  }, [kind, isKanji, step, chapter, tagParam, order]);

  const currentWord = queue[currentIndex];
  const kanji = useKanjiData(isKanji ? currentWord?.kanjiId : null);
  const answerReady = !isKanji || (kanji.status === 'ready' && !!kanji.data.meaningsKo[0]);
  const done = !loading && queue.length > 0 && currentIndex >= queue.length;

  // 카드 구간에서만 하단 탭을 숨기고 화면 높이를 고정한다. 로딩·오류·완료 화면은 일반 레이아웃을 쓴다
  useImmersive(!loading && !error && !noWords && !done && currentWord != null);

  // 새 카드로 넘어가면 스크롤을 맨 위로 되돌리고, 이전 카드의 평가 활성화 타이머를 정리한다
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    return () => clearTimeout(readyTimerRef.current);
  }, [currentIndex]);

  // 같은 날에는 같은 문장이 나오도록 날짜 기준으로 고른다. 카드가 바뀌거나 예문이 로드됐을 때만 다시 계산한다
  const sentence = useMemo(() => {
    if (!currentWord || isKanji) return null;
    const usable = filterUsableSentences(sentenceMap.get(currentWord.id), currentWord);
    return pickSentence(usable, getKstDateString());
  }, [currentWord, sentenceMap, isKanji]);

  function handleFlip() {
    if (flipped || !answerReady) return;
    setFlipped(true);
    clearTimeout(readyTimerRef.current);
    readyTimerRef.current = setTimeout(() => setGradeReady(true), GRADE_READY_DELAY_MS);
  }

  async function handleGrade(grade) {
    if (!currentWord || savingRef.current || !flipped || !gradeReady || !answerReady) return;
    savingRef.current = true;
    // iOS 는 누른 순간 안에서만 오디오를 켤 수 있어서 저장을 기다리기 전에 준비해 둔다
    prepareSound();
    setSaving(true);

    try {
      await db.transaction('rw', db.reviews, db.reviewLogs, async () => {
        const review = await db.reviews.get(currentWord.id) ?? createInitialReview(currentWord.id);
        const updated = gradeCard(review, grade);
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
      savingRef.current = false;
      return;
    }

    // 저장이 실패하면 카드가 안 넘어가므로 성공한 뒤에만 소리를 낸다
    playNextSound();
    setSaveError(null);
    setSaving(false);
    savingRef.current = false;
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

  function skipUnavailable() {
    if (!currentWord || answerReady || kanji.status === 'loading' || savingRef.current) return;
    setSkippedIds(previous => new Set([...previous, currentWord.id]));
    setFlipped(false);
    setGradeReady(false);
    setCurrentIndex(index => index + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">&#x26A0;&#xFE0F;</p>
        <p className="text-lg font-medium text-slate-800 dark:text-slate-100">데이터 로드 실패</p>
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
        <p className="text-lg font-medium text-slate-800 dark:text-slate-100">복습할 {isKanji ? '한자가' : '단어가'} 없습니다</p>
        <p className="text-sm text-slate-400 mt-2">내일 다시 확인해보세요</p>
        <Link to={returnPath} className="text-indigo-600 dark:text-indigo-400 font-medium text-sm mt-4 inline-block">돌아가기</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-12 space-y-6">
        <p className="text-4xl">&#x2705;</p>
        <p className="text-lg font-medium text-slate-800 dark:text-slate-100">{skippedIds.size ? '복습 종료' : '복습 완료!'}</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-red-50 dark:bg-red-950/50 rounded-xl p-3">
            <p className="text-red-600 dark:text-red-400 font-medium">{results.again}</p>
            <p className="text-slate-400">모름</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/50 rounded-xl p-3">
            <p className="text-amber-700 dark:text-amber-300 font-medium">{results.hard}</p>
            <p className="text-slate-400">애매</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/50 rounded-xl p-3">
            <p className="text-green-700 dark:text-green-300 font-medium">{results.good}</p>
            <p className="text-slate-400">앎</p>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          {chapter != null ? `${formatLesson(step, chapter)} · ` : tagParam ? `${tagParam} · ` : ''}{wordCount - skippedIds.size}개 {isKanji ? '한자' : '단어'} 복습 완료
        </p>
        {skippedIds.size > 0 && <p className="text-sm text-slate-400">정보를 확인하지 못한 {skippedIds.size}개는 학습 기록 없이 건너뛰었습니다.</p>}
        <Link to={returnPath} className="text-indigo-600 dark:text-indigo-400 font-medium text-sm inline-block">{isKanji ? '레슨 선택으로' : '돌아가기'}</Link>
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
    <div className={`flex-1 min-h-0 flex flex-col ${isKanji ? 'kanji-review' : ''}`}>
      {isKanji ? <header className="kanji-review-header shrink-0">
        <div className="kanji-modal-header">
          <h1>한자 복습</h1>
          <div className="kanji-modal-actions">
            <KanjiReplayButton disabled={!flipped || !answerReady} onClick={() => setReplay(value => value + 1)} />
            <Link to={returnPath} className="kanji-review-close" aria-label="한자 복습 닫기">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
              닫기
            </Link>
          </div>
        </div>
        <div className="kanji-review-context">
          <span>{formatLesson(currentWord.step, currentWord.chapter)} · {reverse ? '뜻 → 한자' : '한자 → 뜻'}</span>
          <span>{isReview ? `${progressCurrent} / ${progressTotal}` : `재복습 ${progressCurrent} / ${progressTotal}`}</span>
        </div>
        <div className="h-[3px] bg-slate-200 dark:bg-slate-700"><div className="h-full bg-indigo-500" style={{ width: `${progressPct}%` }} /></div>
      </header> : <header className="shrink-0 safe-top">
        <div className="flex items-center gap-2 h-[72px] pl-1 pr-4">
          <Link
            to={returnPath}
            aria-label="복습 닫기"
            className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-500 dark:text-slate-400 text-2xl"
          >
            &times;
          </Link>
          <h1 className="flex-1 min-w-0 truncate text-[1rem] font-bold text-slate-800 dark:text-slate-100">{title}</h1>
          <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
            {isReview ? `${progressCurrent} / ${progressTotal}` : `재복습 ${progressCurrent} / ${progressTotal}`}
          </span>
        </div>
        <div className="h-[3px] bg-slate-200 dark:bg-slate-700">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </header>}

      {saveError && (
        <p className="shrink-0 mx-4 mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2 rounded-lg">저장 오류: {saveError}. 다시 평가해주세요.</p>
      )}

      <div ref={scrollRef} className={`flex-1 min-h-0 overflow-y-auto flex flex-col px-5 py-4 ${isKanji ? 'kanji-review-body' : ''}`}>
        {isKanji ? (!answerReady ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            {kanji.status === 'loading' ? <p role="status">한자 정보를 불러오는 중…</p> : <>
              <p role="alert">{kanji.status === 'error' ? '한자 정보를 불러오지 못했어요.' : '이 한자의 한국어 뜻을 아직 제공하지 않아요.'}</p>
              {kanji.status === 'error' && <button onClick={kanji.retry} className="text-indigo-600 dark:text-indigo-400 min-h-11">다시 시도</button>}
            </>}
          </div>
        ) : flipped ? (
          <KanjiContent key={currentIndex} character={currentWord.kanjiId} data={kanji.data} status={kanji.status} replay={replay}
            context={currentWord} sourceWords={currentWord.sourceWords} />
        ) : (
          <button type="button" onClick={handleFlip} className={`kanji-review-front ${reverse ? 'kanji-review-meaning' : ''}`} aria-label={`${reverse ? kanji.data.meaningsKo[0] : currentWord.kanjiId}, 정답 확인`}>
            <span lang={reverse ? 'ko' : 'ja'}>{reverse ? kanji.data.meaningsKo[0] : currentWord.kanjiId}</span>
          </button>
        )) : <FlashCard key={currentIndex} word={currentWord} sentence={sentence} reverse={reverse} flipped={flipped} onFlip={handleFlip} />}
      </div>

      <footer className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pt-2 safe-bottom-min">
        {isKanji && !answerReady ? (
          <button onClick={skipUnavailable} disabled={kanji.status === 'loading'} className="w-full h-14 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50">
            {kanji.status === 'loading' ? '불러오는 중…' : '건너뛰기'}
          </button>
        ) : flipped ? (
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
