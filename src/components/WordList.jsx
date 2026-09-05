import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, syncWordsFromData, deleteReview } from '../lib/db';
import { hasGithubToken, updateWordInRepo, deleteWordFromRepo, deleteChapterFromRepo } from '../lib/github';
import { filterWords } from '../lib/word-utils';
import { getStep, getSteps, getChapters, getLatestStep, formatLesson } from '../lib/lesson-utils';
import BrowseModal from './BrowseModal';
import { useBrowseMode } from '../hooks/useBrowseMode';

export default function WordList() {
  const words = useLiveQuery(() => db.words.toArray(), [], []);
  // selectedStep이 null이면 "아직 사용자가 고르지 않음" → 최신 step을 기본으로 쓴다.
  // 단어 로딩이 비동기라 마운트 시점엔 words가 비어 있으므로, 고정값 대신 렌더 시점에 계산한다.
  const [selectedStep, setSelectedStep] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const browse = useBrowseMode();

  const steps = getSteps(words);
  // 선택한 step이 삭제 등으로 사라졌으면 최신 step으로 되돌린다
  const currentStep = steps.includes(selectedStep) ? selectedStep : getLatestStep(words);
  const chapters = getChapters(words, currentStep);
  // 현재 step의 chapter별 단어 수 { [chapter]: count }. 칩 라벨과 레슨 삭제 개수에 쓴다.
  // 칩마다 filterWords를 돌리면 칩 수 × 단어 수 순회가 되므로 한 번만 순회해 맵으로 만든다.
  const countByChapter = useMemo(() => {
    const map = {};
    for (const w of words) {
      if (getStep(w) !== currentStep) continue;
      map[w.chapter] = (map[w.chapter] || 0) + 1;
    }
    return map;
  }, [words, currentStep]);
  const stepWordCount = Object.values(countByChapter).reduce((sum, n) => sum + n, 0);
  // 레슨 삭제는 검색어와 무관하게 레슨 전체를 지우므로, 확인 문구/버튼의 개수도 검색어를 뺀 값을 써야 한다
  const lessonWordCount = selectedChapter !== null ? (countByChapter[selectedChapter] || 0) : 0;
  // step/챕터 필터와 검색어를 조합하여 단어 필터링
  const filtered = filterWords(words, currentStep, selectedChapter, searchQuery);

  const canEdit = hasGithubToken();

  function startEdit(word) {
    setEditingId(word.id);
    setEditForm({ word: word.word, reading: word.reading, meaning: word.meaning });
  }

  async function saveEdit(id) {
    setSaving(true);
    try {
      const data = await updateWordInRepo(id, editForm);
      await syncWordsFromData(data.words);
      setEditingId(null);
    } catch (err) {
      alert(err.message);
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    setSaving(true);
    try {
      const data = await deleteWordFromRepo(id);
      await syncWordsFromData(data.words);
      await deleteReview(id);
    } catch (err) {
      alert(err.message);
    }
    setSaving(false);
  }

  async function handleDeleteChapter() {
    // step 2부터 chapter 번호가 겹치므로 (step, chapter) 둘 다 정해진 상태에서만 삭제한다
    if (selectedChapter === null) return;
    const label = formatLesson(currentStep, selectedChapter);
    if (!confirm(`${label}의 단어 ${lessonWordCount}개를 모두 삭제하시겠습니까?`)) return;
    setSaving(true);
    try {
      const { data, deletedIds } = await deleteChapterFromRepo(currentStep, selectedChapter);
      await syncWordsFromData(data.words);
      for (const id of deletedIds) await deleteReview(id);
      setSelectedChapter(null);
    } catch (err) {
      alert(err.message);
    }
    setSaving(false);
  }

  function selectChapter(ch) {
    setSelectedChapter(ch);
    browse.close();
  }

  // step을 바꾸면 chapter 번호 체계가 달라지므로 chapter 선택은 "전체"로 되돌린다
  function selectStep(step) {
    setSelectedStep(step);
    setSelectedChapter(null);
    browse.close();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">단어 목록</h1>

      {/* 검색 입력 */}
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="단어, 읽기, 뜻 검색..."
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
      />

      {/* step 칩: step이 하나뿐이면 고를 게 없으므로 숨긴다 */}
      {steps.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {steps.map(step => (
            <button
              key={step}
              onClick={() => selectStep(step)}
              className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${
                currentStep === step ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Step {step}
            </button>
          ))}
        </div>
      )}

      {/* 현재 step 안의 chapter 칩. "전체"는 해당 step의 전체 단어 */}
      {chapters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => selectChapter(null)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              selectedChapter === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            전체 ({stepWordCount})
          </button>
          {chapters.map(ch => (
            <button
              key={ch}
              onClick={() => selectChapter(ch)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                selectedChapter === ch ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {formatLesson(currentStep, ch, { withStep: false })} ({countByChapter[ch] || 0})
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => browse.open(filtered)}
            className="flex-1 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-600 font-medium"
          >
            플래시카드 ({filtered.length}개)
          </button>
          <button
            onClick={() => browse.openWithListening(filtered)}
            className="flex-1 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-600 font-medium"
          >
            듣기 모드
          </button>
        </div>
      )}

      <BrowseModal browse={browse} />

      {canEdit && selectedChapter !== null && lessonWordCount > 0 && (
        <button
          onClick={handleDeleteChapter}
          disabled={saving}
          className="w-full py-2 border border-red-200 rounded-xl text-sm text-red-500"
        >
          {saving ? '삭제 중...' : `${formatLesson(currentStep, selectedChapter)} 전체 삭제 (${lessonWordCount}개)`}
        </button>
      )}

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-slate-400">단어가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(w => (
            <div key={w.id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
              {editingId === w.id ? (
                <div className="space-y-2">
                  <input
                    value={editForm.word}
                    onChange={e => setEditForm(f => ({ ...f, word: e.target.value }))}
                    className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm"
                  />
                  <input
                    value={editForm.reading}
                    onChange={e => setEditForm(f => ({ ...f, reading: e.target.value }))}
                    className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm"
                  />
                  <input
                    value={editForm.meaning}
                    onChange={e => setEditForm(f => ({ ...f, meaning: e.target.value }))}
                    className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="text-xs text-slate-400" disabled={saving}>취소</button>
                    <button onClick={() => saveEdit(w.id)} className="text-xs text-indigo-600 font-medium" disabled={saving}>
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-slate-800">{w.word}</span>
                    <span className="text-slate-400 text-sm ml-2">{w.reading}</span>
                    <p className="text-sm text-slate-500">{w.meaning}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => startEdit(w)} className="text-slate-400">수정</button>
                      <button onClick={() => handleDelete(w.id)} className="text-red-400">삭제</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
