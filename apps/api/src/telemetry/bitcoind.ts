export type BitcoindRpcCall = (method: string, params?: unknown[]) => Promise<unknown>;

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
};

const DEFAULT_RPC_URL = 'http://bitcoin:bitcoin@localhost:18443';
const DEFAULT_TIMEOUT_MS = 8000;

export function createBitcoindRpcCall(options: { rpcUrl?: string; timeoutMs?: number } = {}) {
  const rpcUrlRaw = options.rpcUrl ?? process.env.BITCOIND_RPC_URL ?? DEFAULT_RPC_URL;
  const rpcUrlParsed = new URL(rpcUrlRaw);
  const rpcAuthHeader =
    rpcUrlParsed.username || rpcUrlParsed.password
      ? 'Basic ' +
        Buffer.from(`${decodeURIComponent(rpcUrlParsed.username)}:${decodeURIComponent(rpcUrlParsed.password)}`).toString('base64')
      : undefined;
  // Drop creds from URL because undici/fetch rejects credentialed URLs
  rpcUrlParsed.username = '';
  rpcUrlParsed.password = '';
  const rpcUrl = rpcUrlParsed.toString();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const rpcCall: BitcoindRpcCall = async (method: string, params: unknown[] = []) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'telemetry', method, params });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (rpcAuthHeader) headers.Authorization = rpcAuthHeader;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(rpcUrl, { method: 'POST', headers, body, signal: controller.signal });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`rpc ${method} http ${res.status} ${txt}`);
      }
      const data = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };
      if (data.error) throw new Error(`rpc ${method} error ${data.error.code}: ${data.error.message}`);
      return data.result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`rpc ${method} timeout after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  return { rpcCall };
}

export async function fetchTelemetrySummary(
  rpcCall: BitcoindRpcCall,
  height: number,
  lastBlockTime?: number | null
): Promise<TelemetrySummary | null> {
  const hash = (await rpcCall('getblockhash', [height])) as string;
  if (!hash) return null;

  const block = (await rpcCall('getblock', [hash, 1])) as {
    time?: number;
    tx?: string[];
    nTx?: number;
    size?: number;
    weight?: number;
  };
  const time = Number(block.time) || Date.now() / 1000;
  const txs = Array.isArray(block.tx) ? block.tx.length : Number(block.nTx) || 0;
  const size = Number(block.size) || 0;
  const weight = Number(block.weight) || 0;
  const mempool = (await rpcCall('getmempoolinfo').catch(() => null)) as { size?: number; bytes?: number } | null;
  const networkInfo = (await rpcCall('getnetworkinfo').catch(() => null)) as {
    version?: number;
    subversion?: string;
    connections?: number;
  } | null;
  const blockchainInfo = (await rpcCall('getblockchaininfo').catch(() => null)) as { chain?: string } | null;

  const interval = lastBlockTime ? Math.max(0, time - lastBlockTime) : undefined;

  return {
    height,
    hash,
    time,
    txs,
    size,
    weight,
    interval,
    mempoolTxs: mempool?.size,
    mempoolBytes: mempool?.bytes,
    network: blockchainInfo?.chain,
    version: networkInfo?.version,
    subversion: networkInfo?.subversion,
    connections: networkInfo?.connections
  };
}
