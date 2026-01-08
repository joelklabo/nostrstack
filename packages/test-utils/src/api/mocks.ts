/**
 * Common mock data and factories for API tests.
 */

import type { Event } from 'nostr-tools';

/**
 * Base identifiers for consistent test data
 */
export const BASE_IDS = {
  eventId: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  replyId: 'd'.repeat(64),
  sig: 'f'.repeat(128)
} as const;

/**
 * Empty threading references structure
 */
export const EMPTY_REFERENCES = {
  root: [],
  reply: [],
  mention: [],
  quote: [],
  address: [],
  profiles: []
} as const;

/**
 * Create a base Nostr event for testing
 */
export function createBaseEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: BASE_IDS.eventId,
    pubkey: BASE_IDS.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'Test content',
    sig: BASE_IDS.sig,
    ...overrides
  };
}

/**
 * Create a mock resolved event response (matches event-resolver output)
 */
export function createResolvedEventResponse(
  eventId: string,
  relays: string[],
  options: {
    event?: Partial<Event>;
    author?: { pubkey: string; profile?: Record<string, unknown> };
    includeReplies?: boolean;
    replies?: Event[];
    replyPage?: { hasMore: boolean; nextCursor: string | null };
  } = {}
) {
  const event: Event = {
    id: eventId,
    pubkey: options.author?.pubkey ?? BASE_IDS.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags: [],
    content: 'Test event content',
    sig: BASE_IDS.sig,
    ...options.event
  };

  const response: Record<string, unknown> = {
    target: { type: 'event', id: eventId, relays: [] },
    event,
    author: {
      pubkey: event.pubkey,
      profile: options.author?.profile ?? { name: 'Test User' },
      profileEvent: null
    },
    relays,
    references: EMPTY_REFERENCES
  };

  if (options.includeReplies) {
    response.replyThreadId = eventId;
    response.replies = options.replies ?? [];
    response.replyPage = options.replyPage ?? { hasMore: false, nextCursor: null };
  }

  return response;
}

/**
 * Mock tenant for multi-tenant tests
 */
export interface MockTenant {
  id: string;
  name: string;
  domain: string;
  lightningAddress?: string;
}

/**
 * Create a mock tenant
 */
export function createMockTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: 'tenant-1',
    name: 'Test Tenant',
    domain: 'test.nostrstack.com',
    lightningAddress: 'test@test.nostrstack.com',
    ...overrides
  };
}

/**
 * Mock payment data
 */
export interface MockPayment {
  id: string;
  tenantId: string;
  amountSats: number;
  status: 'pending' | 'paid' | 'expired';
  invoice?: string;
  preimage?: string;
}

/**
 * Create a mock payment
 */
export function createMockPayment(overrides: Partial<MockPayment> = {}): MockPayment {
  return {
    id: `pay-${Date.now()}`,
    tenantId: 'tenant-1',
    amountSats: 1000,
    status: 'pending',
    invoice: 'lnbc1000n1...',
    ...overrides
  };
}
