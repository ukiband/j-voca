import { describe, it, expect, beforeEach, vi } from 'vitest';

// localStorage가 없는 환경(Node)에서도 테스트할 수 있도록 모의 객체 설정
const store = {};
const mockLocalStorage = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, val) => { store[key] = String(val); }),
  removeItem: vi.fn((key) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
vi.stubGlobal('localStorage', mockLocalStorage);

// 모의 localStorage가 설정된 뒤에 모듈 import
const { getAutoPronounce, setAutoPronounce, getFontSize, setFontSize, KEYS } = await import('../settings');

beforeEach(() => {
  mockLocalStorage.clear();
  vi.clearAllMocks();
});

describe('autoPronounce', () => {
  it('기본값은 false', () => {
    expect(getAutoPronounce()).toBe(false);
  });

  it('true로 설정하면 true 반환', () => {
    setAutoPronounce(true);
    expect(getAutoPronounce()).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(KEYS.AUTO_PRONOUNCE, 'true');
  });

  it('false로 설정하면 false 반환', () => {
    setAutoPronounce(true);
    setAutoPronounce(false);
    expect(getAutoPronounce()).toBe(false);
    expect(mockLocalStorage.setItem).toHaveBeenLastCalledWith(KEYS.AUTO_PRONOUNCE, 'false');
  });

  it('falsy 값은 false로 변환', () => {
    setAutoPronounce(null);
    expect(getAutoPronounce()).toBe(false);
    setAutoPronounce(0);
    expect(getAutoPronounce()).toBe(false);
  });
});

describe('fontSize', () => {
  it('기본값은 "base"', () => {
    expect(getFontSize()).toBe('base');
  });

  it('설정된 크기 반환', () => {
    setFontSize('large');
    expect(getFontSize()).toBe('large');
  });

  it('다른 크기로 변경 가능', () => {
    setFontSize('xlarge');
    expect(getFontSize()).toBe('xlarge');
    setFontSize('xxlarge');
    expect(getFontSize()).toBe('xxlarge');
  });
});
