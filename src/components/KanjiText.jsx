import { isKanji } from '../lib/kanji';

/** Keep kana and punctuation as text; each Han character has its own action. */
export default function KanjiText({ text, onSelect }) {
  return [...text].map((character, index) => isKanji(character) ? (
    <button
      key={index}
      type="button"
      className="kanji-trigger"
      aria-label={`${character} 한자 뜻과 획순 보기`}
      aria-haspopup="dialog"
      onClick={event => {
        event.stopPropagation();
        onSelect(character);
      }}
    >{character}</button>
  ) : character);
}
