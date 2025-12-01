"use client";

import React, { createContext, useContext, useMemo } from 'react';

export type ThemeVars = {
  accent?: string;
  text?: string;
  surface?: string;
  border?: string;
};

export type NostrstackConfig = {
  baseUrl?: string;
  host?: string;
  lnAddress?: string;
  relays?: string[];
  theme?: ThemeVars;
};

const NostrstackContext = createContext<NostrstackConfig>({});

export type NostrstackProviderProps = React.PropsWithChildren<NostrstackConfig> & {
  className?: string;
  style?: React.CSSProperties;
};

export function NostrstackProvider({ children, className, style, ...config }: NostrstackProviderProps) {
  const value = useMemo(() => config, [config]);
  const themeVars: React.CSSProperties = {
    '--ns-accent': config.theme?.accent ?? '#f59e0b',
    '--ns-text': config.theme?.text ?? '#0f172a',
    '--ns-surface': config.theme?.surface ?? '#f8fafc',
    '--ns-border': config.theme?.border ?? '#e2e8f0',
    ...style,
  } as React.CSSProperties;

  return (
    <NostrstackContext.Provider value={value}>
      <div className={className} style={themeVars}>
        {children}
      </div>
    </NostrstackContext.Provider>
  );
}

export function useNostrstackConfig(): NostrstackConfig {
  return useContext(NostrstackContext);
}
