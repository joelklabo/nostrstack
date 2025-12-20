import { expect, type Page } from '@playwright/test';
import type { Event } from 'nostr-tools';

export async function setRelays(page: Page, relaysCsv: string) {
  const relayInput = page.locator('input[placeholder="mock or wss://relay1,wss://relay2"]').first();
  await relayInput.waitFor({ timeout: 5000 });
  await relayInput.fill(relaysCsv);
}

export async function enableTestSigner(page: Page) {
  const toggle = page.getByLabel(/Built-in Nostr test signer/i);
  if ((await toggle.count()) === 0) return;
  if (!(await toggle.isChecked())) {
    await toggle.check();
  }
}

export async function expectRelayMode(page: Page, mode: 'real' | 'mock') {
  const selector = mode === 'real' ? '#relay-status .dot.real' : '#relay-status .dot.mock';
  // If mock indicator missing, force relays input to mock and retry.
  try {
    await expect(page.locator(selector)).toBeVisible({ timeout: 12000 });
  } catch (err) {
    if (mode === 'mock') {
      const relayInput = page.locator('input[placeholder="mock or wss://relay1,wss://relay2"]').first();
      await relayInput.fill('mock');
      await page.waitForTimeout(300); // allow remount
      await expect(page.locator(selector)).toBeVisible({ timeout: 12000 });
    } else {
      throw err;
    }
  }
}

export async function postComment(page: Page, text: string) {
  const textarea = page.locator('#comments-container textarea').first();
  await textarea.waitFor({ timeout: 10000 });
  await textarea.fill(text);
  await page.locator('#comments-container button', { hasText: 'Post' }).first().click();
}

export async function toggleTheme(page: Page, theme: 'light' | 'dark') {
  const select = page.locator('select').first();
  await select.selectOption(theme);
}

export type ApiNostrTarget = {
  input: string;
  type: 'event' | 'profile' | 'address';
  relays?: string[];
  id?: string;
  pubkey?: string;
  kind?: number;
  identifier?: string;
};

export type ApiNostrReferences = {
  root: string[];
  reply: string[];
  mention: string[];
  quote: string[];
  address: string[];
  profiles: string[];
};

export type ApiNostrEventResponse = {
  target: ApiNostrTarget;
  event: Event;
  author: {
    pubkey: string;
    profile: { name?: string } | null;
  };
  references: ApiNostrReferences;
};

const DEFAULT_REFERENCES: ApiNostrReferences = {
  root: [],
  reply: [],
  mention: [],
  quote: [],
  address: [],
  profiles: []
};

export function buildNostrEventResponse(input: {
  id: string;
  pubkey?: string;
  kind?: number;
  content?: string;
  tags?: string[][];
  relays?: string[];
  targetType?: ApiNostrTarget['type'];
  targetOverrides?: Partial<ApiNostrTarget>;
  references?: Partial<ApiNostrReferences>;
  authorProfile?: { name?: string } | null;
}): ApiNostrEventResponse {
  const pubkey = input.pubkey ?? 'b'.repeat(64);
  const kind = input.kind ?? 1;
  const relays = input.relays ?? ['wss://relay.example'];
  const targetType = input.targetType ?? 'event';
  const references = { ...DEFAULT_REFERENCES, ...(input.references ?? {}) };
  const target: ApiNostrTarget = {
    input: input.id,
    type: targetType,
    relays,
    ...input.targetOverrides
  };
  if (targetType === 'event') target.id = input.id;
  if (targetType === 'profile') target.pubkey = pubkey;
  if (targetType === 'address') {
    target.kind = target.kind ?? 30023;
    target.pubkey = target.pubkey ?? pubkey;
    target.identifier = target.identifier ?? 'ref';
  }

  return {
    target,
    event: {
      id: input.id,
      pubkey,
      created_at: 1710000000,
      kind,
      tags: input.tags ?? [],
      content: input.content ?? 'hello from nostr',
      sig: 'c'.repeat(128)
    },
    author: {
      pubkey,
      profile: input.authorProfile ?? { name: 'Alice' }
    },
    references
  };
}

function parseNostrEventId(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1] ?? '';
    return decodeURIComponent(id);
  } catch {
    return '';
  }
}

export async function mockNostrEventApi(
  page: Page,
  fixtures: Record<string, ApiNostrEventResponse>,
  fallbackStatus = 404
) {
  await page.route('**/api/nostr/event/*', async (route) => {
    const id = parseNostrEventId(route.request().url());
    const fixture = fixtures[id];
    if (fixture) {
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*'
        },
        body: JSON.stringify(fixture)
      });
      return;
    }
    await route.fulfill({
      status: fallbackStatus,
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*'
      },
      body: JSON.stringify({ error: 'not_found', message: 'Event not found on available relays.' })
    });
  });
}
