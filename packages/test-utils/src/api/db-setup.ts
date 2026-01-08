/**
 * Database setup utilities for API tests.
 * Reduces boilerplate for Prisma test database initialization.
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export interface DbSetupOptions {
  /** Path to schema.prisma relative to cwd (default: 'prisma/schema.prisma') */
  schemaPath?: string;
  /** Database URL (default: reads from DATABASE_URL env var) */
  databaseUrl?: string;
  /** Show Prisma output (default: false) */
  verbose?: boolean;
}

/**
 * Initialize test database by pushing schema.
 * Call this in beforeAll() to ensure DB is ready before tests run.
 *
 * @example
 * ```ts
 * import { setupTestDb } from '@nostrstack/test-utils/api';
 *
 * process.env.DATABASE_URL = 'file:./test.db';
 *
 * beforeAll(async () => {
 *   setupTestDb();
 * });
 * ```
 */
export function setupTestDb(options: DbSetupOptions = {}): void {
  const schemaPath = options.schemaPath ?? 'prisma/schema.prisma';
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for test database setup');
  }

  const schema = resolve(process.cwd(), schemaPath);

  execSync(
    `./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema ${schema}`,
    {
      stdio: options.verbose ? 'inherit' : 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl }
    }
  );
}

/**
 * Generate a unique test database filename to avoid conflicts between test files.
 * Useful when running tests in parallel.
 *
 * @example
 * ```ts
 * process.env.DATABASE_URL = `file:./${uniqueTestDbName('nostr-event')}.db`;
 * ```
 */
export function uniqueTestDbName(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `tmp-${prefix}-${timestamp}-${random}`;
}

/**
 * Standard test environment variables for API tests
 */
export const TEST_ENV = {
  NODE_ENV: 'test',
  VITEST: 'true',
  LOG_LEVEL: 'error'
} as const;

/**
 * Apply standard test environment variables
 */
export function applyTestEnv(): void {
  Object.assign(process.env, TEST_ENV);
}
