import {
  type NostrstackQrPreset,
  type NostrstackQrRenderResult,
  type NostrstackQrStyleOptions,
  type NostrstackQrVerifyMode,
  renderQrCodeInto
} from '@nostrstack/embed';
import { useEffect, useMemo, useRef, useState } from 'react';

export type BrandedQrProps = {
  value: string;
  size?: number;
  preset?: NostrstackQrPreset;
  verify?: NostrstackQrVerifyMode;
  options?: NostrstackQrStyleOptions;
  className?: string;
  onResult?: (result: NostrstackQrRenderResult) => void;
};

export function BrandedQr({
  value,
  size = 256,
  preset = 'brand',
  verify = 'auto',
  options,
  className,
  onResult
}: BrandedQrProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onResultRef = useRef<typeof onResult>(onResult);
  const optionsRef = useRef<NostrstackQrStyleOptions | undefined>(options);
  const [state, setState] = useState<'idle' | 'rendering' | 'ok' | 'fallback' | 'error'>('idle');

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const optionsKey = useMemo(() => {
    if (!options) return '';
    try {
      return JSON.stringify(options);
    } catch {
      return '[unstringifiable-options]';
    }
  }, [options]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    setState('rendering');
    renderQrCodeInto(el, value, { size, preset, verify, options: optionsRef.current, signal: controller?.signal })
      .then((res) => {
        if (!alive || controller?.signal.aborted) return;
        onResultRef.current?.(res);
        if (res.ok) setState(res.fallbackUsed ? 'fallback' : 'ok');
        else setState('error');
      })
      .catch((err) => {
        if (!alive || controller?.signal.aborted) return;
        if (err && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name === 'AbortError') return;
        console.warn('qr render failed', err);
        setState('error');
      });
    return () => {
      alive = false;
      controller?.abort();
    };
  }, [value, size, preset, verify, optionsKey]);

  return <div ref={ref} className={className} data-qr-state={state} />;
}
