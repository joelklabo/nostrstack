import crypto from 'node:crypto';

export function verifyOpenNodeSignature(body: string, signatureHeader: string | undefined, webhookSecret: string | undefined): boolean {
  if (!webhookSecret) return false;
  if (!signatureHeader) return false;
  const computed = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
}
