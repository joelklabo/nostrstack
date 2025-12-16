import {
  type NostrstackQrPreset,
  nostrstackQrPresetOptions,
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

function mergeStyleOptions(
  ...parts: Array<NostrstackQrStyleOptions | undefined>
): NostrstackQrStyleOptions | undefined {
  const defined = parts.filter(Boolean) as NostrstackQrStyleOptions[];
  if (!defined.length) return undefined;

  const out: Record<string, unknown> = {};
  for (const part of defined) {
    for (const [k, v] of Object.entries(part)) {
      const prev = out[k];
      if (prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v)) {
        out[k] = { ...(prev as Record<string, unknown>), ...(v as Record<string, unknown>) };
      } else {
        out[k] = v;
      }
    }
  }
  return out as NostrstackQrStyleOptions;
}

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
  const [gradientStart, setGradientStart] = useState('#2563eb');
  const [gradientEnd, setGradientEnd] = useState('#6d28d9');
  const [useLogoUrl, setUseLogoUrl] = useState('');
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [overrideJson, setOverrideJson] = useState<string>('');
  const [lastResult, setLastResult] = useState<NostrstackQrRenderResult | null>(null);

  const overrideParse = useMemo(() => safeJsonParse(overrideJson), [overrideJson]);
  const styleOverrides = (overrideParse.value && typeof overrideParse.value === 'object'
    ? (overrideParse.value as NostrstackQrStyleOptions)
    : undefined) satisfies NostrstackQrStyleOptions | undefined;

  const uiOverrides = useMemo<NostrstackQrStyleOptions | undefined>(() => {
    const hasGradient = Boolean(gradientStart && gradientEnd);
    const hasLogo = logoEnabled && Boolean(useLogoUrl.trim());
    if (!hasGradient && !hasLogo) return undefined;

    const gradient = hasGradient
      ? {
          type: 'linear' as const,
          rotation: 0.25 * Math.PI,
          colorStops: [
            { offset: 0, color: gradientStart },
            { offset: 1, color: gradientEnd }
          ]
        }
      : undefined;

    const out: NostrstackQrStyleOptions = {};
    if (gradient) {
      out.dotsOptions = { type: 'rounded', gradient, roundSize: true };
      out.cornersSquareOptions = { type: 'extra-rounded', gradient };
      out.cornersDotOptions = { type: 'dot', gradient };
    }
    if (hasLogo) {
      out.qrOptions = { errorCorrectionLevel: 'H' };
      out.image = useLogoUrl.trim();
      out.imageOptions = {
        hideBackgroundDots: true,
        imageSize: 0.22,
        margin: 4,
        crossOrigin: 'anonymous'
      };
    }
    return out;
  }, [gradientStart, gradientEnd, logoEnabled, useLogoUrl]);

  const effectiveOverrides = useMemo(
    () => mergeStyleOptions(uiOverrides, styleOverrides),
    [uiOverrides, styleOverrides]
  );

  const merged = useMemo(() => {
    const base = nostrstackQrPresetOptions(preset);
    if (!effectiveOverrides) return base;
    return mergeStyleOptions(base as unknown as NostrstackQrStyleOptions, effectiveOverrides) ?? base;
  }, [preset, effectiveOverrides]);

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
            <CopyButton text={JSON.stringify({ preset, verify, size, options: effectiveOverrides ?? null }, null, 2)} label="Copy config" size="sm" />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
              padding: '0.75rem',
              borderRadius: 'var(--nostrstack-radius-lg)',
              border: '1px solid var(--nostrstack-color-border)',
              background: 'var(--nostrstack-color-surface-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong>Quick style controls</strong>
              <button
                type="button"
                className="nostrstack-btn nostrstack-btn--sm"
                onClick={() => {
                  setGradientStart('#2563eb');
                  setGradientEnd('#6d28d9');
                  setLogoEnabled(false);
                  setUseLogoUrl('');
                }}
              >
                Reset
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>Gradient</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} aria-label="Gradient start color" />
                  <input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} aria-label="Gradient end color" />
                  <code className="nostrstack-code" style={{ fontSize: '0.85rem' }}>
                    {gradientStart} → {gradientEnd}
                  </code>
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>Logo (URL or data URI)</span>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      name="qrLabLogoEnabled"
                      checked={logoEnabled}
                      onChange={(e) => setLogoEnabled(e.target.checked)}
                      aria-label="Enable logo"
                    />
                    <span style={{ fontWeight: 700 }}>Enable logo</span>
                  </div>
                  <input
                    className="nostrstack-input"
                    name="qrLabLogoUrl"
                    value={useLogoUrl}
                    onChange={(e) => setUseLogoUrl(e.target.value)}
                    aria-label="Logo URL"
                    placeholder="https://…/logo.png or data:image/svg+xml,…"
                    disabled={!logoEnabled}
                  />
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--nostrstack-color-text-muted)' }}>
                Tip: use <code>verify=strict</code> to auto-fallback if a branded style becomes hard to scan.
              </span>
            </div>
          </div>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontWeight: 800 }}>Override options (JSON)</span>
            <textarea
              className="nostrstack-input"
              name="qrLabOverrides"
              rows={8}
              value={overrideJson}
              onChange={(e) => setOverrideJson(e.target.value)}
              placeholder={'{\n  "margin": 6,\n  "dotsOptions": { "type": "rounded" }\n}'}
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
                options={effectiveOverrides}
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
