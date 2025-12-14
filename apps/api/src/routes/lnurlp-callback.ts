import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { getTenantForRequest, originFromRequest } from '../tenant-resolver.js';

export async function registerLnurlCallback(app: FastifyInstance) {
  // Withdraw (LNURLw) for payouts from tenant wallet (non-custodial: uses provider to create invoice request)
  app.get('/api/lnurlw', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          min: { type: 'integer', minimum: 1 },
          max: { type: 'integer', minimum: 1 }
        },
        required: ['min', 'max'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { min, max } = request.query as { min: number; max: number };
    return reply.send({
      tag: 'withdrawRequest',
      callback: `${originFromRequest(request, env.PUBLIC_ORIGIN)}/api/lnurlw/callback`,
      k1: 'stateless',
      minWithdrawable: min,
      maxWithdrawable: max,
      defaultDescription: 'nostrstack withdraw'
    });
  });

  app.get('/api/lnurlw/callback', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          pr: { type: 'string' },
          k1: { type: 'string' }
        },
        required: ['pr', 'k1'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    // Stateless accept of provided invoice; in real deployment validate amount/domain/tenant
    const { pr } = request.query as { pr: string; k1: string };
    // For OpenNode, we would call their payout API; here we just acknowledge.
    return reply.send({ status: 'OK', pr });
  });

  app.get('/api/lnurlp/:username/invoice', {
    schema: {
      params: {
        type: 'object',
        properties: { username: { type: 'string' } },
        required: ['username'],
        additionalProperties: false
      },
      querystring: {
        type: 'object',
        properties: {
          amount: { type: 'integer' }
        },
        required: ['amount'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { username } = request.params as { username: string };
    const { amount } = request.query as { amount: number };
    const tenant = await getTenantForRequest(app, request);
    const origin = originFromRequest(request, env.PUBLIC_ORIGIN);
    const identifier = `${username}@${tenant.domain}`;
    const user = await app.prisma.user.findFirst({
      where: { tenantId: tenant.id, lightningAddress: identifier }
    });
    if (!user) return reply.code(404).send({ status: 'not found' });

    // amount is in millisats per LNURL spec
    if (amount < 1000) {
      return reply.badRequest('Amount too low');
    }

    const amountSats = Math.ceil(amount / 1000);
    const charge = await app.lightningProvider.createCharge({
      amount: amountSats,
      description: `nostrstack payment to ${identifier}`,
      callbackUrl: `${origin}/api/lnurlp/${encodeURIComponent(username)}/webhook`,
      // LNbits uses a `webhook` field rather than OpenNode-style callbacks; our webhook handler updates Payment + broadcasts /ws/pay.
      webhookUrl: `${origin}/api/pay/webhook/lnbits`
    });

    await app.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        provider: env.LIGHTNING_PROVIDER,
        providerRef: charge.id,
        invoice: charge.invoice,
        amountSats,
        status: 'PENDING'
      }
    });

    return reply.send({
      pr: charge.invoice,
      routes: [],
      provider_ref: charge.id
    });
  });

  app.post('/api/lnurlp/:username/webhook', {
    schema: {
      params: {
        type: 'object',
        properties: { username: { type: 'string' } },
        required: ['username'],
        additionalProperties: false
      },
      body: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['id', 'status'],
        additionalProperties: true
      }
    },
    config: { rawBody: true }
  }, async (request, reply) => {
    const { username } = request.params as { username: string };
    const { id, status } = request.body as { id: string; status: string };
    const tenant = await getTenantForRequest(app, request);
    const raw = request.rawBody;
    const sig = request.headers['x-signature'] as string | undefined;
    // OpenNode signature check (only if configured)
    if (env.LIGHTNING_PROVIDER === 'opennode' && env.OP_NODE_WEBHOOK_SECRET) {
      if (!raw || !sig) return reply.code(401).send({ error: 'missing signature' });
      const { verifyOpenNodeSignature } = await import('../providers/opennode-signature.js');
      const ok = verifyOpenNodeSignature(raw, sig, env.OP_NODE_WEBHOOK_SECRET);
      if (!ok) return reply.code(401).send({ error: 'invalid signature' });
    }

    const payment = await app.prisma.payment.findFirst({
      where: { providerRef: id, provider: 'opennode', tenantId: tenant.id },
      include: { user: true }
    });

    if (!payment) {
      // Unknown or already cleaned up payment; reply 202 to avoid retries but log it.
      app.log.warn({ id, tenant: tenant.domain }, 'webhook for unknown payment');
      return reply.code(202).send({ ok: false, reason: 'unknown payment' });
    }

    const normalizedStatus = status.toUpperCase();
    await app.prisma.payment.update({ where: { id: payment.id }, data: { status: normalizedStatus } });

    // Avoid holding balances: we only track payment status; no wallet custody.

    app.log.info({ id, status: normalizedStatus }, 'lnurl webhook applied');

    // Publish zap receipt (NIP-57) when paid, if nostr client configured
    const successStates = ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED'];
    if (successStates.includes(normalizedStatus) && app.nostrClient && payment.user?.pubkey) {
      const amountMsat = payment.amountSats * 1000;
      const identifier = `${username}@${tenant.domain}`;
      const tags = [
        ['p', payment.user.pubkey],
        ['bolt11', payment.invoice],
        ['description', JSON.stringify({ identifier, amount: amountMsat })],
        ['amount', String(amountMsat)]
      ];
      try {
        await app.nostrClient.publish({
          template: {
            kind: 9735,
            content: `Zap ${amountMsat} msat to ${identifier}`,
            tags
          },
          relays: app.nostrRelays ?? ['wss://relay.damus.io']
        });
      } catch (err) {
        app.log.warn({ err }, 'failed to publish zap receipt');
      }
    }

    if (successStates.includes(normalizedStatus)) {
      app.payEventHub?.broadcast({
        type: 'invoice-paid',
        pr: payment.invoice,
        providerRef: id,
        amount: payment.amountSats
      });
    }

    return reply.send({ ok: true });
  });

  // Poll endpoint to verify payment status (for clients/paywalls that want confirmation)
  app.get('/api/lnurlp/:username/status/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['username', 'id'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenant = await getTenantForRequest(app, request);
    const payment = await app.prisma.payment.findFirst({ where: { providerRef: id, tenantId: tenant.id } });
    if (!payment) return reply.code(404).send({ status: 'unknown' });

    // If already paid in DB, short-circuit
    const paidStates = ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED'];
    if (paidStates.includes(payment.status)) {
      return reply.send({ status: payment.status, amountSats: payment.amountSats });
    }

    try {
      const statusRes = await app.lightningProvider.getCharge?.(payment.providerRef);
      if (statusRes?.status?.toLowerCase() === 'paid') {
        await app.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
        return reply.send({ status: 'PAID', amountSats: payment.amountSats });
      }
      return reply.send({ status: statusRes?.status?.toUpperCase?.() ?? payment.status });
    } catch (err) {
      app.log.warn({ err }, 'charge status check failed');
      return reply.code(502).send({ status: payment.status, error: 'status_check_failed' });
    }
  });

  // Optional LNbits webhook endpoint (paid notification). LNbits does not HMAC by default; can be fronted by proxy.
  app.post('/api/lnbits/webhook', async (request, reply) => {
    const body = request.body as { payment_hash?: string };
    const hash = body?.payment_hash;
    if (!hash) return reply.code(400).send({ error: 'missing payment_hash' });
    const payment = await app.prisma.payment.findFirst({ where: { providerRef: hash, provider: 'lnbits' } });
    if (!payment) return reply.code(202).send({ ok: false, reason: 'unknown payment' });
    await app.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
    return reply.send({ ok: true });
  });
}
