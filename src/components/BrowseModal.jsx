import FlashCard from './FlashCard';

export default function BrowseModal({ browse }) {
  if (!browse.isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-hidden touch-none"
      onClick={browse.close}
    >
      <div className="bg-slate-50 rounded-2xl p-4 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">{browse.browseIndex + 1} / {browse.browseQueue.length}</span>
          <div className="flex items-center gap-3">
            {browse.listening ? (
              <button onClick={browse.stopListening} className="text-emerald-500 text-sm font-medium">■ 정지</button>
            ) : (
              <button onClick={() => browse.startListening(browse.browseQueue, browse.browseIndex)} className="text-emerald-500 text-sm font-medium">▶ 듣기</button>
            )}
            <button onClick={browse.close} className="text-slate-400 text-lg">&times;</button>
          </div>
        </div>
        <FlashCard
          key={browse.currentWord.id}
          word={browse.currentWord}
          onPrev={browse.prev}
          onNext={browse.next}
        />
      </div>
    </div>
  );
}
