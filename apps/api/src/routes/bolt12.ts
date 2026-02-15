import type { FastifyInstance } from 'fastify';

import { env } from '../env.js';
import { Bolt12ProviderKind, buildBolt12Provider } from '../providers/index.js';
import type { Bolt12Limits } from '../services/bolt12.js';
import {
  Bolt12GuardrailError,
  Bolt12ValidationError,
  ClnRestBolt12Provider,
  createBolt12Offer,
  fetchBolt12Invoice,
  MockBolt12Provider,
  validateBolt12InvoiceInput,
  validateBolt12OfferInput
} from '../services/bolt12.js';

type Bolt12ErrorResult = { status: number; error: string; message?: string };

function formatBolt12Error(err: unknown): Bolt12ErrorResult {
  if (err instanceof Bolt12ValidationError) {
    return { status: 400, error: err.code, message: err.message };
  }
  if (err instanceof Bolt12GuardrailError) {
    return { status: 503, error: err.code, message: err.message };
  }
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes('not configured')) {
      return {
        status: 503,
        error: 'bolt12_provider_unconfigured',
        message: 'BOLT12 provider is not configured.'
      };
    }
    if (message.includes('response missing')) {
      return {
        status: 502,
        error: 'bolt12_provider_response_invalid',
        message: 'BOLT12 provider response was missing expected data.'
      };
    }
    if (message.includes('provider request failed')) {
      return {
        status: 502,
        error: 'bolt12_provider_failed',
        message: 'BOLT12 provider request failed.'
      };
    }
  }
  return { status: 500, error: 'bolt12_failed', message: 'BOLT12 request failed.' };
}

export async function registerBolt12Routes(app: FastifyInstance) {
  if (!env.ENABLE_BOLT12) return;

  const limits: Bolt12Limits = {
    minAmountMsat: env.BOLT12_MIN_AMOUNT_MSAT,
    maxAmountMsat: env.BOLT12_MAX_AMOUNT_MSAT,
    minExpirySeconds: env.BOLT12_MIN_EXPIRY_SECONDS,
    maxExpirySeconds: env.BOLT12_MAX_EXPIRY_SECONDS,
    maxDescriptionChars: env.BOLT12_MAX_DESCRIPTION_CHARS,
    maxLabelChars: env.BOLT12_MAX_LABEL_CHARS,
    maxIssuerChars: env.BOLT12_MAX_ISSUER_CHARS,
    maxPayerNoteChars: env.BOLT12_MAX_PAYER_NOTE_CHARS,
    maxQuantity: env.BOLT12_MAX_QUANTITY
  };

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

  const assertBolt12Guardrails = () => {
    if (env.NODE_ENV === 'production' && env.BOLT12_PROVIDER === 'mock') {
      throw new Bolt12GuardrailError(
        'bolt12_provider_disallowed',
        'Mock provider is not allowed in production.'
      );
    }
    if (env.NODE_ENV === 'production' && env.BOLT12_REST_URL?.startsWith('http://')) {
      throw new Bolt12GuardrailError(
        'bolt12_provider_insecure',
        'BOLT12 provider must use https in production.'
      );
    }
  };

  app.post(
    '/api/bolt12/offers',
    {
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
    },
    async (request, reply) => {
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
        assertBolt12Guardrails();
        const input = validateBolt12OfferInput(
          {
            description: body.description,
            amountMsat: body.amountMsat,
            label: body.label,
            issuer: body.issuer,
            expiresIn: body.expiresIn
          },
          limits
        );
        const offer = await createBolt12Offer(provider, input);
        return reply.code(201).send(offer);
      } catch (err) {
        const formatted = formatBolt12Error(err);
        request.log.warn({ err }, 'bolt12 offer creation failed');
        return reply.code(400).send({ error: formatted.error, message: formatted.message });
      }
    }
  );

  app.post(
    '/api/bolt12/invoices',
    {
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
    },
    async (request, reply) => {
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
        assertBolt12Guardrails();
        const input = validateBolt12InvoiceInput(
          {
            offer: body.offer,
            amountMsat: body.amountMsat,
            quantity: body.quantity,
            payerNote: body.payerNote
          },
          limits
        );
        const invoice = await fetchBolt12Invoice(provider, input);
        return reply.send(invoice);
      } catch (err) {
        const formatted = formatBolt12Error(err);
        request.log.warn({ err }, 'bolt12 invoice fetch failed');
        return reply.code(400).send({ error: formatted.error, message: formatted.message });
      }
    }
  );
}
