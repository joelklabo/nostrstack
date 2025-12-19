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
          <span className="terminal-title">Sign in to NostrStack</span>
        </div>
        <div className="terminal-body">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--color-fg-default)' }}>Welcome back</h1>
            <p style={{ color: 'var(--color-fg-muted)' }}>Connect your Nostr identity to continue</p>
          </div>
          
          {error && (
            <div style={{ 
              backgroundColor: 'var(--color-danger-fg)', 
              color: 'white', 
              padding: '0.75rem', 
              borderRadius: '6px', 
              marginBottom: '1.5rem',
              fontSize: '0.9rem' 
            }}>
              {error}
            </div>
          )}

          {mode === 'menu' && (
            <div className="auth-options">
              <button className="auth-btn" onClick={() => loginWithNip07()}>
                Sign in with Extension (NIP-07)
              </button>
              <button className="auth-btn" style={{ background: 'transparent', borderStyle: 'dashed' }} onClick={() => setMode('nsec')}> 
                Enter nsec manually
              </button>
            </div>
          )}

          {mode === 'nsec' && (
            <div className="nsec-form">
              <div style={{ 
                fontSize: '0.8rem', 
                color: 'var(--color-attention-fg)', 
                marginBottom: '1rem',
                backgroundColor: '#fff8c5',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--color-attention-fg)'
              }}>
                <strong>Warning:</strong> Entering your private key directly is risky. Use a burner key or an extension if possible.
              </div>
              <input 
                type="password" 
                className="terminal-input"
                id="nsec-input"
                name="nsec"
                placeholder="nsec1..." 
                value={nsec}
                onChange={e => setNsec(e.target.value)}
              />
              <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
                <button className="auth-btn" style={{ backgroundColor: 'var(--color-accent-fg)', color: 'white', border: 'none' }} onClick={() => loginWithNsec(nsec).catch(() => {})}>
                  Sign in
                </button>
                <button 
                  className="auth-btn" 
                  style={{ width: 'auto', border: 'none' }} 
                  onClick={() => setMode('menu')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
