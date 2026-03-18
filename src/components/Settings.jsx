import { useState } from 'react';
import { getApiKey, setApiKey, getModel, setModel, MODELS } from '../lib/gemini';
import { getGithubToken, setGithubToken, hasGithubToken, resetWordsInRepo } from '../lib/github';
import { exportData, importReviews, clearAllReviews, clearAllData } from '../lib/db';

const FONT_SIZES = [
  { id: 'small', label: '작게' },
  { id: 'medium', label: '보통' },
  { id: 'large', label: '크게' },
];

export default function Settings() {
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [selectedModel, setSelectedModel] = useState(getModel());
  const [githubToken, setGithubTokenState] = useState(getGithubToken());
  const [fontSize, setFontSize] = useState(localStorage.getItem('font-size') || 'medium');
  const [message, setMessage] = useState('');

  function handleFontSize(size) {
    setFontSize(size);
    localStorage.setItem('font-size', size);
    document.documentElement.className = `font-${size}`;
  }

  function showMessage(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  function handleSaveGemini() {
    setApiKey(apiKey);
    setModel(selectedModel);
    showMessage('Gemini 설정이 저장되었습니다.');
  }

  function handleSaveGithub() {
    setGithubToken(githubToken);
    showMessage('GitHub PAT가 저장되었습니다.');
  }

  async function handleExport() {
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `j-voca-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('백업 파일이 다운로드되었습니다.');
    } catch (err) {
      showMessage('내보내기 실패: ' + err.message);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.reviews) throw new Error('올바른 백업 파일이 아닙니다.');
      await importReviews(data.reviews);
      showMessage(`복원 완료: ${data.reviews.length}개 학습 기록`);
    } catch (err) {
      showMessage('가져오기 실패: ' + err.message);
    }
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">설정</h1>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">Gemini API</h2>
        <p className="text-xs text-slate-400">
          Google AI Studio에서 무료 API 키를 발급받으세요.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKeyState(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
          placeholder="API 키를 입력하세요"
        />
        <label className="text-sm text-slate-500">모델</label>
        <select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <button
          onClick={handleSaveGemini}
          className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
        >
          저장
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">GitHub 연동</h2>
        <p className="text-xs text-slate-400">
          단어를 GitHub에 저장합니다. Fine-grained PAT를 발급받으세요.
        </p>
        <input
          type="password"
          value={githubToken}
          onChange={e => setGithubTokenState(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
          placeholder="GitHub Personal Access Token"
        />
        <button
          onClick={handleSaveGithub}
          className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
        >
          저장
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">글자 크기</h2>
        <div className="grid grid-cols-3 gap-2">
          {FONT_SIZES.map(s => (
            <button
              key={s.id}
              onClick={() => handleFontSize(s.id)}
              className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                fontSize === s.id
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 text-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">학습 기록 백업</h2>
        <p className="text-xs text-slate-400">
          복습 기록은 브라우저에 저장됩니다. 정기적으로 백업하세요.
        </p>
        <button
          onClick={handleExport}
          className="w-full py-2 border border-slate-200 rounded-xl text-sm text-slate-600"
        >
          학습 기록 내보내기 (JSON)
        </button>
        <label className="block w-full py-2 border border-slate-200 rounded-xl text-sm text-slate-600 text-center cursor-pointer">
          학습 기록 가져오기 (JSON)
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100 space-y-3">
        <h2 className="font-medium text-red-600">초기화</h2>
        <p className="text-xs text-slate-400">
          되돌릴 수 없습니다. 단어 데이터는 GitHub에서 복구할 수 있습니다.
        </p>
        <button
          onClick={async () => {
            if (!confirm('모든 복습 진도를 삭제합니다. 계속할까요?')) return;
            await clearAllReviews();
            showMessage('학습 기록이 초기화되었습니다.');
          }}
          className="w-full py-2 border border-red-200 rounded-xl text-sm text-red-500"
        >
          학습 기록만 초기화
        </button>
        {hasGithubToken() && (
          <button
            onClick={async () => {
              const input = prompt('모든 단어와 학습 기록을 삭제합니다.\n확인하려면 "초기화"를 입력하세요.');
              if (input !== '초기화') return;
              try {
                await resetWordsInRepo();
                await clearAllData();
                showMessage('모든 데이터가 초기화되었습니다.');
              } catch (err) {
                showMessage('초기화 실패: ' + err.message);
              }
            }}
            className="w-full py-2 border border-red-300 bg-red-50 rounded-xl text-sm text-red-600 font-medium"
          >
            전체 초기화 (단어 + 학습 기록)
          </button>
        )}
      </div>

      {message && (
        <div className={`text-sm p-3 rounded-xl ${
          message.includes('실패') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>{message}</div>
      )}
    </div>
  );
}
