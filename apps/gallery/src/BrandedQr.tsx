import { renderQrCodeInto, type NostrstackQrPreset, type NostrstackQrRenderResult, type NostrstackQrStyleOptions, type NostrstackQrVerifyMode } from '@nostrstack/embed';
import { useEffect, useRef, useState } from 'react';

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
  const [state, setState] = useState<'idle' | 'rendering' | 'ok' | 'fallback' | 'error'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    setState('rendering');
    renderQrCodeInto(el, value, { size, preset, verify, options })
      .then((res) => {
        if (!alive) return;
        onResult?.(res);
        if (res.ok) setState(res.fallbackUsed ? 'fallback' : 'ok');
        else setState('error');
      })
      .catch((err) => {
        if (!alive) return;
        console.warn('qr render failed', err);
        setState('error');
      });
    return () => {
      alive = false;
    };
  }, [value, size, preset, verify, options, onResult]);

  return <div ref={ref} className={className} data-qr-state={state} />;
}
