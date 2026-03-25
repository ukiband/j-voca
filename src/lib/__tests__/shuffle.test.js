import { describe, it, expect } from 'vitest';
import { shuffle } from '../shuffle';

describe('shuffle', () => {
  it('원본 배열을 변경하지 않는다', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  it('같은 길이의 배열을 반환한다', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(arr.length);
  });

  it('같은 요소를 포함한다', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('단일 요소 배열은 그대로 반환한다', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});
