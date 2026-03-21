import { useState } from 'react';
import { getApiKey, setApiKey, getModel, setModel, MODELS } from '../lib/gemini';
import { getGithubToken, setGithubToken, hasGithubToken, resetWordsInRepo } from '../lib/github';
import { exportData, importReviews, clearAllReviews, clearAllData, ensureReviewsExist } from '../lib/db';

const FONT_SIZES = [
  { id: 'base', label: '보통' },
  { id: 'large', label: '크게' },
  { id: 'xlarge', label: '더 크게' },
  { id: 'xxlarge', label: '최대' },
];

function ExtLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-500 underline">
      {children}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 01-1.06-1.06l5.47-5.47H12.25a.75.75 0 01-.75-.75z" clipRule="evenodd" />
      </svg>
    </a>
  );
}

export default function Settings() {
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [selectedModel, setSelectedModel] = useState(getModel());
  const [githubToken, setGithubTokenState] = useState(getGithubToken());
  const [fontSize, setFontSizeState] = useState(localStorage.getItem('font-size') || 'base');
  const [message, setMessage] = useState({ text: '', section: '' });

  function handleFontSize(size) {
    setFontSizeState(size);
    localStorage.setItem('font-size', size);
    document.documentElement.className = `font-${size}`;
  }

  function showMessage(msg, section = '') {
    setMessage({ text: msg, section });
    setTimeout(() => setMessage({ text: '', section: '' }), 3000);
  }

  function MessageBox({ section }) {
    if (!message.text || message.section !== section) return null;
    return (
      <div className={`text-sm p-3 rounded-xl ${
        message.text.includes('실패') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
      }`}>{message.text}</div>
    );
  }

  function handleSaveGemini() {
    setApiKey(apiKey);
    setModel(selectedModel);
    showMessage('Gemini 설정이 저장되었습니다.', 'gemini');
  }

  function handleSaveGithub() {
    setGithubToken(githubToken);
    showMessage('GitHub PAT가 저장되었습니다.', 'github');
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
      showMessage('백업 파일이 다운로드되었습니다.', 'backup');
    } catch (err) {
      showMessage('내보내기 실패: ' + err.message, 'backup');
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.reviews) throw new Error('올바른 백업 파일이 아닙니다.');
      await importReviews(data.reviews, data.reviewLogs);
      showMessage(`복원 완료: ${data.reviews.length}개 학습 기록`, 'backup');
    } catch (err) {
      showMessage('가져오기 실패: ' + err.message, 'backup');
    }
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">설정</h1>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">Gemini API</h2>
        <p className="text-xs text-slate-400">
          <ExtLink href="https://aistudio.google.com/apikey">Google AI Studio</ExtLink>에서 무료 API 키를 발급받으세요.
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
        <MessageBox section="gemini" />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">GitHub 연동</h2>
        <p className="text-xs text-slate-400">
          단어를 GitHub에 저장합니다.{' '}
          <ExtLink href="https://github.com/settings/personal-access-tokens/new">Fine-grained PAT</ExtLink>를 발급받으세요.
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
        <MessageBox section="github" />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">글자 크기</h2>
        <div className="grid grid-cols-4 gap-2">
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
        <MessageBox section="backup" />
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
            await ensureReviewsExist();
            showMessage('학습 기록이 초기화되었습니다.', 'reset');
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
                showMessage('모든 데이터가 초기화되었습니다.', 'reset');
              } catch (err) {
                showMessage('초기화 실패: ' + err.message, 'reset');
              }
            }}
            className="w-full py-2 border border-red-300 bg-red-50 rounded-xl text-sm text-red-600 font-medium"
          >
            전체 초기화 (단어 + 학습 기록)
          </button>
        )}
        <MessageBox section="reset" />
      </div>

      <p className="text-center text-xs text-slate-300">
        최근 업데이트: {(() => {
          const d = new Date(__BUILD_TIME__);
          return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        })()}
      </p>
    </div>
  );
}
