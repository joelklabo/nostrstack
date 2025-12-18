import { type NostrstackBrandPreset } from '@nostrstack/embed';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  brandPreset: NostrstackBrandPreset;
  setBrandPreset: (p: NostrstackBrandPreset) => void;
}

export function SettingsView({ theme, setTheme, brandPreset, setBrandPreset }: SettingsViewProps) {
  return (
    <div className="profile-view">
      <h3>SYSTEM_SETTINGS</h3>
      
      <div className="paywall-container">
        <h4 style={{ color: 'var(--terminal-dim)', marginBottom: '0.5rem' }}>VISUAL_THEME</h4>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="action-btn"
            style={{ borderColor: theme === 'dark' ? 'var(--terminal-text)' : undefined, color: theme === 'dark' ? 'var(--terminal-text)' : undefined }}
            onClick={() => setTheme('dark')}
          >
            DARK_MODE
          </button>
          <button 
            className="action-btn"
            style={{ borderColor: theme === 'light' ? 'var(--terminal-text)' : undefined, color: theme === 'light' ? 'var(--terminal-text)' : undefined }}
            onClick={() => setTheme('light')}
          >
            LIGHT_MODE
          </button>
        </div>
      </div>

      <div className="paywall-container">
        <h4 style={{ color: 'var(--terminal-dim)', marginBottom: '0.5rem' }}>BRAND_PRESET</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['default', 'ocean', 'sunset', 'midnight', 'emerald', 'crimson'].map(preset => (
            <button
              key={preset}
              className="action-btn"
              style={{ borderColor: brandPreset === preset ? 'var(--terminal-text)' : undefined, color: brandPreset === preset ? 'var(--terminal-text)' : undefined }}
              onClick={() => setBrandPreset(preset as NostrstackBrandPreset)}
            >
              {preset.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
