import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import illustrations from '../../data/kanji-illustrations.json';
import { isKanji } from '../kanji';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('한자 배경 그림 설정', () => {
  function setupStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    vi.stubGlobal('localStorage', {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });
    vi.stubGlobal('window', new EventTarget());
    return values;
  }

  it('기본은 꺼짐이고 변경한 값을 다음 실행에서도 읽는다', async () => {
    setupStorage();
    let store = await import('../kanji-illustrations');
    expect(store.getKanjiIllustrationsEnabled()).toBe(false);
    store.setKanjiIllustrationsEnabled(true);
    vi.resetModules();
    store = await import('../kanji-illustrations');
    expect(store.getKanjiIllustrationsEnabled()).toBe(true);
    store.setKanjiIllustrationsEnabled(false);
    vi.resetModules();
    expect((await import('../kanji-illustrations')).getKanjiIllustrationsEnabled()).toBe(false);
  });

  it('열려 있는 화면에 설정 변경과 다른 탭의 변경을 알리고 구독을 해제한다', async () => {
    const values = setupStorage();
    const store = await import('../kanji-illustrations');
    const listener = vi.fn();
    const unsubscribe = store.subscribeToKanjiIllustrations(listener);
    store.setKanjiIllustrationsEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
    values.set(store.KANJI_ILLUSTRATIONS_KEY, 'false');
    window.dispatchEvent(Object.assign(new Event('storage'), { key: store.KANJI_ILLUSTRATIONS_KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getKanjiIllustrationsEnabled()).toBe(false);
    window.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated-setting' }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.setKanjiIllustrationsEnabled(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('저장이 차단돼도 실행 중에는 켜기·끄기가 동작한다', async () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw Error('blocked'); },
      setItem() { throw Error('blocked'); },
    });
    const store = await import('../kanji-illustrations');
    expect(store.getKanjiIllustrationsEnabled()).toBe(false);
    store.setKanjiIllustrationsEnabled(true);
    expect(store.getKanjiIllustrationsEnabled()).toBe(true);
    store.setKanjiIllustrationsEnabled(false);
    expect(store.getKanjiIllustrationsEnabled()).toBe(false);
  });

  it('등록한 글자에만 그림을 연결하며 다른 한자·단어·부수에서 추측하지 않는다', async () => {
    const { getKanjiIllustration } = await import('../kanji-illustrations');
    expect(getKanjiIllustration('備')).toMatchObject({ meaning: '갖추다', src: expect.stringMatching(/images\/kanji\/5099\.svg$/) });
    for (const value of ['木', '森', '亻', '準備', 'constructor', '../', '', null]) {
      expect(getKanjiIllustration(value)).toBeNull();
    }
  });
});

describe('Step 2 · Lesson 2 그림 자료', () => {
  const directory = new URL('../../../public/images/kanji/', import.meta.url);

  it('현재 시험 레슨 단어의 고유 한자 56자에 빠짐없이 그림이 있다', () => {
    const words = JSON.parse(readFileSync(new URL('../../../public/data/words.json', import.meta.url))).words;
    const characters = new Set(words.filter(w => w.step === 2 && w.chapter === 2)
      .flatMap(w => [...w.word].filter(isKanji)));
    expect(characters.size).toBe(56);
    expect(Object.keys(illustrations).sort()).toEqual([...characters].sort());
    expect(readdirSync(directory).filter(name => name.endsWith('.svg')).sort())
      .toEqual([...characters].map(c => `${c.codePointAt(0).toString(16)}.svg`).sort());
  });

  it('그림은 독립적인 정적 SVG이며 한자별 의미와 장면 설명을 보관한다', () => {
    const drawings = new Set();
    for (const [character, entry] of Object.entries(illustrations)) {
      expect(entry.meaning.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      const svg = readFileSync(new URL(`${character.codePointAt(0).toString(16)}.svg`, directory), 'utf8');
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg).toContain('<title>');
      expect(svg).not.toMatch(/<script|<foreignObject|<image|<text\b|\bon\w+=|\bhref=/i);
      drawings.add(svg.replace(/<title>.*?<\/title>/, ''));
    }
    expect(drawings.size).toBe(56);
  });
});
