import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, syncWordsFromData, deleteReview } from '../lib/db';
import { hasGithubToken, updateWordInRepo, deleteWordFromRepo, deleteChapterFromRepo } from '../lib/github';

export default function WordList() {
  const words = useLiveQuery(() => db.words.toArray(), [], []);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const chapters = [...new Set(words.map(w => w.chapter))].sort((a, b) => a - b);
  const filtered = selectedChapter !== null
    ? words.filter(w => w.chapter === selectedChapter)
    : words;

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
    if (selectedChapter === null) return;
    const count = filtered.length;
    if (!confirm(`Lesson ${selectedChapter}의 단어 ${count}개를 모두 삭제하시겠습니까?`)) return;
    setSaving(true);
    try {
      const { data, deletedIds } = await deleteChapterFromRepo(selectedChapter);
      await syncWordsFromData(data.words);
      for (const id of deletedIds) await deleteReview(id);
      setSelectedChapter(null);
    } catch (err) {
      alert(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">단어 목록</h1>

      {chapters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedChapter(null)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              selectedChapter === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            전체 ({words.length})
          </button>
          {chapters.map(ch => (
            <button
              key={ch}
              onClick={() => setSelectedChapter(ch)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                selectedChapter === ch ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Lesson {ch} ({words.filter(w => w.chapter === ch).length})
            </button>
          ))}
        </div>
      )}

      {canEdit && selectedChapter !== null && filtered.length > 0 && (
        <button
          onClick={handleDeleteChapter}
          disabled={saving}
          className="w-full py-2 border border-red-200 rounded-xl text-sm text-red-500"
        >
          {saving ? '삭제 중...' : `Lesson ${selectedChapter} 전체 삭제 (${filtered.length}개)`}
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
