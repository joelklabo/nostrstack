import { useContext } from 'react';

import { RelayContext } from '../context/RelayProvider';

export function useRelays() {
  const context = useContext(RelayContext);
  if (!context) {
    throw new Error('useRelays must be used within a RelayProvider');
  }
  return context;
}
