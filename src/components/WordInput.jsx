import { useState, useRef } from 'react';
import { extractWordsFromImage, getApiKey } from '../lib/gemini';
import { addWords, db } from '../lib/db';
import { createInitialReview } from '../lib/sm2';

export default function WordInput() {
  const [step, setStep] = useState('upload'); // upload | loading | preview | done
  const [chapter, setChapter] = useState('');
  const [textbook, setTextbook] = useState('');
  const [words, setWords] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!getApiKey()) {
      setError('설정에서 Gemini API 키를 먼저 입력해주세요.');
      return;
    }

    setError('');
    setStep('loading');

    try {
      const base64 = await fileToBase64(file);
      const extracted = await extractWordsFromImage(
        base64,
        file.type,
        Number(chapter) || 0,
        textbook
      );
      setWords(extracted);
      setStep('preview');
    } catch (err) {
      setError(err.message);
      setStep('upload');
    }
  }

  function updateWord(index, field, value) {
    setWords(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w));
  }

  function removeWord(index) {
    setWords(prev => prev.filter((_, i) => i !== index));
  }

  async function saveWords() {
    if (words.length === 0) return;
    try {
      const ids = await addWords(words);
      const reviews = ids.map(id => createInitialReview(id));
      await db.reviews.bulkAdd(reviews);
      setStep('done');
    } catch (err) {
      setError(err.message);
    }
  }

  function reset() {
    setWords([]);
    setStep('upload');
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">단어 입력</h1>

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-500">챕터 (과)</label>
              <input
                type="number"
                value={chapter}
                onChange={e => setChapter(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm"
                placeholder="예: 5"
              />
            </div>
            <div>
              <label className="text-sm text-slate-500">교재명</label>
              <input
                type="text"
                value={textbook}
                onChange={e => setTextbook(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm"
                placeholder="예: 민나노니홍고"
              />
            </div>
          </div>

          <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors">
            <span className="text-4xl block mb-2">📸</span>
            <span className="text-sm text-slate-500">교재 사진을 촬영하거나 선택하세요</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'loading' && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm text-slate-500">단어를 추출하는 중...</p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{words.length}개 단어를 찾았습니다. 수정 후 저장하세요.</p>

          {words.map((w, i) => (
            <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    value={w.word}
                    onChange={e => updateWord(i, 'word', e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-sm font-medium"
                    placeholder="단어"
                  />
                  <input
                    value={w.reading}
                    onChange={e => updateWord(i, 'reading', e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-sm"
                    placeholder="읽기"
                  />
                  <input
                    value={w.meaning}
                    onChange={e => updateWord(i, 'meaning', e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-sm col-span-2"
                    placeholder="뜻"
                  />
                </div>
                <button
                  onClick={() => removeWord(i)}
                  className="ml-2 text-slate-300 hover:text-red-400 text-lg"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm text-slate-600">
              다시하기
            </button>
            <button onClick={saveWords} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium">
              {words.length}개 저장
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">&#x2705;</p>
          <p className="text-lg font-medium text-slate-800">{words.length}개 단어가 저장되었습니다</p>
          <button onClick={reset} className="mt-4 text-indigo-600 font-medium text-sm">
            더 추가하기
          </button>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
