"use client";

import {
  createNostrstackBrandTheme,
  ensureNostrstackEmbedStyles,
  type NostrstackBrandPreset,
  type NostrstackTheme,
  type NostrstackThemeMode,
  themeToCssVars
} from '@nostrstack/embed';
import React, { createContext, useContext, useMemo } from 'react';

import type { ApiBaseResolution } from './api-base';

export type ThemeVars = {
  accent?: string;
  text?: string;
  surface?: string;
  border?: string;
};

export type NostrstackConfig = {
  apiBase?: string;
  apiBaseConfig?: ApiBaseResolution;
  baseUrl?: string;
  host?: string;
  lnAddress?: string;
  relays?: string[];
  enableRegtestPay?: boolean;
  theme?: ThemeVars;
  nostrstackTheme?: NostrstackTheme;
  brandPreset?: NostrstackBrandPreset;
  themeMode?: NostrstackThemeMode;
};

const NostrstackContext = createContext<NostrstackConfig>({});

export type NostrstackProviderProps = React.PropsWithChildren<NostrstackConfig> & {
  className?: string;
  style?: React.CSSProperties;
};

export function NostrstackProvider({ children, className, style, ...config }: NostrstackProviderProps) {
  const value = useMemo(() => config, [config]);
  const legacy = config.theme ?? {};
  React.useEffect(() => {
    ensureNostrstackEmbedStyles();
  }, []);
  const baseTheme: NostrstackTheme = {
    color: {
      primary: legacy.accent ?? '#f59e0b',
      text: legacy.text ?? '#0f172a',
      surface: legacy.surface ?? '#f8fafc',
      border: legacy.border ?? '#e2e8f0'
    }
  };

  const mode = config.nostrstackTheme?.mode ?? config.themeMode;
  const brandTheme =
    config.brandPreset ? createNostrstackBrandTheme({ preset: config.brandPreset, mode: mode ?? 'light' }) : undefined;

  const themeVars: React.CSSProperties = {
    ...themeToCssVars(baseTheme),
    ...(brandTheme ? themeToCssVars(brandTheme) : {}),
    ...themeToCssVars(config.nostrstackTheme ?? {}),
    // Legacy aliases (blog-kit v1)
    '--ns-accent': 'var(--nostrstack-color-primary)',
    '--ns-text': 'var(--nostrstack-color-text)',
    '--ns-surface': 'var(--nostrstack-color-surface)',
    '--ns-border': 'var(--nostrstack-color-border)',
    ...style
  } as React.CSSProperties;

  const mergedClassName = ['nostrstack', 'nostrstack-theme', className].filter(Boolean).join(' ');

  return (
    <NostrstackContext.Provider value={value}>
      <div className={mergedClassName} style={themeVars} data-nostrstack-theme={mode}>
        {children}
      </div>
    </NostrstackContext.Provider>
  );
}

export function useNostrstackConfig(): NostrstackConfig {
  return useContext(NostrstackContext);
}
