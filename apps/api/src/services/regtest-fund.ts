import { execFile } from 'node:child_process';

const COMPOSE = ['compose', '-f', 'deploy/regtest/docker-compose.yml'];

async function ensureMinerWallet() {
  await runCompose(['exec', '-T', 'bitcoind', 'bash', '-lc', "bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin loadwallet miner >/dev/null 2>&1 || bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin createwallet miner"]);
}

async function maybeBootstrapBlocks() {
  const heightRaw = await runCompose(['exec', '-T', 'bitcoind', 'bash', '-lc', 'bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin getblockcount']);
  const height = Number(heightRaw.trim());
  if (height >= 101) return 0;
  const toMine = 101 - height;
  await runCompose(['exec', '-T', 'bitcoind', 'bash', '-lc', `bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner generatetoaddress ${toMine} $(bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner getnewaddress)`]);
  return toMine;
}

export type FundResult = {
  minedBlocks: number;
  sentToMerchant: number;
  channelOpened: boolean;
  output: string;
};

export async function regtestFund(): Promise<FundResult> {
  await ensureMinerWallet();
  const mined = await maybeBootstrapBlocks();

  const addr = await runCompose([
    'exec', '-T', 'lnd-merchant', 'bash', '-lc',
    "lncli --network=regtest --lnddir=/data --rpcserver=lnd-merchant:10009 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert newaddress p2wkh | jq -r .address"
  ]);
  await runCompose([
    'exec', '-T', 'bitcoind', 'bash', '-lc',
    `bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner sendtoaddress ${addr.trim()} 1`]);
  await runCompose([
    'exec', '-T', 'bitcoind', 'bash', '-lc',
    'bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner generatetoaddress 6 $(bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=miner getnewaddress)'
  ]);

  const chan = await runCompose([
    'exec', '-T', 'lnd-merchant', 'bash', '-lc',
    "dest=$(lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert getinfo | jq -r .identity_pubkey); lncli --network=regtest --lnddir=/data --rpcserver=lnd-merchant:10009 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert listchannels | jq -e --arg pk $dest '.channels[] | select(.remote_pubkey==$pk)' >/dev/null || lncli --network=regtest --lnddir=/data --rpcserver=lnd-merchant:10009 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert openchannel --node_key=$dest --local_amt=500000 --sat_per_vbyte=1"
  ]).catch(() => '');

  return {
    minedBlocks: mined + 6,
    sentToMerchant: 1_00000000,
    channelOpened: !chan.includes('already'),
    output: chan
  };
}

function runCompose(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('docker', [...COMPOSE, ...args], { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.toString());
    });
  });
}
