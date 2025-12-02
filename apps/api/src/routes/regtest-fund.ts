import type { FastifyInstance } from 'fastify';

import { regtestFund } from '../services/regtest-fund.js';

export async function registerRegtestFundRoute(app: FastifyInstance) {
  app.post('/regtest/fund', async (_req, reply) => {
    try {
      const res = await regtestFund();
      reply.send({ ok: true, ...res });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.code(500).send({ ok: false, error: msg });
    }
  });
}
