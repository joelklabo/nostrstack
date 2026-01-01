import type { FastifyInstance } from 'fastify';

const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED']);

export async function registerPayWebhook(app: FastifyInstance) {
  app.post('/api/pay/webhook/lnbits', async (request, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
    const paymentHash = (body.payment_hash as string | undefined) || (body.id as string | undefined);
    if (!paymentHash) return reply.code(400).send({ ok: false, error: 'missing_payment_hash' });

    try {
      const payment = await app.prisma.payment.findFirst({ where: { providerRef: paymentHash } });
      if (!payment) return reply.code(200).send({ ok: true, ignored: true });

      if (PAID_STATES.has(payment.status)) return reply.send({ ok: true });

      await app.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
      let metadata: unknown | undefined;
      if (payment.metadata) {
        try {
          metadata = JSON.parse(payment.metadata) as unknown;
        } catch {
          metadata = undefined;
        }
      }
      const ts = Date.now();
      app.payEventHub?.broadcast({
        type: 'invoice-status',
        ts,
        providerRef: payment.providerRef,
        status: 'PAID',
        prevStatus: payment.status,
        pr: payment.invoice,
        amount: payment.amountSats,
        action: payment.action ?? undefined,
        itemId: payment.itemId ?? undefined,
        metadata,
        source: 'webhook',
        tenantId: payment.tenantId,
        paymentId: payment.id
      });
      app.payEventHub?.broadcast({
        type: 'invoice-paid',
        ts,
        pr: payment.invoice,
        providerRef: payment.providerRef,
        amount: payment.amountSats,
        action: payment.action ?? undefined,
        itemId: payment.itemId ?? undefined,
        metadata,
        source: 'webhook',
        tenantId: payment.tenantId,
        paymentId: payment.id
      });
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error({ err }, 'lnbits webhook handling failed');
      return reply.code(500).send({ ok: false });
    }
  });
}
