import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../lib/db';
import { buildVerbQuestions, getPracticeVerbs, VERB_FORMS, verbReading } from '../lib/verb-utils';
import { selectedVerbForms, startVerbPractice, verbPracticeReducer } from '../lib/verb-practice';
import { useImmersive } from '../hooks/useImmersive';

const FORMS_KEY = 'verb-practice-forms';
function savedForms() {
  try { return selectedVerbForms(JSON.parse(localStorage.getItem(FORMS_KEY))); }
  catch { return ['te']; }
}

export default function VerbPractice() {
  // 같은 경로로 다시 들어와도 진행 상태는 이어 가지 않는다.
  const location = useLocation();
  return <Practice key={location.key} />;
}

function Practice() {
  const [words, setWords] = useState(null);
  const [error, setError] = useState(false);
  const [forms, setForms] = useState(savedForms);
  const [session, dispatch] = useReducer(verbPracticeReducer, null);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let active = true;
    db.words.toArray().then(rows => { if (active) setWords(rows); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  const verbs = useMemo(() => getPracticeVerbs(words ?? []), [words]);
  const questionCount = useMemo(() => buildVerbQuestions(verbs, forms).length, [verbs, forms]);
  const current = session?.queue[session.index];
  useImmersive(!!current);

  // 뒤집기 버튼과 다음 버튼의 위치가 같으므로 연속 탭이 답을 건너뛰지 않게 한다.
  useEffect(() => {
    setReady(false);
    if (!session?.flipped) return;
    const timer = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(timer);
  }, [session?.flipped, session?.index]);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [session?.index]);

  function start() {
    if (!questionCount) return;
    try { localStorage.setItem(FORMS_KEY, JSON.stringify(forms)); } catch {}
    setReady(false);
    dispatch({ type: 'start', session: startVerbPractice(verbs, forms) });
  }

  if (error) return (
    <div className="text-center py-16 space-y-4">
      <p>단어를 불러오지 못했습니다.</p>
      <Link to="/" className="text-indigo-600 dark:text-indigo-400">홈으로 돌아가기</Link>
    </div>
  );
  if (!words) return <p className="text-center py-16 text-slate-500 dark:text-slate-400" role="status">단어를 불러오는 중...</p>;

  if (!session) return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-slate-500 dark:text-slate-400">← 홈</Link>
        <h1 className="text-xl font-bold mt-4">동사 활용</h1>
      </div>
      {verbs.length ? <>
        <fieldset className="space-y-3">
          <legend className="font-medium mb-3">연습할 형태</legend>
          {VERB_FORMS.map(form => (
            <label key={form.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${forms.includes(form.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
              <input type="checkbox" checked={forms.includes(form.id)} onChange={e => setForms(prev => e.target.checked ? [...prev, form.id] : prev.filter(f => f !== form.id))} className="w-5 h-5 accent-indigo-600 shrink-0" />
              <span className="flex-1 min-w-0 flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium whitespace-nowrap">{form.label}</span>
                <span className="ml-auto text-sm text-slate-500 dark:text-slate-400 jp-text">{form.example}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button onClick={start} disabled={!questionCount} className="w-full py-4 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40">
          {forms.length ? '시작' : '연습할 형태를 선택하세요'}
        </button>
        {forms.length > 0 && questionCount === 0 && <p role="status" className="text-sm text-center text-slate-500 dark:text-slate-400">선택한 형태로 연습할 수 있는 동사가 없습니다.</p>}
      </> : <div className="py-10 text-center space-y-3">
        <p className="font-medium">연습할 사전형 동사가 없습니다.</p>
        <Link to="/words" className="inline-block text-indigo-600 dark:text-indigo-400 text-sm">단어 목록 보기</Link>
      </div>}
    </div>
  );

  if (!current) return (
    <div className="text-center py-16 space-y-5">
      <p className="text-4xl" aria-hidden="true">✓</p>
      <h1 className="text-xl font-bold">동사 활용 연습 완료</h1>
      <p className="text-slate-500 dark:text-slate-400">{session.initialCount}문제를 모두 연습했습니다.</p>
      <button onClick={start} className="block w-full py-3 rounded-xl bg-indigo-600 text-white">다시 섞어서 연습</button>
      <button onClick={() => dispatch({ type: 'start', session: null })} className="block w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700">형태 다시 선택</button>
      <Link to="/" className="inline-block text-indigo-600 dark:text-indigo-400 text-sm">홈으로 돌아가기</Link>
    </div>
  );

  const repeated = session.index >= session.initialCount;
  const number = repeated ? session.index - session.initialCount + 1 : session.index + 1;
  const total = repeated ? session.queue.length - session.initialCount : session.initialCount;
  const { word, answer, label } = current;

  function advance(type) {
    if (!ready) return;
    setReady(false);
    dispatch({ type });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="shrink-0 safe-top">
        <div className="flex items-center gap-2 min-h-[72px] pl-1 pr-4">
          <Link to="/" aria-label="동사 활용 닫기" className="w-11 h-11 shrink-0 flex items-center justify-center text-2xl text-slate-500 dark:text-slate-400">×</Link>
          <h1 className="flex-1 font-bold text-base">동사 활용</h1>
          <span className="text-sm text-slate-500 dark:text-slate-400">{repeated ? '한 번 더 ' : ''}{number} / {total}</span>
        </div>
        <div className="h-[3px] bg-slate-200 dark:bg-slate-700"><div className="h-full bg-indigo-500" style={{ width: `${number / total * 100}%` }} /></div>
      </header>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6 flex flex-col">
        <p className="text-center text-sm font-medium text-indigo-600 dark:text-indigo-400">{label}으로 바꿔 보세요.</p>
        {!session.flipped ? (
          <button onClick={() => dispatch({ type: 'flip' })} className="flex-1 py-8 text-center" aria-label={`${word.word}, 정답 확인`}>
            <span className="block text-[2rem] font-bold jp-text">{word.word}</span>
            {verbReading(word) !== word.word && <span className="block mt-3 text-[1.2rem] text-slate-500 dark:text-slate-400 jp-text">{verbReading(word)}</span>}
          </button>
        ) : (
          <div className="flex-1 flex flex-col justify-center py-8 text-center" aria-live="polite">
            <p className="text-lg text-slate-500 dark:text-slate-400 jp-text">{word.word}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{word.meaning}</p>
            <p className="mt-6 text-[2rem] font-bold text-indigo-600 dark:text-indigo-400 jp-text">{answer.word}</p>
            {answer.reading !== answer.word && <p className="mt-2 text-[1.2rem] text-slate-500 dark:text-slate-400 jp-text">{answer.reading}</p>}
            <p className="mt-6 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm">{answer.rule}</p>
          </div>
        )}
      </div>
      <footer className="shrink-0 px-4 pt-3 safe-bottom-min border-t border-slate-200 dark:border-slate-700">
        {!session.flipped ? <button onClick={() => dispatch({ type: 'flip' })} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium">뒤집기</button> : (
          <div className="flex gap-3">
            <button onClick={() => advance('again')} disabled={!ready} className="flex-1 py-4 rounded-xl bg-slate-200 dark:bg-slate-700 font-medium disabled:opacity-40">한 번 더</button>
            <button onClick={() => advance('next')} disabled={!ready} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-40">다음</button>
          </div>
        )}
      </footer>
    </div>
  );
}
