import { useMemo } from 'react';
import { formatKanjiReading } from '../lib/kanji';
import { getKanjiSourceWords, readingKey } from '../lib/kanji-readings';
import { useKanjiReadings } from '../hooks/useKanjiReadings';

const EMPTY_WORDS = [];

function Readings({ kun, on }) {
  return <dl className="kanji-readings">
    {kun.length > 0 && <div><dt>훈독</dt><dd lang="ja">{kun.map(formatKanjiReading).join(' · ')}</dd></div>}
    {on.length > 0 && <div><dt>음독</dt><dd lang="ja">{on.join(' · ')}</dd></div>}
  </dl>;
}

export default function KanjiReadings({ character, data, sourceWords = EMPTY_WORDS, context, currentSource, sourceLabel = '현재 단어', sourcesLoading = false }) {
  const words = useMemo(() => getKanjiSourceWords(sourceWords, character, context, currentSource), [sourceWords, character, context, currentSource]);
  const study = useKanjiReadings(character, data, words);
  const other = Object.fromEntries(['kun', 'on'].map(kind => [kind, data[kind].filter(reading => !study[kind].includes(readingKey(reading)))]));
  const loading = sourcesLoading || study.loading;
  return <section className="kanji-study">
    <Readings kun={study.kun} on={study.on} />
    {loading && <p className="kanji-reading-note" role="status">학습 읽기를 확인하는 중…</p>}
    {!loading && words.length === 0 && <p className="kanji-reading-note">이 레슨에 등록된 학습 단어가 없어요.</p>}
    {study.rows.length > 0 && <ul className="kanji-source-words">
      {study.rows.map(({ word, matched }, index) => <li key={index}>
        <div className="kanji-source-heading">
          <span lang="ja">{word.word}</span>
          {word === currentSource && <span className="kanji-source-badge">{sourceLabel}</span>}
        </div>
        <p lang="ja" className="kanji-source-reading">{word.reading || '읽기 미등록'}</p>
        {word.meaning && <p className="kanji-source-meaning">{word.meaning}</p>}
        {!loading && !matched && word.reading && <p className="kanji-reading-note">{word === currentSource && sourceLabel === '현재 예문' ? '예문' : '단어'} 전체 읽기</p>}
      </li>)}
    </ul>}
    {(other.kun.length > 0 || other.on.length > 0) && <details className="kanji-dictionary" onClick={event => event.stopPropagation()}>
      <summary>사전의 다른 읽기</summary>
      <Readings kun={other.kun} on={other.on} />
    </details>}
  </section>;
}
