import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Locator, type Page } from '@playwright/test';
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
  const labels =
    theme === 'dark'
      ? [/DARK_MODE/i, /Switch to dark mode/i]
      : [/LIGHT_MODE/i, /Switch to light mode/i];

  for (const label of labels) {
    const button = page.getByRole('button', { name: label });
    if ((await button.count()) > 0) {
      await button.first().click();
      return;
    }
  }

  const select = page.locator('select', { has: page.locator('option[value="dark"]') }).first();
  if ((await select.count()) > 0) {
    await select.selectOption(theme);
    return;
  }

  throw new Error(`Theme control not found for ${theme}`);
}

export async function clickWithDispatchFallback(
  control: Locator,
  options: {
    timeout?: number;
    force?: boolean;
    expectVisibleTimeout?: number;
  } = {}
) {
  const { timeout = 10000, force = true, expectVisibleTimeout = 8000 } = options;

  await control.scrollIntoViewIfNeeded();
  await expect(control, 'Expected interactive control').toBeVisible({
    timeout: expectVisibleTimeout
  });
  try {
    await control.click({ timeout, force });
    return;
  } catch {
    // In Playwright runs where overlays/animation timing causes hit-target instability,
    // trigger a synthetic event as a fallback to keep coverage deterministic.
    await control.dispatchEvent('click');
  }
}

export async function waitForFeedSurface(page: Page, options: { timeoutMs?: number } = {}) {
  const { timeoutMs = 15000 } = options;

  const feedStream = page.locator('.feed-stream').first();
  const feedContent = page
    .locator(
      '.feed-title, .feed-empty, .feed-loading, [aria-label="Loading posts"], [aria-label="Feed posts"]'
    )
    .first();

  await expect(feedStream, 'Feed stream should be visible before continuing').toBeVisible({
    timeout: timeoutMs
  });
  await expect(feedContent, 'Feed content should render after login/navigation').toBeVisible({
    timeout: 8000
  });
}

export async function dismissOnboardingTourIfOpen(page: Page) {
  const controls = [
    page.getByRole('button', { name: 'Skip' }),
    page.getByRole('button', { name: 'Skip tour' }),
    page.getByRole('button', { name: 'Dismiss tour' }),
    page.locator('.onboarding-dismiss'),
    page.locator('[data-testid="onboarding-skip-btn"]')
  ];

  const overlay = page.locator('.onboarding-overlay, .onboarding-card, .onboarding-spotlight');

  for (const control of controls) {
    if (await control.isVisible({ timeout: 250 }).catch(() => false)) {
      await control
        .click({ timeout: 1000 })
        .catch(() => control.dispatchEvent('click').catch(() => undefined))
        .catch(() => undefined);
      await overlay
        .first()
        .waitFor({ state: 'hidden', timeout: 2000 })
        .catch(() => undefined);
      return;
    }
  }

  if (await overlay.count().catch(() => 0)) {
    await page.keyboard.press('Escape').catch(() => undefined);
    await overlay
      .first()
      .waitFor({ state: 'hidden', timeout: 1000 })
      .catch(() => undefined);
  }
}

const PAYMENT_MODAL_SELECTOR =
  '.payment-modal, .payment-overlay, .paywall-payment-modal, .paywall-widget-host, .zap-modal, .support-card-modal, .zap-modal-overlay';

export async function clickAndExpectPaymentModal(
  page: Page,
  control: Locator,
  options: { timeout?: number; modalSelector?: string; force?: boolean } = {}
) {
  const { timeout = 10000, modalSelector = PAYMENT_MODAL_SELECTOR, force = true } = options;

  await clickWithDispatchFallback(control, { timeout, force });
  const modal = page.locator(modalSelector).first();
  const quickWindow = Math.min(timeout, 700);
  await expect(modal, 'Payment/ zap modal did not render')
    .toBeVisible({
      timeout: quickWindow
    })
    .catch(async () => {
      await control.dispatchEvent('click');
      await expect(modal, 'Payment/ zap modal did not render').toBeVisible({ timeout });
    });
}

export async function closePaymentModal(
  page: Page,
  modal: Locator,
  options: { timeout?: number } = {}
) {
  const { timeout = 10000 } = options;

  const closeButtons = modal.locator(
    'button.payment-close, button[aria-label="Close payment dialog"], button.close-btn, .close-btn'
  );
  const modalOverlay = page
    .locator('.payment-overlay[role="button"], .zap-modal-overlay[role="button"]')
    .first();

  await closeButtons
    .first()
    .click({ force: true, timeout: 2000 })
    .catch(() => undefined);

  await expect(modal, 'Payment modal did not hide after close')
    .toBeHidden({ timeout })
    .catch(async () => {
      await modalOverlay.click({ force: true }).catch(() => undefined);
      await expect(modal, 'Payment modal did not hide after close')
        .toBeHidden({ timeout: 2000 })
        .catch(() => page.keyboard.press('Escape').catch(() => undefined));
    });

  await expect(modal).toBeHidden({ timeout: 5000 });
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

  // If we are already logged in (reused state), we might already be on feed shell
  const feedStream = page.locator('.feed-stream').first();
  if (await feedStream.isVisible().catch(() => false)) {
    await waitForFeedSurface(page);
    return;
  }

  const loginFlowReady = page
    .getByRole('button', { name: /(Enter nsec manually|Enter private key manually)/i })
    .first();
  const appShellReady = page
    .locator('.sidebar-nav, .sidebar-title, .hamburger-btn, nav, .feed-stream')
    .first();

  const readyState = await Promise.race([
    loginFlowReady
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => 'login' as const)
      .catch(() => 'timeout' as const),
    appShellReady
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => 'app-shell' as const)
      .catch(() => 'timeout' as const)
  ]);

  if (readyState === 'app-shell') return;
  if (readyState === 'timeout') {
    throw new Error('Unable to detect login screen or logged-in shell after navigation');
  }

  // Sometimes the button is not immediately clickable if content is shifting
  const manual = page.getByRole('button', {
    name: /(Enter nsec manually|Enter private key manually)/i
  });
  // Use .first() in case of duplicates (e.g. mobile vs desktop layouts)
  await manual.first().waitFor({ state: 'visible', timeout: 10000 });
  await manual.first().click();

  const input = page.getByPlaceholder('nsec1...');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(nsec);

  const signInBtn = page.getByRole('button', { name: 'Sign in' });
  await signInBtn.click();

  await waitForFeedSurface(page, { timeoutMs: 20000 });
  await dismissOnboardingTourIfOpen(page);
}

export async function ensureZapPostAvailable(
  page: Page,
  options: { fallbackText?: string; timeoutMs?: number } = {}
) {
  const { fallbackText = 'Playwright seed post', timeoutMs = 10_000 } = options;
  const zapButtons = page.locator('.zap-btn');
  const hasExistingZap = await zapButtons.count().catch(() => 0);
  if (hasExistingZap > 0) {
    return;
  }

  const writeFirstPostButton = page.getByRole('button', { name: 'Write your first post' });
  if (await writeFirstPostButton.isVisible().catch(() => false)) {
    await writeFirstPostButton.click();
  }

  const noteInput = page.getByRole('textbox', { name: 'Note content' });
  await expect(noteInput, 'Expected note composer to appear for post fallback').toBeVisible({
    timeout: timeoutMs
  });
  await noteInput.fill(`${fallbackText} ${Date.now()}`);
  await page.getByRole('button', { name: 'Publish' }).click();

  await expect(
    zapButtons.first(),
    'Expected a zap-capable post after seeding fallback content'
  ).toBeVisible({
    timeout: timeoutMs
  });
}
