import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { regtestFund } from '../services/regtest-fund.js';

export async function registerRegtestFundRoute(app: FastifyInstance) {
  if (!app.config?.REGTEST_FUND_ENABLED) {
    app.log.warn('regtest fund disabled; /api/regtest/fund will return 404');
  }
  
  const schema = {
    response: {
      200: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          minedBlocks: { type: 'integer' },
          lnbitsTopup: { type: 'integer' },
          currentBlockHeight: { type: 'integer' }
        }
      },
      404: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, error: { type: 'string' } }
      },
      500: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, error: { type: 'string' } }
      }
    }
  };

  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!app.config?.REGTEST_FUND_ENABLED) {
      return reply.code(404).send({ ok: false, error: 'regtest_fund_disabled' });
    }
    request.log.info({ action: 'regtest_fund' }, 'regtest fund requested');
    try {
      const res = await regtestFund();
      request.log.info({ minedBlocks: res.minedBlocks, lnbitsTopup: res.lnbitsTopup }, 'regtest fund complete');
      reply.send({ ok: true, ...res });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      request.log.error({ err: msg }, 'regtest fund failed');
      reply.code(500).send({ ok: false, error: msg });
    }
  };

  app.post('/regtest/fund', { schema }, handler);
  app.post('/api/regtest/fund', { schema }, handler);
}
