import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { regtestFund } from '../services/regtest-fund.js';

export async function registerRegtestFundRoute(app: FastifyInstance) {
  if (!app.config?.REGTEST_FUND_ENABLED) {
    app.log.warn('regtest fund disabled; /api/regtest/fund will return 404');
  }
  const handler = async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!app.config?.REGTEST_FUND_ENABLED) {
      return reply.code(404).send({ ok: false, error: 'regtest_fund_disabled' });
    }
    try {
      const res = await regtestFund();
      reply.send({ ok: true, ...res });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.code(500).send({ ok: false, error: msg });
    }
  };

  app.post('/regtest/fund', handler);
  app.post('/api/regtest/fund', handler);
}
