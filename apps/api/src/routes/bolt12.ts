import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { Bolt12ProviderKind, buildBolt12Provider } from '../providers/index.js';
import {
  ClnRestBolt12Provider,
  createBolt12Offer,
  fetchBolt12Invoice,
  MockBolt12Provider
} from '../services/bolt12.js';

type Bolt12ErrorResult = { status: number; error: string };

function formatBolt12Error(err: unknown): Bolt12ErrorResult {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes('not configured')) return { status: 503, error: 'bolt12_provider_unconfigured' };
    if (message.includes('response missing')) return { status: 502, error: 'bolt12_provider_response_invalid' };
    if (message.includes('provider request failed')) return { status: 502, error: 'bolt12_provider_failed' };
  }
  return { status: 500, error: 'bolt12_failed' };
}

export async function registerBolt12Routes(app: FastifyInstance) {
  if (!env.ENABLE_BOLT12) return;

  const providerKind =
    env.BOLT12_PROVIDER === 'cln-rest' ? Bolt12ProviderKind.ClnRest : Bolt12ProviderKind.Mock;

  const provider = buildBolt12Provider(providerKind, {
    clnRest: () => {
      if (!env.BOLT12_REST_URL || !env.BOLT12_REST_API_KEY) {
        throw new Error('BOLT12 provider config missing');
      }
      return new ClnRestBolt12Provider(
        { baseUrl: env.BOLT12_REST_URL, apiKey: env.BOLT12_REST_API_KEY },
        app.log
      );
    },
    mock: () => new MockBolt12Provider()
  });

  app.post('/api/bolt12/offers', {
    schema: {
      body: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amountMsat: { type: 'integer', minimum: 1 },
          label: { type: 'string' },
          issuer: { type: 'string' },
          expiresIn: { type: 'integer', minimum: 1 }
        },
        required: ['description'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    if (!env.ENABLE_BOLT12) {
      return reply.code(404).send({ status: 'disabled' });
    }
    const body = request.body as {
      description: string;
      amountMsat?: number;
      label?: string;
      issuer?: string;
      expiresIn?: number;
    };
    try {
      const offer = await createBolt12Offer(provider, {
        description: body.description,
        amountMsat: body.amountMsat,
        label: body.label,
        issuer: body.issuer,
        expiresIn: body.expiresIn
      });
      return reply.code(201).send(offer);
    } catch (err) {
      const { status, error } = formatBolt12Error(err);
      request.log.warn({ err }, 'bolt12 offer creation failed');
      return reply.code(status).send({ error });
    }
  });

  app.post('/api/bolt12/invoices', {
    schema: {
      body: {
        type: 'object',
        properties: {
          offer: { type: 'string' },
          amountMsat: { type: 'integer', minimum: 1 },
          quantity: { type: 'integer', minimum: 1 },
          payerNote: { type: 'string' }
        },
        required: ['offer'],
        additionalProperties: false
      }
    }
  }, async (request, reply) => {
    if (!env.ENABLE_BOLT12) {
      return reply.code(404).send({ status: 'disabled' });
    }
    const body = request.body as {
      offer: string;
      amountMsat?: number;
      quantity?: number;
      payerNote?: string;
    };
    try {
      const invoice = await fetchBolt12Invoice(provider, {
        offer: body.offer,
        amountMsat: body.amountMsat,
        quantity: body.quantity,
        payerNote: body.payerNote
      });
      return reply.send(invoice);
    } catch (err) {
      const { status, error } = formatBolt12Error(err);
      request.log.warn({ err }, 'bolt12 invoice fetch failed');
      return reply.code(status).send({ error });
    }
  });
}
