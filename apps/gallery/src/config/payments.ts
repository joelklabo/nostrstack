export type PaymentConfig = {
  enableProfilePay: boolean;
  defaultSendSats: number;
  presetSendSats: number[];
};

const DEFAULT_SEND_SATS = 500;
const DEFAULT_PRESETS = [21, 100, 500];

function parseBoolean(raw?: string | null): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'true';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function parsePresetList(raw: string | undefined, fallback: number[]): number[] {
  if (!raw) return fallback;
  const entries = raw
    .split(/[\s,]+/)
    .map((item) => Number(item))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
  if (!entries.length) return fallback;
  return Array.from(new Set(entries));
}

export function resolvePaymentConfig(env: Record<string, string | undefined> = import.meta.env): PaymentConfig {
  const enableProfilePay = parseBoolean(env.VITE_ENABLE_PROFILE_PAY);
  const defaultSendSats = parsePositiveInt(env.VITE_SEND_SATS_DEFAULT, DEFAULT_SEND_SATS);
  const presetSendSats = parsePresetList(env.VITE_SEND_SATS_PRESETS, DEFAULT_PRESETS);
  return {
    enableProfilePay,
    defaultSendSats,
    presetSendSats
  };
}

export const paymentConfig = resolvePaymentConfig();
