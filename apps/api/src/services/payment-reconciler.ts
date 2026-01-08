import type { FastifyInstance } from 'fastify';

import { checkAndUpdatePaymentStatus,PAID_STATES } from './payment-status.js';

export function startPaymentReconciler(app: FastifyInstance) {
  if (!app.lightningProvider.getCharge) {
    app.log.warn('payment reconciler disabled: lightningProvider.getCharge not implemented');
    return () => {};
  }

  const interval = setInterval(async () => {
    try {
      // reconcile only recent pending payments to avoid hammering providers
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const paidStatuses = Array.from(PAID_STATES);
      const pending = await app.prisma.payment.findMany({
        where: { status: { notIn: paidStatuses }, updatedAt: { gte: since } },
        take: 20,
        orderBy: { updatedAt: 'desc' }
      });

      for (const payment of pending) {
        await checkAndUpdatePaymentStatus(app, payment, 'reconciler');
      }
    } catch (err) {
      app.log.warn({ err }, 'payment reconciler loop failed');
    }
  }, 5000);

  return () => clearInterval(interval);
}
