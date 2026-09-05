import { describe, it, expect, beforeEach } from 'vitest';
import { normalizePos, MODELS, getModel } from '../gemini';

// vitest 기본 환경(node)에는 localStorage가 없어서 Map 기반의 최소 구현을 주입한다
function createLocalStorageStub() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('normalizePos', () => {
  it('한자 표기를 한글로 변환한다', () => {
    expect(normalizePos('い形容詞')).toBe('い형용사');
    expect(normalizePos('な形容詞')).toBe('な형용사');
  });

  it('카타카나 한자 표기도 변환한다', () => {
    expect(normalizePos('イ形容詞')).toBe('い형용사');
    expect(normalizePos('ナ形容詞')).toBe('な형용사');
  });

  it('이미 올바른 표기는 그대로 반환한다', () => {
    expect(normalizePos('い형용사')).toBe('い형용사');
    expect(normalizePos('な형용사')).toBe('な형용사');
    expect(normalizePos('명사')).toBe('명사');
    expect(normalizePos('동사')).toBe('동사');
    expect(normalizePos('부사')).toBe('부사');
    expect(normalizePos('감탄사')).toBe('감탄사');
  });

  it('빈 값이나 null은 기타로 반환한다', () => {
    expect(normalizePos('')).toBe('기타');
    expect(normalizePos(null)).toBe('기타');
    expect(normalizePos(undefined)).toBe('기타');
  });

  it('매핑에 없는 값은 그대로 반환한다', () => {
    expect(normalizePos('연체사')).toBe('연체사');
  });
});

describe('getModel', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageStub();
  });

  it('저장된 값이 없으면 기본 모델을 반환한다', () => {
    expect(getModel()).toBe(MODELS[0].id);
  });

  it('유효한 모델이 저장되어 있으면 그대로 반환한다', () => {
    localStorage.setItem('gemini-model', 'gemini-2.5-flash');
    expect(getModel()).toBe('gemini-2.5-flash');
  });

  it('서비스 종료된 모델(gemini-2.0-flash)이 저장되어 있으면 기본 모델로 대체한다', () => {
    localStorage.setItem('gemini-model', 'gemini-2.0-flash');
    expect(getModel()).toBe(MODELS[0].id);
  });
});
