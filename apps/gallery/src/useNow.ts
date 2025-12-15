import { useSyncExternalStore } from 'react';

let now = Date.now();
const listeners = new Set<() => void>();
let timer: number | null = null;

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function ensureTimer() {
  if (typeof window === 'undefined') return;
  if (timer != null) return;
  timer = window.setInterval(tick, 1000);
}

function stopTimerIfIdle() {
  if (typeof window === 'undefined') return;
  if (timer == null) return;
  if (listeners.size) return;
  window.clearInterval(timer);
  timer = null;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  ensureTimer();
  return () => {
    listeners.delete(onStoreChange);
    stopTimerIfIdle();
  };
}

function getSnapshot() {
  return now;
}

function getServerSnapshot() {
  return Date.now();
}

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

