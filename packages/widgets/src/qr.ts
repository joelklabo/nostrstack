import jsQR from 'jsqr';
import QRCode from 'qrcode';

/* eslint-disable @typescript-eslint/consistent-type-imports -- Dynamic imports for lazy-loaded module types */
type QrCodeStylingType = typeof import('qr-code-styling').default;
type QrCodeStylingOptions = import('qr-code-styling').Options;
type QrCodeStylingErrorCorrectionLevel = import('qr-code-styling').ErrorCorrectionLevel;
type QrCodeStylingGradient = import('qr-code-styling').Gradient;
/* eslint-enable @typescript-eslint/consistent-type-imports */

export type NsQrPreset = 'safe' | 'brand' | 'brandLogo';
export type NsQrVerifyMode = 'off' | 'auto' | 'strict';

export type NsQrStyleOptions = Partial<Omit<QrCodeStylingOptions, 'data' | 'width' | 'height'>>;

export type NsQrRenderOptions = {
  size?: number;
  preset?: NsQrPreset;
  verify?: NsQrVerifyMode;
  options?: NsQrStyleOptions;
  signal?: AbortSignal;
};

export type NsQrRenderResult =
  | {
      ok: true;
      fallbackUsed: false;
      decodedText: string;
      verifyEngine: 'barcode-detector' | 'jsqr' | 'none';
    }
  | {
      ok: true;
      fallbackUsed: true;
      decodedText: string;
      verifyEngine: 'barcode-detector' | 'jsqr' | 'none';
    }
  | { ok: false; fallbackUsed: boolean; error: string };

const DEFAULT_SIZE = 256;

const brandGradient: QrCodeStylingGradient = {
  type: 'linear',
  rotation: 0.25 * Math.PI,
  colorStops: [
    { offset: 0, color: '#2563eb' }, // blue-600
    { offset: 1, color: '#6d28d9' } // violet-700
  ]
};

const lightningLogoDataUri =
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M13%202%20L3%2014h7l-1%208%2012-14h-7l-1-6z%22/%3E%3C/svg%3E';

export function nsQrPresetOptions(preset: NsQrPreset): Omit<QrCodeStylingOptions, 'data'> {
  const base: Omit<QrCodeStylingOptions, 'data'> = {
    type: 'svg',
    shape: 'square',
    margin: 4,
    qrOptions: {
      errorCorrectionLevel: 'M'
    },
    backgroundOptions: {
      color: '#ffffff',
      round: 16
    },
    dotsOptions: {
      type: 'square',
      color: '#0b0b12'
    },
    cornersSquareOptions: {
      type: 'square',
      color: '#0b0b12'
    },
    cornersDotOptions: {
      type: 'square',
      color: '#0b0b12'
    }
  };

  if (preset === 'safe') return base;

  const brand: Omit<QrCodeStylingOptions, 'data'> = {
    ...base,
    dotsOptions: {
      type: 'rounded',
      gradient: brandGradient,
      roundSize: true
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
      gradient: brandGradient
    },
    cornersDotOptions: {
      type: 'dot',
      gradient: brandGradient
    }
  };

  if (preset === 'brand') return brand;

  return {
    ...brand,
    qrOptions: { errorCorrectionLevel: 'H' },
    image: lightningLogoDataUri,
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.22,
      margin: 4,
      crossOrigin: 'anonymous'
    }
  };
}

let qrCodeStylingPromise: Promise<QrCodeStylingType> | null = null;
async function loadQrCodeStyling(): Promise<QrCodeStylingType> {
  if (!qrCodeStylingPromise) {
    qrCodeStylingPromise = import('qr-code-styling').then((m) => m.default);
  }
  return qrCodeStylingPromise;
}

const activeRenderTokens = new WeakMap<HTMLElement, object>();

function shouldVerify(
  mode: NsQrVerifyMode,
  opts: Partial<Omit<QrCodeStylingOptions, 'data'>>
): boolean {
  if (mode === 'off') return false;
  if (mode === 'strict') return true;
  const hasGradient = Boolean(
    opts?.dotsOptions?.gradient ||
      opts?.cornersDotOptions?.gradient ||
      opts?.cornersSquareOptions?.gradient
  );
  const hasLogo = Boolean(opts?.image);
  return hasGradient || hasLogo;
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, img.naturalWidth || img.width || 1);
    canvas.height = Math.max(1, img.naturalHeight || img.height || 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeCanvas(
  canvas: HTMLCanvasElement
): Promise<{ ok: true; data: string; engine: 'barcode-detector' | 'jsqr' } | { ok: false }> {
  try {
    type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
      detect: (image: unknown) => Promise<Array<{ rawValue?: string }>>;
    };
    const BD = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (BD) {
      const detector = new BD({ formats: ['qr_code'] });
      const detections = await detector.detect(canvas);
      const raw = detections?.[0]?.rawValue;
      if (raw) return { ok: true, data: raw, engine: 'barcode-detector' };
    }
  } catch {
    // ignore and fall back
  }

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false };
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });
    if (decoded?.data) return { ok: true, data: decoded.data, engine: 'jsqr' };

    // Some branded QRs (gradients/logos) produce false negatives in jsQR unless binarized first.
    const hist = new Uint32Array(256);
    let count = 0;
    let sum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      const a = imageData.data[i + 3] ?? 0;
      const r = imageData.data[i] ?? 0;
      const g = imageData.data[i + 1] ?? 0;
      const b = imageData.data[i + 2] ?? 0;
      const lum =
        a < 20 ? 255 : Math.max(0, Math.min(255, Math.round((r * 299 + g * 587 + b * 114) / 1000)));
      hist[lum] = (hist[lum] ?? 0) + 1;
      count += 1;
      sum += lum;
    }

    // Otsu thresholding (global) for better contrast.
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t] ?? 0;
      if (wB === 0) continue;
      wF = count - wB;
      if (wF === 0) break;
      sumB += t * (hist[t] ?? 0);
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > varMax) {
        varMax = between;
        threshold = t;
      }
    }

    const bw = new Uint8ClampedArray(imageData.data.length);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const a = imageData.data[i + 3] ?? 0;
      const r = imageData.data[i] ?? 0;
      const g = imageData.data[i + 1] ?? 0;
      const b = imageData.data[i + 2] ?? 0;
      const lum =
        a < 20 ? 255 : Math.max(0, Math.min(255, Math.round((r * 299 + g * 587 + b * 114) / 1000)));
      const v = lum > threshold ? 255 : 0;
      bw[i] = v;
      bw[i + 1] = v;
      bw[i + 2] = v;
      bw[i + 3] = 255;
    }

    const decodedBw = jsQR(bw, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });
    if (decodedBw?.data) return { ok: true, data: decodedBw.data, engine: 'jsqr' };
  } catch {
    // ignore
  }

  return { ok: false };
}

async function renderFallbackImg(
  data: string,
  size: number,
  errorCorrectionLevel: QrCodeStylingErrorCorrectionLevel,
  signal?: AbortSignal
): Promise<HTMLImageElement> {
  throwIfAborted(signal);
  const scale = Math.max(4, Math.round(size / 42));
  const src = await QRCode.toDataURL(data, { errorCorrectionLevel, margin: 4, scale });
  throwIfAborted(signal);

  const img = document.createElement('img');
  img.alt = 'QR code';
  img.decoding = 'async';
  img.loading = 'eager';
  img.style.width = '100%';
  img.style.height = 'auto';
  img.style.display = 'block';
  img.style.borderRadius = 'var(--ns-radius-md)';
  img.src = src;
  return img;
}

function abortError() {
  const err = new Error('aborted');
  (err as unknown as { name?: string }).name = 'AbortError';
  return err;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function isAbortError(err: unknown) {
  return Boolean(
    err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name?: unknown }).name === 'AbortError'
  );
}

export async function renderQrCodeInto(
  container: HTMLElement,
  data: string,
  opts: NsQrRenderOptions = {}
): Promise<NsQrRenderResult> {
  const size = opts.size ?? DEFAULT_SIZE;
  const preset = opts.preset ?? 'brand';
  const verify = opts.verify ?? 'auto';
  const signal = opts.signal;
  const base = nsQrPresetOptions(preset);
  const options: Omit<QrCodeStylingOptions, 'data'> = {
    ...base,
    ...opts.options,
    width: size,
    height: size
  };

  const requestedEcl = (options.qrOptions?.errorCorrectionLevel ??
    base.qrOptions?.errorCorrectionLevel ??
    'M') as QrCodeStylingErrorCorrectionLevel;
  const needVerify = shouldVerify(verify, options);
  const token = {};
  if (signal) activeRenderTokens.set(container, token);
  const throwIfStale = () => {
    throwIfAborted(signal);
    if (signal && activeRenderTokens.get(container) !== token) throw abortError();
  };

  try {
    throwIfStale();
    const QRCodeStyling = await loadQrCodeStyling();
    throwIfStale();
    const next = document.createElement('div');
    const qr = new QRCodeStyling({ ...(options as QrCodeStylingOptions), data });
    qr.append(next);

    if (!needVerify) {
      throwIfStale();
      container.replaceChildren(...Array.from(next.childNodes));
      return { ok: true, fallbackUsed: false, decodedText: data, verifyEngine: 'none' };
    }

    const raw = await qr.getRawData('png');
    throwIfStale();
    if (!raw) throw new Error('Could not render QR bitmap for verification');
    const blob = raw instanceof Blob ? raw : new Blob([raw], { type: 'image/png' });
    const canvas = await blobToCanvas(blob);
    const decoded = await decodeCanvas(canvas);
    throwIfStale();
    if (decoded.ok && decoded.data === data) {
      container.replaceChildren(...Array.from(next.childNodes));
      return {
        ok: true,
        fallbackUsed: false,
        decodedText: decoded.data,
        verifyEngine: decoded.engine
      };
    }

    if (verify === 'strict') {
      throwIfStale();
      const fallbackImg = await renderFallbackImg(data, size, requestedEcl, signal);
      throwIfStale();
      container.replaceChildren(fallbackImg);
      return decoded.ok
        ? { ok: true, fallbackUsed: true, decodedText: decoded.data, verifyEngine: decoded.engine }
        : { ok: true, fallbackUsed: true, decodedText: data, verifyEngine: 'none' };
    }

    throwIfStale();
    container.replaceChildren(...Array.from(next.childNodes));
    return decoded.ok
      ? { ok: true, fallbackUsed: false, decodedText: decoded.data, verifyEngine: decoded.engine }
      : { ok: false, fallbackUsed: false, error: 'QR decode verification failed' };
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) throw err;
    try {
      const fallbackImg = await renderFallbackImg(data, size, requestedEcl, signal);
      throwIfStale();
      container.replaceChildren(fallbackImg);
      return {
        ok: false,
        fallbackUsed: true,
        error: err instanceof Error ? err.message : String(err)
      };
    } catch (fallbackErr) {
      if (isAbortError(fallbackErr) || signal?.aborted) throw fallbackErr;
      return {
        ok: false,
        fallbackUsed: true,
        error:
          fallbackErr instanceof Error
            ? fallbackErr.message
            : err instanceof Error
              ? err.message
              : String(err)
      };
    }
  }
}
