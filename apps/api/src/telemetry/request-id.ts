import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

export async function requestIdHook(request: FastifyRequest, _reply: FastifyReply) {
  const existing = request.headers['x-request-id'] as string | undefined;
  const reqId = existing || randomUUID();
  request.id = reqId;
  request.log = request.log.child({ reqId });
}
