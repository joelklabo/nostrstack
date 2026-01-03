import { SimplePool } from 'nostr-tools';
import { useRef } from 'react';

const globalPool = new SimplePool();

export function useSimplePool() {
  // We use a global singleton pool for the app to maximize connection reuse
  const poolRef = useRef(globalPool);
  return poolRef.current;
}
