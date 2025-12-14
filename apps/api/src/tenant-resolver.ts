import type { FastifyInstance, FastifyRequest } from 'fastify';

export async function getTenantForRequest(app: FastifyInstance, request: FastifyRequest, domainOverride?: string) {
  const hostHeader = (request.headers['x-forwarded-host'] ?? request.headers.host ?? 'default').toString();
  const hostDomain = hostHeader.split(',')[0].trim().toLowerCase() || 'default';
  const rawDomain = (domainOverride ?? hostDomain).trim().toLowerCase() || 'default';
  const domain = rawDomain.split(':')[0] || 'default';
  const found = await app.prisma.tenant.findUnique({ where: { domain } });
  if (found) return found;
  // Fallback to default tenant to avoid hard failures on new domains; real domains should be provisioned explicitly.
  const fallback = await app.prisma.tenant.findUnique({ where: { domain: 'default' } });
  return fallback ?? (await app.prisma.tenant.create({ data: { domain: 'default', displayName: 'Default Tenant' } }));
}

export function originFromRequest(request: FastifyRequest, publicOrigin: string) {
  if (request.headers.host) {
    const proto = request.headers['x-forwarded-proto']?.toString().split(',')[0] || request.protocol;
    return `${proto}://${request.headers.host}`;
  }
  return publicOrigin;
}
