import { useEffect, useRef, useState } from 'react';

import { copyToClipboard } from './clipboard';
import { useToast } from './toast';

export type CopyState = 'idle' | 'copied' | 'error';

export function toastMessageFromLabel(label: string) {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return 'Copied';
  const lower = trimmed.toLowerCase();
  if (lower === 'copy') return 'Copied';
  if (lower.startsWith('copy ')) return `Copied ${trimmed.slice(5)}`;
  return `${trimmed} copied`;
}

export function useCopyAction({
  text,
  label,
  successDurationMs = 1200,
  disabled,
  toastMessage,
}: {
  text: string;
  label: string;
  successDurationMs?: number;
  disabled?: boolean;
  toastMessage?: string;
}) {
  const toast = useToast();
  const [state, setState] = useState<CopyState>('idle');
  const timeoutRef = useRef<number | null>(null);
  const isDisabled = Boolean(disabled) || !text.trim();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = async (overrideText?: string) => {
    if (isDisabled) return false;
    try {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      const value = (overrideText ?? text).trim();
      if (!value) return false;
      await copyToClipboard(value);
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
      } catch {
        /* ignore */
      }
      setState('copied');
      toast({ message: toastMessage ?? toastMessageFromLabel(label), tone: 'success' });
      return true;
    } catch (err) {
      console.warn('copy failed', err);
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([15, 25, 15]);
      } catch {
        /* ignore */
      }
      setState('error');
      toast({ message: 'Copy failed', tone: 'danger' });
      return false;
    } finally {
      timeoutRef.current = window.setTimeout(() => setState('idle'), successDurationMs);
    }
  };

  return { state, copy, isDisabled };
}

