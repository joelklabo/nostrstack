import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastTone = 'info' | 'success' | 'danger';

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastApi = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function createId() {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const remove = useCallback((id: string) => {
    const handle = timersRef.current.get(id);
    if (handle) window.clearTimeout(handle);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, tone = 'info', durationMs = 2200 }: ToastInput) => {
      const id = createId();
      const next: Toast = { id, message, tone, durationMs };
      setToasts((prev) => [next, ...prev].slice(0, 5));
      const handle = window.setTimeout(() => remove(id), durationMs);
      timersRef.current.set(id, handle);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="nostrstack-toast-region"
        data-testid="toast-region"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`nostrstack-toast nostrstack-toast--${t.tone}`}
            data-testid="toast"
            role="status"
          >
            <span className="nostrstack-toast__dot" aria-hidden="true" />
            <div className="nostrstack-toast__msg">{t.message}</div>
            <button
              type="button"
              className="nostrstack-btn nostrstack-btn--ghost nostrstack-btn--sm nostrstack-toast__close"
              aria-label="Dismiss toast"
              onClick={() => remove(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx.toast;
}

