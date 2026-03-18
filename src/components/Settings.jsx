import { useState } from 'react';
import { getApiKey, setApiKey } from '../lib/gemini';
import { exportData, importData } from '../lib/db';

export default function Settings() {
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [message, setMessage] = useState('');

  function handleSaveKey() {
    setApiKey(apiKey);
    setMessage('API 키가 저장되었습니다.');
    setTimeout(() => setMessage(''), 2000);
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
      setMessage('백업 파일이 다운로드되었습니다.');
    } catch (err) {
      setMessage('내보내기 실패: ' + err.message);
    }
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.words || !data.reviews) throw new Error('올바른 백업 파일이 아닙니다.');
      await importData(data);
      setMessage(`복원 완료: ${data.words.length}개 단어, ${data.reviews.length}개 학습 기록`);
    } catch (err) {
      setMessage('가져오기 실패: ' + err.message);
    }
    e.target.value = '';
    setTimeout(() => setMessage(''), 3000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">설정</h1>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">Gemini API 키</h2>
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
        <button
          onClick={handleSaveKey}
          className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
        >
          저장
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-medium text-slate-700">데이터 관리</h2>
        <p className="text-xs text-slate-400">
          브라우저 데이터가 삭제될 수 있으니 정기적으로 백업하세요.
        </p>
        <button
          onClick={handleExport}
          className="w-full py-2 border border-slate-200 rounded-xl text-sm text-slate-600"
        >
          데이터 내보내기 (JSON)
        </button>
        <label className="block w-full py-2 border border-slate-200 rounded-xl text-sm text-slate-600 text-center cursor-pointer">
          데이터 가져오기 (JSON)
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>

      {message && (
        <div className={`text-sm p-3 rounded-xl ${
          message.includes('실패') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>{message}</div>
      )}
    </div>
  );
}
