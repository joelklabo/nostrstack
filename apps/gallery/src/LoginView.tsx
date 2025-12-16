import { useAuth } from '@nostrstack/blog-kit';
import { useState } from 'react';

export function LoginView() {
  const { loginWithNip07, loginWithNsec, error } = useAuth();
  const [nsec, setNsec] = useState('');
  const [mode, setMode] = useState<'menu' | 'nsec'>('menu');

  return (
    <div className="login-container">
      <div className="login-terminal">
        <div className="terminal-header">
          <span className="terminal-dot red"></span>
          <span className="terminal-dot yellow"></span>
          <span className="terminal-dot green"></span>
          <span className="terminal-title">AUTH_GATEWAY</span>
        </div>
        <div className="terminal-body">
          <div className="ascii-art">
{`
 _   _           _            _             _    
| \\ | | ___  ___| |_ _ __ ___| |_ __ _  ___| | __
|  \\| |/ _ \\/ __| __| '__/ __| __/ _\` |/ __| |/ /
| |\\  | (_) \\__ \\ |_| |  \\__ \\ || (_| | (__|   < 
|_| \\_|\\___/|___/\\__|_|  |___/\\__\\__,_|\\___|_|\\_\\
`}
          </div>
          <p className="system-msg"> {'>'} SYSTEM READY. AUTHENTICATE TO PROCEED.</p>
          
          {error && <div className="error-msg">{`[ERROR]: ${error}`}</div>}

          {mode === 'menu' && (
            <div className="auth-options">
              <button className="auth-btn" onClick={() => loginWithNip07()}>
                <span className="key-icon">🔑</span> EXTENSION_AUTH (NIP-07)
              </button>
              <button className="auth-btn" onClick={() => setMode('nsec')}> 
                <span className="key-icon">🗝️</span> MANUAL_OVERRIDE (NSEC)
              </button>
            </div>
          )}

          {mode === 'nsec' && (
            <div className="nsec-form">
              <p className="warning-msg">WARNING: UNSAFE KEY ENTRY DETECTED. USE BURNER KEYS ONLY.</p>
              <input 
                type="password" 
                className="terminal-input"
                placeholder="nsec1..." 
                value={nsec}
                onChange={e => setNsec(e.target.value)}
              />
              <div className="form-actions">
                <button className="auth-btn" onClick={() => loginWithNsec(nsec)}>EXECUTE</button>
                <button className="text-btn" onClick={() => setMode('menu')}>CANCEL</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
