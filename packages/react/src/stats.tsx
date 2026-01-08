import React, { createContext, type ReactNode,useCallback, useContext, useState } from 'react';

interface StatsContextType {
  eventCount: number;
  incrementEvents: (count?: number) => void;
}

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export function StatsProvider({ children }: { children: ReactNode }) {
  const [eventCount, setEventCount] = useState(0);

  const incrementEvents = useCallback((count = 1) => {
    setEventCount(prev => prev + count);
  }, []);

  return (
    <StatsContext.Provider value={{ eventCount, incrementEvents }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error('useStats must be used within StatsProvider');
  return ctx;
}
