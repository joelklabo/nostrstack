/**
 * Server fixture utilities for API tests.
 * Provides lifecycle management for Fastify server instances.
 */

import type { FastifyInstance } from 'fastify';

export type BuildServerFn = () => Promise<FastifyInstance>;

export interface ServerFixture {
  server: FastifyInstance;
  close: () => Promise<void>;
}

/**
 * Create a server fixture for testing.
 * Handles server lifecycle in beforeAll/afterAll hooks.
 *
 * @example
 * ```ts
 * import { createServerFixture } from '@nostrstack/test-utils/api';
 * import { buildServer } from '../server.js';
 *
 * let fixture: ServerFixture;
 *
 * beforeAll(async () => {
 *   fixture = await createServerFixture(buildServer);
 * });
 *
 * afterAll(async () => {
 *   await fixture.close();
 * });
 *
 * it('should respond', async () => {
 *   const res = await fixture.server.inject({ method: 'GET', url: '/health' });
 *   expect(res.statusCode).toBe(200);
 * });
 * ```
 */
export async function createServerFixture(buildServer: BuildServerFn): Promise<ServerFixture> {
  const server = await buildServer();
  return {
    server,
    close: () => server.close()
  };
}

/**
 * Higher-order function to create a reusable test setup.
 * Returns setup/teardown functions for use in test files.
 *
 * @example
 * ```ts
 * // In test-setup.ts
 * import { createTestContext } from '@nostrstack/test-utils/api';
 * import { buildServer } from '../server.js';
 *
 * export const { setup, teardown, getServer } = createTestContext(buildServer);
 *
 * // In test file
 * import { setup, teardown, getServer } from './test-setup.js';
 *
 * beforeAll(setup);
 * afterAll(teardown);
 *
 * it('works', async () => {
 *   const res = await getServer().inject({ ... });
 * });
 * ```
 */
export function createTestContext(buildServer: BuildServerFn) {
  let server: FastifyInstance | null = null;

  return {
    async setup() {
      server = await buildServer();
    },
    async teardown() {
      if (server) {
        await server.close();
        server = null;
      }
    },
    getServer(): FastifyInstance {
      if (!server) {
        throw new Error('Server not initialized. Did you call setup() in beforeAll()?');
      }
      return server;
    }
  };
}
