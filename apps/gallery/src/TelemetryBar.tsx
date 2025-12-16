import { useEffect, useState } from 'react';

export function TelemetryBar() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const addLog = (msg: string) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
    };

    const interval = setInterval(() => {
      const stats = [
        `MEM: ${Math.floor(Math.random() * 100)}%`,
        `CPU: ${Math.floor(Math.random() * 100)}%`,
        `RELAYS: CONNECTED`,
        `LATENCY: ${Math.floor(Math.random() * 200)}ms`
      ];
      addLog(stats[Math.floor(Math.random() * stats.length)]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="telemetry-log">
      <div style={{ padding: '0.5rem', background: 'var(--terminal-dim)', color: '#000', fontWeight: 'bold' }}>
        SYSTEM_MONITOR
      </div>
      <div style={{ padding: '0.5rem' }}>
        {logs.map((log, i) => (
          <div key={i} className="log-entry">{log}</div>
        ))}
      </div>
    </div>
  );
}
