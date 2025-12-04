import type { FastifyInstance } from 'fastify';

type WalletReq = {
  baseUrl?: string;
  apiKey?: string;
  walletId?: string;
};

export async function registerWalletRoutes(app: FastifyInstance) {
  const handler = async (request: any, reply: any) => {
    const { baseUrl, apiKey, walletId } = (request.body || {}) as WalletReq;
    const resolvedBase = (baseUrl || process.env.LN_BITS_URL || '').replace(/\/$/, '');
    const resolvedKey = apiKey || process.env.LN_BITS_API_KEY || '';

    if (!resolvedBase || !resolvedKey) {
      return reply.status(400).send({ ok: false, error: 'lnbits_config_missing' });
    }

    let target: URL;
    try {
      target = new URL(resolvedBase);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('invalid_protocol');
    } catch (err) {
      request.log.warn({ err }, 'invalid LNbits base');
      return reply.status(400).send({ ok: false, error: 'invalid_base_url' });
    }

    const walletUrl = `${target.toString().replace(/\/$/, '')}/api/v1/wallet${walletId ? `?usr=${encodeURIComponent(walletId)}` : ''}`;

    try {
      const res = await fetch(walletUrl, {
        headers: {
          Accept: 'application/json',
          'X-Api-Key': resolvedKey
        }
      });
      const text = await res.text();
      if (!res.ok) {
        return reply.status(res.status).send({ ok: false, error: `lnbits_http_${res.status}`, body: text.slice(0, 200) });
      }
      const json = JSON.parse(text) as { id?: string; name?: string; balance?: number };
      return { ok: true, wallet: { id: json.id, name: json.name, balance: json.balance } };
    } catch (err) {
      request.log.warn({ err }, 'lnbits wallet fetch failed');
      return reply.status(502).send({ ok: false, error: 'lnbits_unreachable' });
    }
  };

  app.post('/api/wallet/info', handler);
  app.post('/wallet/info', handler);
}
