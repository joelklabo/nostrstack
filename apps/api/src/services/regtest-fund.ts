import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const COMPOSE_FILE = process.env.REGTEST_COMPOSE ?? path.join(ROOT, 'deploy/regtest/docker-compose.yml');
const COMPOSE_CWD = process.env.REGTEST_CWD ?? path.dirname(COMPOSE_FILE);
const COMPOSE = ['compose', '-f', COMPOSE_FILE];
const LNBITS_URL = process.env.LN_BITS_URL ?? 'http://localhost:15001';
const LNBITS_API_KEY = process.env.LN_BITS_API_KEY;

async function ensureMinerWallet() {
  const hasWallet = await runCompose([
    'exec', '-T', 'bitcoind', 'sh', '-lc',
    "bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin listwallets | grep -q '\"miner\"'"
  ]).then(() => true).catch(() => false);
  if (hasWallet) return;
  await runCompose(['exec', '-T', 'bitcoind', 'sh', '-lc', "bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin loadwallet miner >/dev/null 2>&1 || bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin createwallet miner"]);
}

async function maybeBootstrapBlocks() {
  const heightRaw = await runCompose(['exec', '-T', 'bitcoind', 'sh', '-lc', 'bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin getblockcount']);
  const height = Number(heightRaw.trim());
  if (height >= 101) return 0;
  const toMine = 101 - height;
  await runCompose(['exec', '-T', 'bitcoind', 'sh', '-lc', `bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner generatetoaddress ${toMine} $(bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner getnewaddress)`]);
  return toMine;
}

export type FundResult = {
  minedBlocks: number;
  sentToMerchant: number;
  channelOpened: boolean;
  output: string;
  lnbitsTopup?: number;
  currentBlockHeight?: number;
};

export async function regtestFund(): Promise<FundResult> {
  await ensureMinerWallet();
  const mined = await maybeBootstrapBlocks();

  const addr = await runCompose([
    'exec', '-T', 'lnd-merchant', 'sh', '-lc',
    "lncli --network=regtest --lnddir=/data --rpcserver=lnd-merchant:10009 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert newaddress p2wkh | jq -r .address"
  ]);
  await runCompose([
    'exec', '-T', 'bitcoind', 'sh', '-lc',
    `bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner sendtoaddress ${addr.trim()} 1`]);
  await runCompose([
    'exec', '-T', 'bitcoind', 'sh', '-lc',
    'bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner generatetoaddress 6 $(bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner getnewaddress)'
  ]);

  const chan = await runCompose([
    'exec', '-T', 'lnd-merchant', 'sh', '-lc',
    "dest=$(lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert getinfo | jq -r .identity_pubkey); lncli --network=regtest --lnddir=/data --rpcserver=lnd-merchant:10009 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert listchannels | jq -e --arg pk $dest '.channels[] | select(.remote_pubkey==$pk)' >/dev/null || lncli --network=regtest --lnddir=/data --rpcserver=lnd-merchant:10009 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert openchannel --node_key=$dest --local_amt=500000 --sat_per_vbyte=1"
  ]).catch(() => '');

  let lnbitsTopup: number | undefined;
  if (LNBITS_API_KEY) {
    try {
      const amount = 100_000; // sats
      const invoice = await createLnbitsInvoice(amount);
      await payInvoiceWithPayer(invoice);
      lnbitsTopup = amount;
    } catch (err) {
      // swallow LNbits topup failures so faucet still succeeds
      console.info(`LNbits topup skipped (non-fatal): ${formatLnbitsError(err)}`);
    }
  }

  const currentBlockHeightRaw = await runCompose(['exec', '-T', 'bitcoind', 'sh', '-lc', 'bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin getblockcount']);
  const currentBlockHeight = Number(currentBlockHeightRaw.trim());

  return {
    minedBlocks: mined + 6,
    sentToMerchant: 1_00000000,
    channelOpened: !chan.includes('already'),
    output: chan,
    lnbitsTopup,
    currentBlockHeight
  };
}

function runCompose(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('docker', [...COMPOSE, ...args], { cwd: COMPOSE_CWD }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.toString());
    });
  });
}

async function createLnbitsInvoice(amount: number): Promise<string> {
  const res = await fetch(`${LNBITS_URL.replace(/\/$/, '')}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': LNBITS_API_KEY ?? ''
    },
    body: JSON.stringify({ out: false, amount, memo: 'regtest faucet topup' })
  });
  if (!res.ok) throw new Error(`lnbits invoice http ${res.status}`);
  const body = (await res.json()) as { payment_request?: string };
  if (!body.payment_request) throw new Error('lnbits invoice missing payment_request');
  return body.payment_request;
}

async function payInvoiceWithPayer(invoice: string) {
  await runCompose([
    'exec', '-T', 'lnd-payer', 'sh', '-lc',
    `lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert payinvoice --force --json ${invoice}`
  ]);
}

function formatLnbitsError(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
