import {
  nostrstackQrPresetOptions,
  type NostrstackQrPreset,
  type NostrstackQrRenderResult,
  type NostrstackQrStyleOptions,
  type NostrstackQrVerifyMode
} from '@nostrstack/embed';
import { useMemo, useState } from 'react';

import { BrandedQr } from './BrandedQr';
import { CopyButton } from './CopyButton';
import { JsonView } from './ui/JsonView';

export type QrLabCardProps = {
  suggestedValue?: string | null;
};

function safeJsonParse(input: string): { value: unknown; error: string | null } {
  const txt = input.trim();
  if (!txt) return { value: null, error: null };
  try {
    return { value: JSON.parse(txt), error: null };
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function QrLabCard({ suggestedValue }: QrLabCardProps) {
  const [value, setValue] = useState<string>(() => (suggestedValue ?? '').trim() || 'lightning:lnbc1...');
  const [preset, setPreset] = useState<NostrstackQrPreset>('brandLogo');
  const [verify, setVerify] = useState<NostrstackQrVerifyMode>('strict');
  const [size, setSize] = useState<number>(320);
  const [overrideJson, setOverrideJson] = useState<string>('');
  const [lastResult, setLastResult] = useState<NostrstackQrRenderResult | null>(null);

  const overrideParse = useMemo(() => safeJsonParse(overrideJson), [overrideJson]);
  const styleOverrides = (overrideParse.value && typeof overrideParse.value === 'object'
    ? (overrideParse.value as NostrstackQrStyleOptions)
    : undefined) satisfies NostrstackQrStyleOptions | undefined;

  const merged = useMemo(() => {
    const base = nostrstackQrPresetOptions(preset);
    if (!styleOverrides) return base;
    return { ...base, ...styleOverrides };
  }, [preset, styleOverrides]);

  const prettyValue = value.trim();
  const canSuggest = Boolean(suggestedValue && suggestedValue.trim());

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 1.1fr) minmax(280px, 0.9fr)',
          gap: '1rem',
          alignItems: 'start'
        }}
      >
        <div style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontWeight: 800 }}>Payload</span>
            <textarea
              className="nostrstack-input"
              name="qrLabPayload"
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Text to encode (BOLT11, lnurl, URI, URL, etc.)"
              style={{ resize: 'vertical', fontFamily: 'var(--nostrstack-font-mono)' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
                Preset
              </span>
              <select
                className="nostrstack-input"
                name="qrLabPreset"
                value={preset}
                onChange={(e) => setPreset(e.target.value as NostrstackQrPreset)}
              >
                <option value="safe">safe</option>
                <option value="brand">brand</option>
                <option value="brandLogo">brandLogo</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
                Verify
              </span>
              <select
                className="nostrstack-input"
                name="qrLabVerify"
                value={verify}
                onChange={(e) => setVerify(e.target.value as NostrstackQrVerifyMode)}
              >
                <option value="strict">strict (fallback on failure)</option>
                <option value="auto">auto (only for risky styles)</option>
                <option value="off">off</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 4, minWidth: 220 }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
                Render size
              </span>
              <input
                type="range"
                name="qrLabSize"
                min={200}
                max={520}
                step={20}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </label>

            {canSuggest && (
              <button
                type="button"
                className="nostrstack-btn nostrstack-btn--sm"
                onClick={() => setValue(suggestedValue!.trim())}
                title="Use the last invoice generated in the demo"
              >
                Use last invoice
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <CopyButton text={prettyValue} label="Copy payload" size="sm" />
            <CopyButton text={JSON.stringify({ preset, verify, size, options: styleOverrides ?? null }, null, 2)} label="Copy config" size="sm" />
          </div>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontWeight: 800 }}>Override options (JSON)</span>
            <textarea
              className="nostrstack-input"
              name="qrLabOverrides"
              rows={8}
              value={overrideJson}
              onChange={(e) => setOverrideJson(e.target.value)}
              placeholder={'{\n  \"margin\": 6,\n  \"dotsOptions\": { \"type\": \"rounded\" }\n}'}
              style={{ resize: 'vertical', fontFamily: 'var(--nostrstack-font-mono)' }}
            />
            {overrideParse.error && (
              <div className="nostrstack-status nostrstack-status--danger" role="status">
                Invalid JSON: {overrideParse.error}
              </div>
            )}
          </label>

          <JsonView title="Effective QR options" value={merged} maxHeight={260} />
        </div>

        <div style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }}>
          <div
            style={{
              borderRadius: 'var(--nostrstack-radius-lg)',
              border: '1px solid var(--nostrstack-color-border)',
              background:
                'radial-gradient(900px circle at top left, color-mix(in oklab, var(--nostrstack-color-primary) 12%, transparent), transparent 55%), var(--nostrstack-color-surface)',
              padding: '0.75rem',
              boxShadow: 'var(--nostrstack-shadow-md)',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <div style={{ width: 'min(360px, 100%)', borderRadius: 'var(--nostrstack-radius-md)', overflow: 'hidden', background: 'white', border: '1px solid var(--nostrstack-color-border)' }}>
              <BrandedQr
                value={prettyValue || ' '}
                preset={preset}
                verify={verify}
                size={size}
                options={styleOverrides}
                onResult={(r) => setLastResult(r)}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.5rem',
              padding: '0.75rem',
              borderRadius: 'var(--nostrstack-radius-lg)',
              border: '1px solid var(--nostrstack-color-border)',
              background: 'var(--nostrstack-color-surface-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <strong>Verification</strong>
              <span
                data-testid="qr-lab-status"
                className="nostrstack-status nostrstack-status--muted"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 999
                }}
              >
                {lastResult?.ok ? (lastResult.fallbackUsed ? 'Fallback used' : 'OK') : lastResult ? 'Error' : '—'}
              </span>
            </div>

            {lastResult?.ok ? (
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.9rem' }}>
                  Decoder: <code>{lastResult.verifyEngine}</code>
                </div>
                <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.9rem' }}>
                  Decoded: <code style={{ wordBreak: 'break-word' }}>{lastResult.decodedText.slice(0, 120)}{lastResult.decodedText.length > 120 ? '…' : ''}</code>
                </div>
              </div>
            ) : lastResult ? (
              <div className="nostrstack-status nostrstack-status--danger" role="status">
                {lastResult.error}
              </div>
            ) : (
              <div style={{ color: 'var(--nostrstack-color-text-muted)', fontSize: '0.9rem' }}>
                Render a QR to see verification results.
              </div>
            )}

            <JsonView title="Last render result" value={lastResult} maxHeight={220} />
          </div>
        </div>
      </div>
    </div>
  );
}
