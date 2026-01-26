'use client';

import {
  createNsBrandTheme,
  ensureNsEmbedStyles,
  type NsBrandPreset,
  type NsTheme,
  type NsThemeMode,
  themeToCssVars
} from '@nostrstack/widgets';
import {
  createContext,
  type CSSProperties,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

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
  nwcUri?: string;
  nwcRelays?: string[];
  nwcMaxSats?: number;
  enableRegtestPay?: boolean;
  theme?: ThemeVars;
  nostrstackTheme?: NsTheme;
  brandPreset?: NsBrandPreset;
  themeMode?: NsThemeMode;
};

const NostrstackContext = createContext<NostrstackConfig>({});

export type NostrstackProviderProps = PropsWithChildren<NostrstackConfig> & {
  className?: string;
  style?: CSSProperties;
};

type StoredNwcConfig = {
  uri?: string;
  relays?: string[];
  maxSats?: number;
};

const NWC_STORAGE_KEY = 'nostrstack.nwc';

function readStoredNwcConfig(): StoredNwcConfig | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(NWC_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredNwcConfig;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function NostrstackProvider({
  children,
  className,
  style,
  ...config
}: NostrstackProviderProps) {
  const [storedNwc, setStoredNwc] = useState<StoredNwcConfig | null>(() => readStoredNwcConfig());
  const value = useMemo(
    () => ({
      ...config,
      nwcUri: config.nwcUri ?? storedNwc?.uri,
      nwcRelays: config.nwcRelays ?? storedNwc?.relays,
      nwcMaxSats: config.nwcMaxSats ?? storedNwc?.maxSats
    }),
    [config, storedNwc]
  );
  const legacy = config.theme ?? {};
  useEffect(() => {
    ensureNsEmbedStyles();
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === NWC_STORAGE_KEY) {
        setStoredNwc(readStoredNwcConfig());
      }
    };
    const handleCustom = (event: Event) => {
      const custom = event as CustomEvent<StoredNwcConfig | null>;
      setStoredNwc(custom.detail ?? null);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('nostrstack:nwc-update', handleCustom as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nostrstack:nwc-update', handleCustom as EventListener);
    };
  }, []);
  const baseTheme: NsTheme = {
    color: {
      // Use teal as default primary (matches design tokens)
      // oklch(0.60 0.15 185) = approximately #0d9488
      primary: legacy.accent ?? '#0d9488',
      text: legacy.text ?? '#0f172a',
      surface: legacy.surface ?? '#f8fafc',
      border: legacy.border ?? '#e2e8f0'
    }
  };

  const mode = config.nostrstackTheme?.mode ?? config.themeMode;
  const brandTheme = config.brandPreset
    ? createNsBrandTheme({ preset: config.brandPreset, mode: mode ?? 'light' })
    : undefined;

  const themeVars: CSSProperties = {
    ...themeToCssVars(baseTheme),
    ...(brandTheme ? themeToCssVars(brandTheme) : {}),
    ...themeToCssVars(config.nostrstackTheme ?? {}),
    // Legacy aliases (blog-kit v1)
    '--ns-accent': 'var(--ns-color-primary)',
    '--ns-text': 'var(--ns-color-text)',
    '--ns-surface': 'var(--ns-color-surface)',
    '--ns-border': 'var(--ns-color-border)',
    ...style
  } as CSSProperties;

  const mergedClassName = ['nostrstack', 'nostrstack-theme', className].filter(Boolean).join(' ');

  return (
    <NostrstackContext.Provider value={value}>
      <div className={mergedClassName} style={themeVars} data-ns-theme={mode}>
        {children}
      </div>
    </NostrstackContext.Provider>
  );
}

export function useNostrstackConfig(): NostrstackConfig {
  return useContext(NostrstackContext);
}
