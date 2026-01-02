export type TelemetrySource = 'bitcoind' | 'esplora' | 'mock';

export type TelemetrySummary = {
  height: number;
  hash: string;
  time: number;
  txs?: number;
  size?: number;
  weight?: number;
  interval?: number;
  mempoolTxs?: number;
  mempoolBytes?: number;
  network?: string;
  version?: number;
  subversion?: string;
  connections?: number;
  headers?: number;
  blocks?: number;
  verificationProgress?: number;
  initialBlockDownload?: boolean;
};

export type LnbitsHealth =
  | { status: 'skipped'; reason: 'provider_not_lnbits' }
  | { status: 'error'; error: 'LN_BITS_URL not set' }
  | { status: 'ok'; httpStatus: number; elapsedMs: number; body: string; urlTried: string }
  | { status: 'fail'; error: 'health endpoint not reachable'; elapsedMs: number };

export type BitcoinStatus = {
  network: string;
  configuredNetwork: string;
  source: TelemetrySource;
  telemetry: TelemetrySummary;
  telemetryError?: string;
  lightning: {
    provider: string;
    lnbits: LnbitsHealth;
  };
};
