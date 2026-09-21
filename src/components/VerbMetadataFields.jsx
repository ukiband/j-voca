import { isPracticeVerb } from '../lib/verb-utils';

export default function VerbMetadataFields({ word, onChange }) {
  if (word.pos !== '동사') return null;
  const selected = word.isDictionaryForm && word.verbGroup ? String(word.verbGroup) : '';
  return (
    <fieldset className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
      <legend className="text-xs text-slate-500 dark:text-slate-400 px-1">동사 활용</legend>
      <label className="flex items-center gap-2 text-sm">
        <span>동사 분류</span>
        <select aria-label="동사 분류" value={selected} onChange={e => onChange({
          verbGroup: e.target.value ? Number(e.target.value) : null,
          isDictionaryForm: !!e.target.value,
          potentialAllowed: false,
        })} className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <option value="">연습 제외 / 분류 미확인</option>
          <option value="1">사전형 · 1류</option>
          <option value="2">사전형 · 2류</option>
          <option value="3">사전형 · 3류</option>
        </select>
      </label>
      {selected && <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={word.potentialAllowed === true} onChange={e => onChange({ potentialAllowed: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
        가능형도 연습
      </label>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {selected && !isPracticeVerb(word) ? '표기·읽기와 동사 분류를 확인해 주세요. 현재는 연습에 포함할 수 없습니다.' : '사전형으로 등록된 동사만 연습에 포함합니다.'}
      </p>
    </fieldset>
  );
}
