import { describe, it, expect } from 'vitest';
import { normalizeAnswer, checkAnswer } from '../writing-utils';

describe('normalizeAnswer', () => {
  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeAnswer('  hello  ')).toBe('hello');
  });

  it('대문자를 소문자로 변환한다', () => {
    expect(normalizeAnswer('Hello')).toBe('hello');
  });

  it('전각 문자를 반각으로 변환한다', () => {
    // Ｈｅｌｌｏ -> hello
    expect(normalizeAnswer('\uff28\uff45\uff4c\uff4c\uff4f')).toBe('hello');
  });

  it('전각 스페이스를 반각으로 변환한다', () => {
    expect(normalizeAnswer('a\u3000b')).toBe('a b');
  });

  it('빈 문자열을 처리한다', () => {
    expect(normalizeAnswer('')).toBe('');
  });

  it('null/undefined를 빈 문자열로 처리한다', () => {
    expect(normalizeAnswer(null)).toBe('');
    expect(normalizeAnswer(undefined)).toBe('');
  });
});

describe('checkAnswer', () => {
  const word = { word: '食べる', reading: 'たべる', meaning: '먹다', pos: '동사' };

  it('한자 정답을 인식한다', () => {
    const result = checkAnswer('食べる', word);
    expect(result.correct).toBe(true);
    expect(result.expected).toBe('食べる');
    expect(result.reading).toBe('たべる');
  });

  it('히라가나 읽기 정답을 인식한다', () => {
    const result = checkAnswer('たべる', word);
    expect(result.correct).toBe(true);
  });

  it('오답을 감지한다', () => {
    const result = checkAnswer('のむ', word);
    expect(result.correct).toBe(false);
    expect(result.expected).toBe('食べる');
  });

  it('빈 입력은 오답으로 처리한다', () => {
    const result = checkAnswer('', word);
    expect(result.correct).toBe(false);
  });

  it('공백만 입력하면 오답으로 처리한다', () => {
    const result = checkAnswer('   ', word);
    expect(result.correct).toBe(false);
  });

  it('null word 필드를 안전하게 처리한다', () => {
    const result = checkAnswer('test', { word: null, reading: null });
    expect(result.correct).toBe(false);
    expect(result.expected).toBe('');
    expect(result.reading).toBe('');
  });

  it('undefined word 객체를 안전하게 처리한다', () => {
    const result = checkAnswer('test', undefined);
    expect(result.correct).toBe(false);
  });

  it('reading만 있는 단어도 정답 처리한다', () => {
    const readingOnly = { word: '', reading: 'すし', meaning: '초밥' };
    const result = checkAnswer('すし', readingOnly);
    expect(result.correct).toBe(true);
  });
});
