import { useContext } from 'react';

import { RelayContext } from '../context/RelayProvider';

export function useRelays() {
  const context = useContext(RelayContext);
  return context;
}
