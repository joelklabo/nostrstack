import type { FastifyInstance } from 'fastify';

const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED', 'PAID']);

export function startPaymentReconciler(app: FastifyInstance) {
  if (!app.lightningProvider.getCharge) {
    app.log.warn('payment reconciler disabled: lightningProvider.getCharge not implemented');
    return () => {};
  }

  const interval = setInterval(async () => {
    try {
      // reconcile only recent pending payments to avoid hammering providers
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pending = await app.prisma.payment.findMany({
        where: { status: { notIn: ['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED'] }, updatedAt: { gte: since } },
        take: 20,
        orderBy: { updatedAt: 'desc' }
      });

      for (const p of pending) {
        try {
          const statusRes = await app.lightningProvider.getCharge!(p.providerRef);
          const normalized = statusRes?.status?.toString().toUpperCase() ?? p.status;
          if (PAID_STATES.has(normalized)) {
            await app.prisma.payment.update({ where: { id: p.id }, data: { status: normalized } });
            app.payEventHub?.broadcast({ type: 'invoice-paid', pr: p.invoice, providerRef: p.providerRef, amount: p.amountSats });
          }
        } catch (err) {
          app.log.warn({ err, providerRef: p.providerRef }, 'payment reconciler status check failed');
        }
      }
    } catch (err) {
      app.log.warn({ err }, 'payment reconciler loop failed');
    }
  }, 5000);

  return () => clearInterval(interval);
}
