import { describe, it, expect } from 'vitest';
import { getKstDateString } from '../date-utils';

describe('getKstDateString', () => {
  it('UTC 자정 직후는 한국에서는 같은 날 오전 9시라 같은 날짜', () => {
    expect(getKstDateString(new Date('2026-09-06T00:30:00Z'))).toBe('2026-09-06');
  });

  it('UTC 15시 이후는 한국에서 다음 날이 된다 (배치 러너가 UTC 여도 KST 날짜를 붙이기 위함)', () => {
    expect(getKstDateString(new Date('2026-09-06T15:00:00Z'))).toBe('2026-09-07');
    expect(getKstDateString(new Date('2026-09-06T14:59:59Z'))).toBe('2026-09-06');
  });
});
