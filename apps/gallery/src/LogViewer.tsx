import { useEffect, useMemo, useRef, useState } from 'react';

type LogLine = { ts: number; level: string | number; message: string; data?: unknown };

type Props = {
  backendUrl: string;
  enabled?: boolean;
};

const levelColors: Record<string, string> = {
  debug: 'var(--nostrstack-color-text-subtle)',
  info: 'var(--nostrstack-color-info)',
  warn: 'var(--nostrstack-color-warning)',
  warning: 'var(--nostrstack-color-warning)',
  error: 'var(--nostrstack-color-danger)'
};

const statusCopy: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  open: 'Streaming',
  error: 'Error',
  closed: 'Closed'
};

export function LogViewer({ backendUrl, enabled = true }: Props) {
  const [backendLines, setBackendLines] = useState<LogLine[]>([]);
  const [frontendLines, setFrontendLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error' | 'closed'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [filter, setFilter] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('nostrstack.logviewer.filter') ?? '';
  });
  const [captureFront, setCaptureFront] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('nostrstack.logviewer.captureFront');
    return stored === 'true';
  });
  const [connectSeq, setConnectSeq] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const originalConsole = useRef<Partial<Console> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const color = levelColors[String(line.level).toLowerCase()] ?? 'var(--nostrstack-color-text)';
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
        return {
          bg: 'color-mix(in oklab, var(--nostrstack-color-success) 14%, var(--nostrstack-color-surface))',
          border: 'color-mix(in oklab, var(--nostrstack-color-success) 35%, var(--nostrstack-color-border))',
          color: 'color-mix(in oklab, var(--nostrstack-color-success) 70%, var(--nostrstack-color-text))',
          dot: 'var(--nostrstack-color-success)',
          glow: 'color-mix(in oklab, var(--nostrstack-color-success) 25%, transparent)'
        };
      case 'connecting':
        return {
          bg: 'color-mix(in oklab, var(--nostrstack-color-warning) 14%, var(--nostrstack-color-surface))',
          border: 'color-mix(in oklab, var(--nostrstack-color-warning) 35%, var(--nostrstack-color-border))',
          color: 'color-mix(in oklab, var(--nostrstack-color-warning) 70%, var(--nostrstack-color-text))',
          dot: 'var(--nostrstack-color-warning)',
          glow: 'color-mix(in oklab, var(--nostrstack-color-warning) 25%, transparent)'
        };
      case 'error':
        return {
          bg: 'color-mix(in oklab, var(--nostrstack-color-danger) 14%, var(--nostrstack-color-surface))',
          border: 'color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border))',
          color: 'color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text))',
          dot: 'var(--nostrstack-color-danger)',
          glow: 'color-mix(in oklab, var(--nostrstack-color-danger) 25%, transparent)'
        };
      default:
        return {
          bg: 'var(--nostrstack-color-surface-strong)',
          border: 'var(--nostrstack-color-border)',
          color: 'var(--nostrstack-color-text-muted)',
          dot: 'var(--nostrstack-color-text-subtle)',
          glow: 'color-mix(in oklab, var(--nostrstack-color-text) 10%, transparent)'
        };
    }
  })();

  return (
    <div className="logv" style={{ color: 'var(--nostrstack-color-text)' }}>
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
              <span
                className="logv__dot"
                style={{
                  background: tone.dot,
                  animation: status === 'open' ? 'nostrstack-pulse-soft 1.8s infinite' : 'none',
                  ...(status === 'open' ? ({ '--nostrstack-pulse-color': tone.dot } as Record<string, string>) : {})
                } as React.CSSProperties}
              />
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
                className="nostrstack-input logv__filter-input"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  if (typeof window !== 'undefined') window.localStorage.setItem('nostrstack.logviewer.filter', e.target.value);
                }}
                placeholder="Filter log text"
                aria-label="Filter logs"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="logv__grid">
        <section className="logv__panel logv__stack" aria-live="polite">
          <header className="logv__header logv__header--sticky">
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
          <header className="logv__header logv__header--sticky">
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
        .logv__panel { border: 1px solid var(--nostrstack-color-border); border-radius: var(--nostrstack-radius-lg); background: var(--nostrstack-color-surface); padding: 0.75rem 0.9rem; box-shadow: var(--nostrstack-shadow-md); }
        .logv__status-row { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .logv__pill { display: inline-flex; align-items: center; gap: 0.6rem; border-radius: var(--nostrstack-radius-pill); border: 1px solid var(--nostrstack-color-border); padding: 0.5rem 0.8rem; min-width: 200px; }
        .logv__pill-label { font-size: 0.8rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--nostrstack-color-text-muted); font-weight: 700; }
        .logv__pill-value { font-weight: 800; font-size: 1rem; }
        .logv__dot { width: 12px; height: 12px; border-radius: 999px; }
        .logv__ghost { background: transparent; color: var(--nostrstack-color-text); border: 1px solid var(--nostrstack-color-border); border-radius: var(--nostrstack-radius-md); padding: 0.45rem 0.75rem; transition: border-color var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard), background var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard); }
        .logv__ghost:hover { border-color: var(--nostrstack-color-border-strong); background: color-mix(in oklab, var(--nostrstack-color-surface-strong) 60%, transparent); }
        .logv__meta { font-size: 0.9rem; color: var(--nostrstack-color-text-muted); margin-top: 0.4rem; }
        .logv__error { margin-top: 0.45rem; padding: 0.55rem 0.7rem; background: color-mix(in oklab, var(--nostrstack-color-danger) 12%, var(--nostrstack-color-surface)); border: 1px solid color-mix(in oklab, var(--nostrstack-color-danger) 35%, var(--nostrstack-color-border)); color: color-mix(in oklab, var(--nostrstack-color-danger) 70%, var(--nostrstack-color-text)); border-radius: var(--nostrstack-radius-md); }
        .logv__controls { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
        .logv__switch { display: inline-flex; align-items: center; gap: 0.55rem; cursor: pointer; color: var(--nostrstack-color-text); font-weight: 700; }
        .logv__switch input { display: none; }
        .logv__slider { width: 44px; height: 24px; background: var(--nostrstack-color-border); border-radius: var(--nostrstack-radius-pill); position: relative; transition: all var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard); }
        .logv__slider::after { content: ''; position: absolute; top: 3px; left: 4px; width: 18px; height: 18px; border-radius: var(--nostrstack-radius-pill); background: var(--nostrstack-color-surface); transition: transform var(--nostrstack-motion-fast) var(--nostrstack-motion-ease-standard); box-shadow: var(--nostrstack-shadow-sm); }
        .logv__switch input:checked + .logv__slider { background: color-mix(in oklab, var(--nostrstack-color-success) 35%, var(--nostrstack-color-border)); }
        .logv__switch input:checked + .logv__slider::after { transform: translateX(18px); background: var(--nostrstack-color-success); }
        .logv__switch-label { font-size: 0.95rem; color: var(--nostrstack-color-text-muted); }
        .logv__filter { position: relative; display: inline-flex; align-items: center; min-width: 240px; flex: 1; }
        .logv__filter-icon { position: absolute; left: 0.75rem; opacity: 0.65; pointer-events: none; }
        .logv__filter-input { padding-left: 2.1rem; }
        .logv__grid { display: grid; gap: 0.85rem; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
        .logv__stack { display: flex; flex-direction: column; gap: 0.55rem; min-height: 240px; max-height: 45vh; }
        .logv__header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .logv__header--sticky { position: sticky; top: 0; padding-top: 0.1rem; padding-bottom: 0.1rem; background: var(--nostrstack-color-surface); z-index: 2; }
        .logv__title { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 1.05rem; }
        .logv__count { background: var(--nostrstack-color-surface-strong); color: var(--nostrstack-color-text-muted); border: 1px solid var(--nostrstack-color-border); border-radius: var(--nostrstack-radius-pill); padding: 0.1rem 0.55rem; font-size: 0.85rem; }
        .logv__scroll { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-height: 180px; max-height: 100%; overflow: auto; padding: 0.15rem; border: 1px dashed var(--nostrstack-color-border); border-radius: var(--nostrstack-radius-md); background: var(--nostrstack-color-surface-subtle); }
        .logv__line { display: grid; grid-template-columns: 96px 70px 1fr; gap: 0.45rem; font-family: var(--nostrstack-font-mono); font-size: 0.88rem; padding: 0.25rem 0.4rem; border-left: 3px solid var(--nostrstack-color-text-subtle); }
        .logv__ts { color: var(--nostrstack-color-text-subtle); }
        .logv__lvl { font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
        .logv__msg { color: var(--nostrstack-color-text); word-break: break-word; white-space: pre-wrap; }
        .logv__empty { color: var(--nostrstack-color-text-muted); font-size: 0.95rem; padding: 0.45rem 0; }
      `}</style>
    </div>
  );
}
