import type { TelemetrySummary } from './bitcoind.js';

type MockSummaryOptions = {
  network?: string;
};

export function buildMockSummary(options: MockSummaryOptions = {}): TelemetrySummary {
  return {
    height: 820000,
    hash: '000000000000000000035c1ec826f03027878434757045197825310657158739',
    time: Math.floor(Date.now() / 1000),
    txs: 2500,
    size: 1500000,
    weight: 3990000,
    interval: 600,
    mempoolTxs: 15000,
    mempoolBytes: 35000000,
    network: options.network ?? 'mocknet',
    version: 70016,
    subversion: '/Satoshi:26.0.0/',
    connections: 8
  };
}
