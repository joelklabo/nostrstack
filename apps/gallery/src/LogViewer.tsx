import { useEffect, useMemo, useRef, useState } from 'react';

type LogLine = { ts: number; level: string | number; message: string; data?: unknown };

type Props = {
  backendUrl: string;
  enabled?: boolean;
};

const levelColors: Record<string, string> = {
  debug: '#64748b',
  info: '#0ea5e9',
  warn: '#f59e0b',
  warning: '#f59e0b',
  error: '#ef4444'
};

export function LogViewer({ backendUrl, enabled = true }: Props) {
  const [backendLines, setBackendLines] = useState<LogLine[]>([]);
  const [frontendLines, setFrontendLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error' | 'closed'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [captureFront, setCaptureFront] = useState(false);
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
        setStatus('connecting');
        setLastError(null);
        es.close();
      }, 3000);
    };
    es.onopen = () => setStatus('open');
    return () => {
      es.close();
      setStatus('closed');
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [backendUrl, enabled]);

  useEffect(() => {
    if (!captureFront) {
      if (originalConsole.current) {
        Object.assign(console, originalConsole.current);
        originalConsole.current = null;
      }
      return;
    }
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
      <div key={`${line.ts}-${line.message}-${Math.random()}`} style={{ display: 'grid', gridTemplateColumns: '90px 70px 1fr', gap: '0.4rem', fontFamily: 'SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' }}>
        <span style={{ color: '#94a3b8' }}>{ts}</span>
        <span style={{ color, fontWeight: 700, textTransform: 'uppercase' }}>{line.level}</span>
        <span style={{ color: '#0f172a', wordBreak: 'break-word' }}>{line.message}</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ padding: '0.35rem 0.65rem', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
          Backend: {status}{lastError ? ' – ' + lastError : ''}
        </span>
        <button type="button" onClick={() => { eventSourceRef.current?.close(); setStatus('connecting'); setLastError(null); }}>
          Reconnect
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={captureFront} onChange={(e) => setCaptureFront(e.target.checked)} />
          Capture frontend console
        </label>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter text" style={{ padding: '0.45rem 0.65rem', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 220 }} />
      </div>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.6rem', background: '#fff', minHeight: 220 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <strong>Backend logs</strong>
            <button type="button" onClick={() => setBackendLines([])}>Clear</button>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 320, overflow: 'auto' }}>
            {filteredBackend.map(renderLine)}
          </div>
        </section>
        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.6rem', background: '#fff', minHeight: 220 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <strong>Frontend logs</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setFrontendLines([])}>Clear</button>
            </div>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 320, overflow: 'auto' }}>
            {filteredFront.map(renderLine)}
          </div>
        </section>
      </div>
    </div>
  );
}
