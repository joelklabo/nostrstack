import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSecretKey } from 'node:crypto';
import { jwtVerify } from 'jose';
import { env } from '../env.js';

export async function requireAdminKey(request: FastifyRequest, reply: FastifyReply) {
  // Prefer JWT if configured
  if (env.ADMIN_JWT_SECRET) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const token = auth.slice('Bearer '.length);
    try {
      await jwtVerify(token, createSecretKey(env.ADMIN_JWT_SECRET, 'utf-8'));
      return;
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  }

  if (env.ADMIN_API_KEY) {
    const header = request.headers['x-api-key'];
    if (header !== env.ADMIN_API_KEY) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  }
}
