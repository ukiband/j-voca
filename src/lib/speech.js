export function speak(text) {
  return new Promise(resolve => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.8;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}
