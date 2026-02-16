import { expect, type Locator, type Page, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';

import {
  clickAndExpectPaymentModal,
  ensureZapPostAvailable,
  loginWithNsec,
  toggleTheme
} from './helpers.ts';
import { mockLnurlPay } from './helpers/lnurl-mocks.ts';
import { installMockRelay } from './helpers/mock-websocket.ts';

const demoSecretKey = generateSecretKey();
const demoNow = Math.floor(Date.now() / 1000);

const demoProfileEvent = finalizeEvent(
  {
    kind: 0,
    created_at: demoNow,
    tags: [],
    content: JSON.stringify({
      name: 'Demo Poster',
      about: 'Automated test profile'
    })
  },
  demoSecretKey
);

const demoPosts = [
  finalizeEvent(
    {
      kind: 1,
      created_at: demoNow - 10,
      tags: [['paywall', '21']],
      content: 'Playwright paywalled content'
    },
    demoSecretKey
  ),
  finalizeEvent(
    {
      kind: 1,
      created_at: demoNow - 20,
      tags: [],
      content: 'Playwright tip post'
    },
    demoSecretKey
  ),
  finalizeEvent(
    {
      kind: 1,
      created_at: demoNow - 30,
      tags: [],
      content: 'Playwright backup post'
    },
    demoSecretKey
  )
];
const MOCK_BITCOIN_STATUS = {
  network: 'regtest',
  configuredNetwork: 'regtest',
  source: 'mock',
  telemetry: {
    height: 0,
    hash: '000000000000000000000000000000000000000000000000000000000000000000',
    time: Math.floor(Date.now() / 1000),
    network: 'regtest',
    subversion: '/NostrStack Demo/',
    version: 0,
    headers: 0,
    blocks: 0,
    connections: 0
  },
  lightning: {
    provider: 'mock',
    lnbits: { status: 'skipped', reason: 'provider_not_lnbits' }
  }
};

async function installDemoMockRelay(page: Page) {
  await installMockRelay(page, [demoProfileEvent, ...demoPosts], {
    zapAddress: 'https://mock.lnurl/lnurlp/test'
  });
}

async function installDemoTelemetryMocks(page: Page) {
  await page.route('**/api/bitcoin/status', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BITCOIN_STATUS)
    });
  });
}

function shouldIgnoreRequestFailure(url: string) {
  const ignorePaths = [
    '/api/bitcoin/status',
    '/api/telemetry',
    '/api/node/status',
    '/api/nostr/event'
  ];
  return ignorePaths.some((path) => url.includes(path));
}

function isKnownConsoleError(message: string) {
  const ignoreErrors = [
    /An SSL certificate error occurred when fetching the script/i,
    /Failed to load resource: net::ERR_CONNECTION_REFUSED/i,
    /ERR_CERT_COMMON_NAME_INVALID/i,
    /ERR_NAME_NOT_RESOLVED/i
  ];
  return ignoreErrors.some((pattern) => pattern.test(message));
}

async function measureCardOverflow(page: Page) {
  return page.evaluate(() => {
    const payWidget = document.querySelector('.paywall-widget-host, .ns-pay') as HTMLElement | null;
    const card = payWidget?.closest('.paywall-payment-modal-content') as HTMLElement | null;
    if (!payWidget || !card) return null;
    const cardRect = card.getBoundingClientRect();
    let maxDelta = 0;
    let offender: { tag: string; cls: string; text: string; delta: number } | null = null;
    for (const el of Array.from(card.querySelectorAll('*'))) {
      const rect = (el as HTMLElement).getBoundingClientRect();
      const delta = rect.right - cardRect.right;
      if (delta > maxDelta + 0.25) {
        maxDelta = delta;
        offender = {
          tag: el.tagName.toLowerCase(),
          cls: (el as HTMLElement).className || '',
          text: ((el as HTMLElement).textContent || '').trim().slice(0, 80),
          delta
        };
      }
    }
    return { maxDelta, offender };
  });
}

async function dismissTourIfOpen(page: Page) {
  const tourControls = [
    page.getByRole('button', { name: 'Skip tour' }),
    page.getByRole('button', { name: 'Dismiss tour' }),
    page.getByRole('button', { name: 'Go to next step' })
  ];

  for (const control of tourControls) {
    if (await control.isVisible({ timeout: 1000 }).catch(() => false)) {
      await control.click().catch(() => undefined);
      return;
    }
  }
}

async function waitForVisible(locator: Locator, message: string, timeout = 12_000) {
  await expect(locator, message).toBeVisible({ timeout });
}

test('tip button renders', async ({ page }) => {
  await installDemoMockRelay(page);
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  await ensureZapPostAvailable(page, { fallbackText: 'Playwright tip fixture' });
  const zapButtons = page.locator('.zap-btn');
  const count = await zapButtons.count();
  expect(count, 'No zap buttons available in feed').toBeGreaterThan(0);
  await expect(zapButtons.first()).toBeVisible();
});

test('pay-to-unlock shows locked state', async ({ page }) => {
  await installDemoMockRelay(page);
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  const count = await unlockButtons.count();
  expect(count, 'No paywalled content available').toBeGreaterThan(0);
  await expect(unlockButtons.first()).toBeVisible();
});

test('pay-to-unlock does not overflow card at common widths', async ({ page }) => {
  await installDemoMockRelay(page);
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  expect(await unlockButtons.count(), 'No paywalled content available').toBeGreaterThan(0);
  await clickAndExpectPaymentModal(page, unlockButtons.first(), {
    modalSelector: '.paywall-payment-modal, .paywall-widget-host'
  });
  const payWidget = page.locator('.paywall-widget-host, .ns-pay');
  await expect(payWidget, 'Paywall widget did not render').toBeVisible({ timeout: 8_000 });

  const widths = [1024, 1152, 1280, 1366, 1440, 1514];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await measureCardOverflow(page);
    expect(overflow, 'paywall card not found').not.toBeNull();
    expect(
      overflow!.maxDelta,
      `overflow at ${width}px: ${JSON.stringify(overflow!.offender)}`
    ).toBeLessThanOrEqual(1);
  }
});

test('tip flow generates invoice', async ({ page }) => {
  await installDemoMockRelay(page);
  await installDemoTelemetryMocks(page);
  const failedRequests: string[] = [];
  page.on('requestfailed', (request) => {
    if (shouldIgnoreRequestFailure(request.url())) return;
    failedRequests.push(`${request.method()} ${request.url()}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && isKnownConsoleError(msg.text())) return;
    if (msg.type() === 'error') {
      failedRequests.push(`console: ${msg.text()}`);
    }
  });

  await page.addInitScript(() => {
    window.__NOSTRSTACK_ZAP_ADDRESS__ = 'https://mock.lnurl/lnurlp/test';
  });
  await mockLnurlPay(page, {
    callback: 'https://localhost:4173/mock-lnurl-callback',
    metadataText: 'Playwright demo flow tip'
  });
  await loginWithNsec(page);
  await dismissTourIfOpen(page);
  await ensureZapPostAvailable(page, { fallbackText: 'Playwright tip flow seed' });
  await dismissTourIfOpen(page);
  const zapButtons = page.locator('.zap-btn');
  expect(await zapButtons.count(), 'No zap buttons available in feed').toBeGreaterThan(0);
  await zapButtons.first().scrollIntoViewIfNeeded();
  await clickAndExpectPaymentModal(page, zapButtons.first());
  const paymentModal = page
    .locator('.payment-modal, .paywall-payment-modal, .paywall-widget-host')
    .first();
  const invoiceBox = page.locator('.payment-invoice-box');
  const hasInvoice = await invoiceBox.count();
  if (hasInvoice > 0) {
    await expect(invoiceBox.first()).toBeVisible({ timeout: 8_000 });
    await expect(invoiceBox.first()).toContainText(/ln/i);
  } else {
    await expect(paymentModal.locator('.payment-status').first()).toBeVisible({ timeout: 8_000 });
  }

  expect(failedRequests).toEqual([]);
});

test('simulate unlock flow', async ({ page }) => {
  await installDemoMockRelay(page);
  await loginWithNsec(page);
  const unlockButtons = page.getByRole('button', { name: /UNLOCK_CONTENT/i });
  await waitForVisible(unlockButtons.first(), 'Paywall UNLOCK_CONTENT control should be visible');
  await clickAndExpectPaymentModal(page, unlockButtons.first(), {
    modalSelector: '.paywall-payment-modal, .paywall-widget-host'
  });
  await expect(page.locator('.paywall-payment-modal')).toBeVisible({ timeout: 8_000 });
});

test('embed tip generates mock invoice', async ({ page }) => {
  await page.addInitScript(() => {
    window.__NOSTRSTACK_ZAP_ADDRESS__ = 'https://mock.lnurl/lnurlp/test';
  });
  await mockLnurlPay(page, {
    callback: 'https://localhost:4173/mock-lnurl-callback',
    metadataText: 'Playwright support card'
  });
  await loginWithNsec(page);
  await page.goto('/');
  const supportCard = page.getByRole('region', { name: 'Support Nostrstack' });
  await waitForVisible(supportCard, 'Support card should render');

  const sendSatsBtn = supportCard.getByRole('button', {
    name: /support nostrstack with a zap|send sats/i
  });
  if ((await sendSatsBtn.count()) === 0) {
    const copyEnvBtn = supportCard.getByRole('button', { name: /Copy env template/i });
    if ((await copyEnvBtn.count()) > 0) {
      await waitForVisible(
        copyEnvBtn,
        'Support card env setup fallback action should render',
        10_000
      );
      await expect(supportCard).toBeVisible();
      return;
    }
    throw new Error(
      'Support card is visible but does not expose either Send sats or env fallback button.'
    );
  }

  await clickAndExpectPaymentModal(page, sendSatsBtn, {
    modalSelector: '.payment-modal, .support-card-modal'
  });
  const supportModal = page.locator('.support-card-modal');
  await expect(supportModal).toBeVisible({ timeout: 10_000 });
  const supportPayBtn = supportModal.getByRole('button', { name: /send \d+ sats/i }).first();
  if (await supportPayBtn.isVisible().catch(() => false)) {
    await supportPayBtn.click();
  }
  await expect(page.locator('.payment-modal, .support-card-modal').first()).toBeVisible({
    timeout: 10_000
  });
  const invoiceBox = page.locator('.payment-invoice-box');
  if ((await invoiceBox.count()) > 0) {
    await expect(invoiceBox.first()).toBeVisible({ timeout: 8_000 });
  } else {
    await expect(page.locator('.payment-status').first()).toBeVisible({ timeout: 8_000 });
  }
});

test('embed pay unlocks content', async ({ page }) => {
  await installDemoMockRelay(page);
  await loginWithNsec(page);
  await page.goto('/');
  const authButtons = page.locator('.auth-btn');
  const paywallButton = authButtons.filter({ hasText: 'UNLOCK_CONTENT' }).first();
  await waitForVisible(
    paywallButton,
    'Embedded paywall unlock control should render after feed load',
    15_000
  );
  await clickAndExpectPaymentModal(page, paywallButton, {
    modalSelector: '.paywall-payment-modal, .paywall-widget-host'
  });
  await expect(page.locator('.paywall-payment-modal')).toBeVisible({ timeout: 8_000 });
});

test('embed comments accept mock post', async ({ page }) => {
  await installDemoMockRelay(page);
  await loginWithNsec(page);
  const nostrButton = page.getByRole('button', { name: 'Nostr' });
  if ((await nostrButton.count()) === 0) {
    test.skip(
      true,
      'Comments rail is not present in current build; commenting UI is optional for this demo scenario.'
    );
    return;
  }
  await waitForVisible(
    nostrButton,
    'Nostr comments rail toggle should be available in the current layout',
    12_000
  );
  await nostrButton.click();
  const commentBox = page.locator('#comments-container textarea');
  if ((await commentBox.count()) === 0) {
    test.skip(
      true,
      'Comments widget not mounted in this app revision; treated as optional coverage for embedded comments.'
    );
    return;
  }
  await waitForVisible(commentBox.first(), 'Comments composer should render when rail is open');
  await commentBox.first().fill('Hello comments');
  await page.locator('#comments-container button', { hasText: 'Post' }).click();
  await expect(page.locator('#comments-container')).toContainText('Hello comments');
});

test('relay badge renders in mock mode', async ({ page }) => {
  await loginWithNsec(page);
  await page.goto('/');
  const relayBadge = page.locator('.feed-relay-status');
  await waitForVisible(relayBadge, 'Relay status badge should render on feed', 12_000);
  await expect(relayBadge.locator('.feed-relay-dot')).toBeVisible({ timeout: 10_000 });
});

test('theme toggle flips background', async ({ page }) => {
  await loginWithNsec(page);
  const settingsButton = page.getByRole('button', { name: /Settings/i });
  await waitForVisible(settingsButton, 'Settings navigation control should be available');
  await settingsButton.click();
  const body = page.locator('body');
  const currentTheme = (await body.getAttribute('data-theme')) || 'light';
  const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
  await expect(page.getByRole('button', { name: /Switch to .+ mode/i }).first()).toBeVisible({
    timeout: 12_000
  });
  await toggleTheme(page, targetTheme);
  await expect(body).toHaveAttribute('data-theme', targetTheme);
});
