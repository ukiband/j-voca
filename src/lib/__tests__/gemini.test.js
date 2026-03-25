import { describe, it, expect } from 'vitest';
import { normalizePos } from '../gemini';

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
