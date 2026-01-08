/**
 * Test data factories for creating Nostr events.
 * Use these to generate consistent test fixtures across e2e tests.
 */

import type { Event } from 'nostr-tools';
import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

/**
 * Create a test keypair with associated identifiers
 */
export function createTestKeypair() {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const npub = nip19.npubEncode(pubkey);
  const nsec = nip19.nsecEncode(secretKey);
  return { secretKey, pubkey, npub, nsec };
}

/**
 * Profile content for kind:0 events
 */
export interface ProfileContent {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  lud16?: string;
  nip05?: string;
  website?: string;
}

/**
 * Create a kind:0 profile event
 */
export function createProfileEvent(
  secretKey: Uint8Array,
  profile: ProfileContent,
  options: { createdAt?: number } = {}
): Event {
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  return finalizeEvent(
    {
      kind: 0,
      created_at: createdAt,
      tags: [],
      content: JSON.stringify(profile)
    },
    secretKey
  );
}

/**
 * Create a kind:1 text note event
 */
export function createTextNote(
  secretKey: Uint8Array,
  content: string,
  options: {
    createdAt?: number;
    tags?: string[][];
    replyTo?: string;
    rootEvent?: string;
    mentions?: string[];
  } = {}
): Event {
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  const tags: string[][] = options.tags ?? [];

  // Add reply tags
  if (options.rootEvent) {
    tags.push(['e', options.rootEvent, '', 'root']);
  }
  if (options.replyTo) {
    tags.push(['e', options.replyTo, '', 'reply']);
  }
  if (options.mentions) {
    for (const pubkey of options.mentions) {
      tags.push(['p', pubkey]);
    }
  }

  return finalizeEvent(
    {
      kind: 1,
      created_at: createdAt,
      tags,
      content
    },
    secretKey
  );
}

/**
 * Create a kind:7 reaction event
 */
export function createReaction(
  secretKey: Uint8Array,
  targetEvent: { id: string; pubkey: string },
  reaction: string = '+',
  options: { createdAt?: number } = {}
): Event {
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  return finalizeEvent(
    {
      kind: 7,
      created_at: createdAt,
      tags: [
        ['e', targetEvent.id],
        ['p', targetEvent.pubkey]
      ],
      content: reaction
    },
    secretKey
  );
}

/**
 * Create a kind:9735 zap receipt event (simulates what a lightning node would create)
 * Note: This is a mock zap receipt for testing purposes
 */
export function createZapReceipt(
  secretKey: Uint8Array,
  targetEvent: { id: string; pubkey: string },
  amountMsats: number,
  options: {
    createdAt?: number;
    senderPubkey?: string;
    bolt11?: string;
  } = {}
): Event {
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  const senderPubkey = options.senderPubkey ?? '0'.repeat(64);
  const bolt11 = options.bolt11 ?? 'lnbc1...';

  return finalizeEvent(
    {
      kind: 9735,
      created_at: createdAt,
      tags: [
        ['p', targetEvent.pubkey],
        ['e', targetEvent.id],
        ['P', senderPubkey],
        ['bolt11', bolt11],
        ['amount', amountMsats.toString()]
      ],
      content: ''
    },
    secretKey
  );
}

/**
 * Create a kind:4 encrypted DM event
 * Note: For testing, we don't actually encrypt the content
 */
export function createDirectMessage(
  secretKey: Uint8Array,
  recipientPubkey: string,
  content: string,
  options: { createdAt?: number } = {}
): Event {
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  return finalizeEvent(
    {
      kind: 4,
      created_at: createdAt,
      tags: [['p', recipientPubkey]],
      content // In real usage this would be encrypted
    },
    secretKey
  );
}

/**
 * Create a kind:10002 relay list event
 */
export function createRelayList(
  secretKey: Uint8Array,
  relays: Array<{ url: string; read?: boolean; write?: boolean }>,
  options: { createdAt?: number } = {}
): Event {
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  const tags = relays.map((r) => {
    const tag = ['r', r.url];
    if (r.read && r.write) return tag;
    if (r.read) tag.push('read');
    if (r.write) tag.push('write');
    return tag;
  });

  return finalizeEvent(
    {
      kind: 10002,
      created_at: createdAt,
      tags,
      content: ''
    },
    secretKey
  );
}

/**
 * Create a contact list (kind:3) event
 */
export function createContactList(
  secretKey: Uint8Array,
  contacts: Array<{ pubkey: string; relay?: string; petname?: string }>,
  options: { createdAt?: number } = {}
): Event {
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  const tags = contacts.map((c) => {
    const tag = ['p', c.pubkey];
    if (c.relay) tag.push(c.relay);
    if (c.petname) tag.push(c.petname);
    return tag;
  });

  return finalizeEvent(
    {
      kind: 3,
      created_at: createdAt,
      tags,
      content: ''
    },
    secretKey
  );
}

/**
 * Create a full test user with profile and posts
 */
export function createTestUser(
  profile: ProfileContent = {},
  options: {
    postCount?: number;
    postContent?: (index: number) => string;
  } = {}
) {
  const { secretKey, pubkey, npub, nsec } = createTestKeypair();
  const now = Math.floor(Date.now() / 1000);

  const defaultProfile: ProfileContent = {
    name: 'Test User',
    about: 'A test user for e2e tests',
    lud16: 'test@example.com',
    ...profile
  };

  const profileEvent = createProfileEvent(secretKey, defaultProfile, { createdAt: now });

  const postCount = options.postCount ?? 2;
  const posts: Event[] = [];

  for (let i = 0; i < postCount; i++) {
    const content = options.postContent ? options.postContent(i) : `Test post ${i + 1}`;
    posts.push(createTextNote(secretKey, content, { createdAt: now - (postCount - i) * 10 }));
  }

  return {
    secretKey,
    pubkey,
    npub,
    nsec,
    profileEvent,
    posts,
    allEvents: [profileEvent, ...posts]
  };
}
