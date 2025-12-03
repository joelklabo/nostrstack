import { useEffect, useMemo, useRef, useState } from 'react';

type LogLine = { ts: number; level: string | number; message: string; data?: unknown };

type Props = {
  backendUrl: string;
  enabled?: boolean;
  theme?: 'light' | 'dark';
};

const levelColors: Record<string, string> = {
  debug: '#64748b',
  info: '#0ea5e9',
  warn: '#f59e0b',
  warning: '#f59e0b',
  error: '#ef4444'
};

const statusCopy: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  open: 'Streaming',
  error: 'Error',
  closed: 'Closed'
};

const paletteByTheme = {
  light: {
    panel: '#fff',
    border: '#e2e8f0',
    text: '#0f172a',
    sub: '#475569',
    muted: '#94a3b8',
    codeBg: '#f8fafc',
    inputBg: '#fff'
  },
  dark: {
    panel: '#0f172a',
    border: '#1f2937',
    text: '#e2e8f0',
    sub: '#cbd5e1',
    muted: '#475569',
    codeBg: '#111827',
    inputBg: '#0b1220'
  }
} as const;

export function LogViewer({ backendUrl, enabled = true, theme = 'light' }: Props) {
  const [backendLines, setBackendLines] = useState<LogLine[]>([]);
  const [frontendLines, setFrontendLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error' | 'closed'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [captureFront, setCaptureFront] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('nostrstack.logviewer.captureFront');
    return stored === 'true';
  });
  const [connectSeq, setConnectSeq] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const originalConsole = useRef<Partial<Console> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const palette = paletteByTheme[theme];

  const filteredBackend = useMemo(() => {
    if (!filter.trim()) return backendLines;
    const f = filter.toLowerCase();
    return backendLines.filter((l) => l.message.toLowerCase().includes(f));
  }, [backendLines, filter]);

  const filteredFront = useMemo(() => {
    if (!filter.trim()) return frontendLines;
    const f = filter.toLowerCase();
    return frontendLines.filter((l) => l.message.toLowerCase().includes(f));
  }, [frontendLines, filter]);

  useEffect(() => {
    if (!enabled) return;
    setStatus('connecting');
    setLastError(null);
    const es = new EventSource(backendUrl);
    eventSourceRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as LogLine;
        setBackendLines((prev) => [...prev.slice(-499), data]);
        setStatus('open');
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      setStatus('error');
      setLastError('Stream connection failed. Is the API running and reachable?');
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => {
        es.close();
        setConnectSeq((n) => n + 1);
      }, 2500);
    };
    es.onopen = () => setStatus('open');
    return () => {
      es.close();
      setStatus('closed');
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [backendUrl, enabled, connectSeq]);

  useEffect(() => {
    if (!captureFront) {
      if (originalConsole.current) {
        Object.assign(console, originalConsole.current);
        originalConsole.current = null;
      }
      if (typeof window !== 'undefined') window.localStorage.setItem('nostrstack.logviewer.captureFront', 'false');
      return;
    }
    if (typeof window !== 'undefined') window.localStorage.setItem('nostrstack.logviewer.captureFront', 'true');
    if (!originalConsole.current) {
      originalConsole.current = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
      };
    }
    const wrap = (level: keyof Console) =>
      (...args: unknown[]) => {
        const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        setFrontendLines((prev) => [...prev.slice(-499), { ts: Date.now(), level, message: msg }]);
        // @ts-expect-error
        originalConsole.current?.[level]?.apply(console, args);
      };
    console.log = wrap('log');
    console.info = wrap('info');
    console.warn = wrap('warn');
    console.error = wrap('error');
    console.debug = wrap('debug');
    return () => {
      if (originalConsole.current) {
        Object.assign(console, originalConsole.current);
        originalConsole.current = null;
      }
    };
  }, [captureFront]);

  const renderLine = (line: LogLine) => {
    const color = levelColors[String(line.level).toLowerCase()] ?? '#0f172a';
    const ts = new Date(line.ts).toLocaleTimeString();
    return (
      <div key={`${line.ts}-${line.message}-${Math.random()}`} className="logv__line" style={{ borderLeftColor: color }}>
        <span className="logv__ts">{ts}</span>
        <span className="logv__lvl" style={{ color }}>{line.level}</span>
        <span className="logv__msg">{line.message}</span>
      </div>
    );
  };

  const handleReconnect = () => {
    eventSourceRef.current?.close();
    setStatus('connecting');
    setLastError(null);
    setConnectSeq((n) => n + 1);
  };

  const tone = (() => {
    switch (status) {
      case 'open':
        return { bg: '#ecfdf3', border: '#bbf7d0', color: '#166534', glow: 'rgba(34,197,94,0.25)' };
      case 'connecting':
        return { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', glow: 'rgba(251,146,60,0.25)' };
      case 'error':
        return { bg: '#fef2f2', border: '#fecdd3', color: '#b91c1c', glow: 'rgba(239,68,68,0.28)' };
      default:
        return { bg: palette.codeBg, border: palette.border, color: palette.sub, glow: 'rgba(148,163,184,0.15)' };
    }
  })();

  return (
    <div className="logv" style={{ color: palette.text }}>
      <div className="logv__bar">
        <div className="logv__panel">
          <div className="logv__status-row">
            <div
              className="logv__pill"
              style={{
                background: tone.bg,
                borderColor: tone.border,
                boxShadow: `0 6px 16px ${tone.glow}`
              }}
            >
              <span className="logv__dot" style={{ background: tone.color, boxShadow: `0 0 0 0 ${tone.glow}`, animation: status === 'open' ? 'logv-pulse 1.8s infinite' : 'none' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="logv__pill-label">Backend stream</span>
                <span className="logv__pill-value" style={{ color: tone.color }}>{statusCopy[status]}</span>
              </div>
            </div>
            <button type="button" className="logv__ghost" onClick={handleReconnect}>
              Reconnect
            </button>
          </div>
          <div className="logv__meta">Source: {backendUrl}</div>
          {lastError && <div className="logv__error">{lastError}</div>}
        </div>

        <div className="logv__panel">
          <div className="logv__controls">
            <label className="logv__switch">
              <input type="checkbox" checked={captureFront} onChange={(e) => setCaptureFront(e.target.checked)} />
              <span className="logv__slider" />
              <span className="logv__switch-label">{captureFront ? 'Frontend capture on' : 'Capture frontend console'}</span>
            </label>
            <div className="logv__filter">
              <span className="logv__filter-icon">🔍</span>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter log text"
                aria-label="Filter logs"
                style={{ background: palette.inputBg, color: palette.text, borderColor: palette.border }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="logv__grid">
        <section className="logv__panel logv__stack" aria-live="polite">
          <header className="logv__header">
            <div className="logv__title">
              <strong>Backend logs</strong>
              <span className="logv__count">{filteredBackend.length}</span>
            </div>
            <button type="button" className="logv__ghost" onClick={() => setBackendLines([])}>Clear</button>
          </header>
          <div className="logv__scroll">
            {filteredBackend.length === 0 ? (
              <div className="logv__empty">No backend logs yet.</div>
            ) : (
              filteredBackend.map(renderLine)
            )}
          </div>
        </section>

        <section className="logv__panel logv__stack" aria-live="polite">
          <header className="logv__header">
            <div className="logv__title">
              <strong>Frontend logs</strong>
              <span className="logv__count">{filteredFront.length}</span>
            </div>
            <button type="button" className="logv__ghost" onClick={() => setFrontendLines([])}>Clear</button>
          </header>
          <div className="logv__scroll">
            {filteredFront.length === 0 ? (
              <div className="logv__empty">No frontend logs captured. Toggle capture to start.</div>
            ) : (
              filteredFront.map(renderLine)
            )}
          </div>
        </section>
      </div>

      <style>{`
        .logv { display: flex; flex-direction: column; gap: 0.9rem; }
        .logv__bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem; }
        .logv__panel { border: 1px solid ${palette.border}; border-radius: 14px; background: ${palette.panel}; padding: 0.75rem 0.9rem; box-shadow: 0 2px 10px rgba(15,23,42,0.04); }
        .logv__status-row { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .logv__pill { display: inline-flex; align-items: center; gap: 0.6rem; border-radius: 999px; border: 1px solid ${palette.border}; padding: 0.5rem 0.8rem; min-width: 200px; }
        .logv__pill-label { font-size: 0.8rem; letter-spacing: 0.04em; text-transform: uppercase; color: ${palette.sub}; font-weight: 700; }
        .logv__pill-value { font-weight: 800; font-size: 1rem; }
        .logv__dot { width: 12px; height: 12px; border-radius: 999px; }
        .logv__ghost { background: transparent; color: ${palette.text}; border: 1px solid ${palette.border}; border-radius: 10px; padding: 0.45rem 0.75rem; }
        .logv__ghost:hover { border-color: ${palette.sub}; }
        .logv__meta { font-size: 0.9rem; color: ${palette.sub}; margin-top: 0.4rem; }
        .logv__error { margin-top: 0.45rem; padding: 0.55rem 0.7rem; background: #fef2f2; border: 1px solid #fecdd3; color: #b91c1c; border-radius: 10px; }
        .logv__controls { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
        .logv__switch { display: inline-flex; align-items: center; gap: 0.55rem; cursor: pointer; color: ${palette.text}; font-weight: 700; }
        .logv__switch input { display: none; }
        .logv__slider { width: 44px; height: 24px; background: ${palette.border}; border-radius: 999px; position: relative; transition: all 0.2s ease; }
        .logv__slider::after { content: ''; position: absolute; top: 3px; left: 4px; width: 18px; height: 18px; border-radius: 999px; background: ${palette.panel === '#fff' ? '#0f172a' : '#e2e8f0'}; transition: transform 0.2s ease; }
        .logv__switch input:checked + .logv__slider { background: #22c55e55; }
        .logv__switch input:checked + .logv__slider::after { transform: translateX(18px); background: #22c55e; }
        .logv__switch-label { font-size: 0.95rem; color: ${palette.sub}; }
        .logv__filter { display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid ${palette.border}; background: ${palette.inputBg}; padding: 0.45rem 0.65rem; border-radius: 10px; min-width: 240px; }
        .logv__filter input { border: none; outline: none; width: 100%; background: transparent; color: ${palette.text}; }
        .logv__filter-icon { opacity: 0.7; }
        .logv__grid { display: grid; gap: 0.85rem; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
        .logv__stack { display: flex; flex-direction: column; gap: 0.55rem; min-height: 240px; }
        .logv__header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .logv__title { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 1.05rem; }
        .logv__count { background: ${palette.codeBg}; color: ${palette.sub}; border: 1px solid ${palette.border}; border-radius: 999px; padding: 0.1rem 0.55rem; font-size: 0.85rem; }
        .logv__scroll { display: flex; flex-direction: column; gap: 0.25rem; max-height: 340px; overflow: auto; padding: 0.15rem; border: 1px dashed ${palette.border}; border-radius: 10px; background: ${palette.codeBg}; }
        .logv__line { display: grid; grid-template-columns: 96px 70px 1fr; gap: 0.45rem; font-family: SFMono-Regular, Menlo, monospace; font-size: 0.88rem; padding: 0.25rem 0.4rem; border-left: 3px solid ${palette.sub}; }
        .logv__ts { color: ${palette.muted}; }
        .logv__lvl { font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
        .logv__msg { color: ${palette.text}; word-break: break-word; white-space: pre-wrap; }
        .logv__empty { color: ${palette.sub}; font-size: 0.95rem; padding: 0.45rem 0; }
        @keyframes logv-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.35); } 70% { box-shadow: 0 0 0 10px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
      `}</style>
    </div>
  );
}
