import { execFile } from 'node:child_process';
import path from 'node:path';

import type { FastifyInstance, RouteHandlerMethod } from 'fastify';

type PayResult = {
  payment_hash?: string;
  payment_preimage?: string;
  payment_route?: { total_fees?: number };
  payment_error?: string;
};

function runCompose(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('docker', args, { cwd }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.toString());
    });
  });
}

export async function registerRegtestPayRoute(app: FastifyInstance) {
  if (!app.config?.REGTEST_PAY_ENABLED) {
    app.log.warn('regtest pay disabled; /api/regtest/pay will return 404');
  }
  const handlerOpts = {
    schema: {
      body: {
        type: 'object',
        properties: { invoice: { type: 'string' } },
        required: ['invoice'],
        additionalProperties: false
      }
    }
  } as const;

  const handler: RouteHandlerMethod = async (request, reply) => {
    if (!app.config?.REGTEST_PAY_ENABLED) {
      return reply.code(404).send({ ok: false, error: 'regtest_pay_disabled' });
    }
    const { invoice } = request.body as { invoice: string };
    if (!invoice || invoice.length < 10) {
      request.log.warn({ invoiceLength: invoice?.length ?? 0 }, 'regtest pay invalid invoice');
      return reply.code(400).send({ ok: false, error: 'invalid_invoice' });
    }
    request.log.info({ invoicePrefix: invoice.slice(0, 12) }, 'regtest pay requested');

    // Compose file and CWD from server config/env
    const composeFile = app.config?.REGTEST_COMPOSE ?? path.resolve(process.cwd(), '..', '..', 'deploy', 'regtest', 'docker-compose.yml');
    const composeCwd = app.config?.REGTEST_CWD ?? path.dirname(composeFile);
    const composeArgs = ['compose', '-f', composeFile, 'exec', '-T', 'lnd-payer', 'sh', '-lc',
      `lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 --macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon --tlscertpath=/data/tls.cert payinvoice --force --json "${invoice}"`];

    try {
      const raw = await runCompose(composeArgs, composeCwd);
      let parsed: PayResult | null = null;
      try {
        parsed = JSON.parse(raw) as PayResult;
      } catch {
        parsed = null;
      }

      if (parsed?.payment_error) {
        request.log.warn({ err: parsed.payment_error }, 'regtest payinvoice failed');
        return reply.code(500).send({ ok: false, error: parsed.payment_error });
      }

      const fees = parsed?.payment_route?.total_fees ?? 0;
      const payload = { ok: true, payment_hash: parsed?.payment_hash, payment_preimage: parsed?.payment_preimage, fees_sat: fees };

      // Broadcast to any live listeners that this invoice was paid
      if (parsed?.payment_hash && app.payEventHub) {
        let metadata: unknown | undefined;
        let action: string | undefined;
        let itemId: string | undefined;
        let amountSats = 0;
        try {
          const payment = await app.prisma.payment.findFirst({ where: { invoice } });
          if (payment) {
            amountSats = payment.amountSats;
            action = payment.action ?? undefined;
            itemId = payment.itemId ?? undefined;
            if (payment.metadata) {
              try {
                metadata = JSON.parse(payment.metadata) as unknown;
              } catch {
                metadata = payment.metadata;
              }
            }
          }
        } catch (err) {
          request.log.warn({ err }, 'regtest pay metadata lookup failed');
        }
        request.log.info({
          invoicePrefix: invoice.slice(0, 12),
          paymentHash: parsed.payment_hash,
          feesSat: fees
        }, 'regtest pay invoice settled');
        app.payEventHub.broadcast({
          type: 'invoice-paid',
          ts: Date.now(),
          pr: invoice,
          providerRef: parsed.payment_hash,
          amount: amountSats,
          action,
          itemId,
          metadata,
          source: 'regtest'
        });
      }

      return reply.send(payload);
    } catch (err) {
      request.log.error({ err }, 'regtest payinvoice exec failed');
      return reply.code(500).send({ ok: false, error: 'pay_failed', detail: err instanceof Error ? err.message : String(err) });
    }
  };

  app.post('/regtest/pay', handlerOpts, handler);
  app.post('/api/regtest/pay', handlerOpts, handler);
}
