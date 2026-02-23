import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardShortcuts } from './useKeyboardShortcuts';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useKeyboardShortcuts', () => {
  it('opens help on ? even when focused element stops propagation', () => {
    const setCurrentView = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardShortcuts({ setCurrentView })
    );

    const blocker = document.createElement('button');
    blocker.type = 'button';
    blocker.textContent = 'Action button';
    blocker.addEventListener('keydown', (event) => {
      event.stopPropagation();
    });
    document.body.appendChild(blocker);
    blocker.focus();

    act(() => {
      blocker.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '?',
          code: 'Slash',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
          composed: true
        })
      );
    });

    expect(result.current.helpOpen).toBe(true);
  });
});
