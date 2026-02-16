import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Page } from '@playwright/test';
import type { Event } from 'nostr-tools';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function resolveDocScreenshotPath(relativePath: string) {
  return path.join(REPO_ROOT, 'docs', 'screenshots', relativePath);
}

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
      const relayInput = page
        .locator('input[placeholder="mock or wss://relay1,wss://relay2"]')
        .first();
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
  const label = theme === 'dark' ? /DARK_MODE/i : /LIGHT_MODE/i;
  const button = page.getByRole('button', { name: label });
  if ((await button.count()) > 0) {
    await button.first().click();
    return;
  }

  const select = page.locator('select', { has: page.locator('option[value="dark"]') }).first();
  if ((await select.count()) > 0) {
    await select.selectOption(theme);
    return;
  }

  throw new Error(`Theme control not found for ${theme}`);
}

export type TelemetryWsDetail = {
  status?: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  offlineReason?: string | null;
  attempt?: number;
};

// Dev-only hook for telemetry WS state changes (used in Playwright tests).
export async function dispatchTelemetryWsState(page: Page, detail: TelemetryWsDetail) {
  await page.evaluate((payload) => {
    window.dispatchEvent(new CustomEvent('nostrstack:telemetry-ws-state', { detail: payload }));
  }, detail);
}

// Simulate browser offline/online for telemetry reconnect tests.
export async function setBrowserOffline(page: Page) {
  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

export async function setBrowserOnline(page: Page) {
  await page.context().setOffline(false);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });
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

export async function seedMockEvent(page: Page, event: Partial<Event>) {
  await page.evaluate((evt) => {
    const fullEvent: Event = {
      id: Math.random().toString(36).substring(7),
      pubkey: '0'.repeat(64),
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'default content',
      sig: '0'.repeat(128),
      ...evt
    };
    window.dispatchEvent(new CustomEvent('nostrstack:mock-event', { detail: fullEvent }));
    // Also add to global mock events if they exist
    const target = window as Window & { __NOSTRSTACK_MOCK_EVENTS__?: Event[] };
    if (target.__NOSTRSTACK_MOCK_EVENTS__) {
      target.__NOSTRSTACK_MOCK_EVENTS__.push(fullEvent);
    }
  }, event);
}

export const TEST_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

export async function loginWithNsec(page: Page, nsec: string = TEST_NSEC) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // If we are already logged in (reused state), we might see Live Feed
  const liveFeed = page.getByText('Live Feed');
  const alreadyIn = await liveFeed.isVisible().catch(() => false);
  if (alreadyIn) return;

  // Wait for login screen elements to be available
  const loginView = page.locator('.login-title').first();
  const appHeader = page.locator('.sidebar-title').first();
  const alreadyLoggedIn = appHeader.isVisible({ timeout: 15000 }).catch(() => false);
  const onLoginScreen = loginView.isVisible({ timeout: 15000 }).catch(() => false);
  const ready = await Promise.race([alreadyLoggedIn, onLoginScreen]);
  if (!(await ready)) {
    throw new Error('Unable to detect login screen or logged-in shell after navigation');
  }

  // Sometimes the button is not immediately clickable if content is shifting
  const manual = page.getByText('Enter nsec manually');
  // Use .first() in case of duplicates (e.g. mobile vs desktop layouts)
  await manual.first().waitFor({ state: 'visible', timeout: 10000 });
  await manual.first().click();

  const input = page.getByPlaceholder('nsec1...');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(nsec);

  const signInBtn = page.getByRole('button', { name: 'Sign in' });
  await signInBtn.click();

  await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 20000 });
}
