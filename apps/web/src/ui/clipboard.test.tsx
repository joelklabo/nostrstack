import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyToClipboard } from './clipboard';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('copyToClipboard', () => {
  it('uses the modern clipboard API when it succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    Object.defineProperty(window, 'navigator', {
      value: {
        ...window.navigator,
        clipboard: { writeText }
      },
      configurable: true
    });

    await copyToClipboard('hello world');

    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(appendChild).not.toHaveBeenCalled();
    expect(removeChild).not.toHaveBeenCalled();
  });

  it('falls back to legacy execCommand on NotAllowedError', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const getSelection = vi
      .spyOn(document, 'getSelection')
      .mockReturnValue({ rangeCount: 0, getRangeAt: vi.fn() } as unknown as Selection);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execCommand
    });

    Object.defineProperty(window, 'navigator', {
      value: {
        ...window.navigator,
        clipboard: { writeText }
      },
      configurable: true
    });

    await copyToClipboard('hello world');

    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(removeChild).toHaveBeenCalledTimes(1);
    expect(getSelection).toHaveBeenCalled();
  });
});
