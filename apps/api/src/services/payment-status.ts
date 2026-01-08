import type { Payment } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

/** Canonical set of statuses indicating a paid invoice */
export const PAID_STATES = new Set(['PAID', 'COMPLETED', 'SETTLED', 'CONFIRMED']);

/** Safely parse metadata JSON, returns undefined on failure */
export function parsePaymentMetadata(metadata: string | null): unknown | undefined {
  if (!metadata) return undefined;
  try {
    return JSON.parse(metadata) as unknown;
  } catch {
    return undefined;
  }
}

export interface PaymentStatusResult {
  status: string;
  updated: boolean;
  error?: string;
}

/**
 * Check payment status with provider, update DB, and broadcast events.
 * Shared logic used by both poll endpoint and reconciler.
 */
export async function checkAndUpdatePaymentStatus(
  app: FastifyInstance,
  payment: Payment,
  source: 'poll' | 'reconciler'
): Promise<PaymentStatusResult> {
  // Already paid - no need to check provider
  if (PAID_STATES.has(payment.status)) {
    return { status: payment.status, updated: false };
  }

  // Provider doesn't support status checking
  if (!app.lightningProvider.getCharge) {
    return { status: payment.status, updated: false };
  }

  try {
    const statusRes = await app.lightningProvider.getCharge(payment.providerRef);
    const normalized = statusRes?.status?.toString().toUpperCase() ?? payment.status;

    if (normalized === payment.status) {
      return { status: normalized, updated: false };
    }

    // Status changed - update DB
    await app.prisma.payment.update({
      where: { id: payment.id },
      data: { status: normalized }
    });

    // Broadcast status change
    const metadata = parsePaymentMetadata(payment.metadata);
    const ts = Date.now();

    app.payEventHub?.broadcast({
      type: 'invoice-status',
      ts,
      providerRef: payment.providerRef,
      status: normalized,
      prevStatus: payment.status,
      pr: payment.invoice,
      amount: payment.amountSats,
      action: payment.action ?? undefined,
      itemId: payment.itemId ?? undefined,
      metadata,
      source,
      tenantId: payment.tenantId,
      paymentId: payment.id
    });

    // If now paid, broadcast paid event
    if (PAID_STATES.has(normalized)) {
      app.payEventHub?.broadcast({
        type: 'invoice-paid',
        ts,
        pr: payment.invoice,
        providerRef: payment.providerRef,
        amount: payment.amountSats,
        action: payment.action ?? undefined,
        itemId: payment.itemId ?? undefined,
        metadata,
        source,
        tenantId: payment.tenantId,
        paymentId: payment.id
      });
    }

    return { status: normalized, updated: true };
  } catch (err) {
    app.log.warn({ err, providerRef: payment.providerRef }, `payment status check failed (${source})`);
    return { status: payment.status, updated: false, error: 'status_check_failed' };
  }
}
