import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateWord, deleteWord } from '../lib/db';

export default function WordList() {
  const words = useLiveQuery(() => db.words.toArray(), [], []);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const chapters = [...new Set(words.map(w => w.chapter))].sort((a, b) => a - b);
  const filtered = selectedChapter !== null
    ? words.filter(w => w.chapter === selectedChapter)
    : words;

  function startEdit(word) {
    setEditingId(word.id);
    setEditForm({ word: word.word, reading: word.reading, meaning: word.meaning });
  }

  async function saveEdit(id) {
    await updateWord(id, editForm);
    setEditingId(null);
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteWord(id);
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
              제{ch}과 ({words.filter(w => w.chapter === ch).length})
            </button>
          ))}
        </div>
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
                    <button onClick={() => setEditingId(null)} className="text-xs text-slate-400">취소</button>
                    <button onClick={() => saveEdit(w.id)} className="text-xs text-indigo-600 font-medium">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-slate-800">{w.word}</span>
                    <span className="text-slate-400 text-sm ml-2">{w.reading}</span>
                    <p className="text-sm text-slate-500">{w.meaning}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => startEdit(w)} className="text-slate-400">수정</button>
                    <button onClick={() => handleDelete(w.id)} className="text-red-400">삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
