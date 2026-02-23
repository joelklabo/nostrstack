import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useImmersiveScroll } from './useImmersiveScroll';

afterEach(() => {
  document.body.className = '';
  vi.restoreAllMocks();
});

describe('useImmersiveScroll', () => {
  it('returns isImmersive state', () => {
    const { result } = renderHook(() => useImmersiveScroll());
    expect(result.current.isImmersive).toBe(false);
  });

  it('returns setIsImmersive function', () => {
    const { result } = renderHook(() => useImmersiveScroll());
    expect(typeof result.current.setIsImmersive).toBe('function');
  });
});
