/**
 * @nostrstack/test-utils
 *
 * Shared test utilities for the NostrStack monorepo.
 *
 * ## Usage
 *
 * ### Nostr Event Factories
 * Use `@nostrstack/nostr/testing` for creating Nostr events:
 * ```ts
 * import { createTestUser, createTextNote } from '@nostrstack/nostr/testing';
 * ```
 *
 * ### API Test Utilities
 * Use `@nostrstack/test-utils/api` for API testing:
 * ```ts
 * import { setupTestDb, createServerFixture } from '@nostrstack/test-utils/api';
 * ```
 */

// Re-export API utilities from main entry point for convenience
export {
  applyTestEnv,
  BASE_IDS,
  type BuildServerFn,
  createBaseEvent,
  createMockPayment,
  createMockTenant,
  createResolvedEventResponse,
  createServerFixture,
  createTestContext,
  EMPTY_REFERENCES,
  type MockPayment,
  type MockTenant,
  type ServerFixture,
  setupTestDb,
  TEST_ENV,
  uniqueTestDbName
} from './api/index.js';
