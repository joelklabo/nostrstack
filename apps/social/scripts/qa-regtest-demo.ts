#!/usr/bin/env node
import { chromium, expect, type Page } from '@playwright/test';

type Failure = { kind: string; detail: string };

function envFlag(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

function isLocalUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  } catch {
    return false;
  }
}

async function ensureGalleryAvailable(baseUrl: string) {
  if (envFlag('SKIP_PREFLIGHT', false)) {
    console.log('ℹ️ preflight: skipping per SKIP_PREFLIGHT=1');
    return;
  }

  const maxAttempts = Number(process.env.PREFLIGHT_RETRIES ?? 3) || 1;
  const attemptDelay = Number(process.env.PREFLIGHT_DELAY_MS ?? 2000) || 2000;
  const timeoutMs = Number(process.env.PREFLIGHT_TIMEOUT_MS ?? 5000) || 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      console.log(`ℹ️ preflight: checking ${baseUrl} (attempt ${attempt}/${maxAttempts})`);
      const res = await fetch(baseUrl, { method: 'GET', signal: controller.signal });
      // 404 is acceptable for preflight (page exists but sub-path might be missing)
      if (res.ok || res.status === 404) {
        clearTimeout(timeout);
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === maxAttempts) {
        const localHint = `Gallery server not reachable at ${baseUrl}. Start dev servers with "pnpm dev:logs" and try again, or set GALLERY_URL to a running instance.`;
        const remoteHint = `Gallery server not reachable at ${baseUrl}. Check the URL or set GALLERY_URL to a running instance.`;
        console.error('❌ QA preflight failed');
        console.error(isLocalUrl(baseUrl) ? localHint : remoteHint);
        if (err instanceof Error) {
          console.error(`Details: ${err.message}`);
        }
        process.exit(1);
      }
      console.log(`⚠️ preflight: attempt ${attempt} failed, retrying in ${attemptDelay}ms...`);
      await new Promise((r) => setTimeout(r, attemptDelay));
    }
  }
}

async function loginWithNsec(page: Page, nsec: string) {
  await expect(page.getByRole('heading', { name: 'NostrStack' })).toBeVisible({ timeout: 30_000 });
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(nsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 20_000 });
}

async function tryZapPay(page: Page, mode: 'regtest' | 'nwc') {
  const zapButtons = page.locator('.zap-btn');
  await zapButtons.first().waitFor({ state: 'visible', timeout: 20_000 });
  const total = await zapButtons.count();
  for (let i = 0; i < Math.min(total, 5); i += 1) {
    await zapButtons.nth(i).click();
    await expect(page.locator('.payment-modal')).toBeVisible();
    if (mode === 'nwc') {
      const nwcPaid = await page
        .getByText('NWC payment sent.')
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      if (!nwcPaid) {
        await page.getByRole('button', { name: /CLOSE/ }).first().click();
        continue;
      }
      await expect(page.getByText('Payment successful!')).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: /CLOSE/ }).first().click();
      return true;
    }

    const invoiceReady = await page
      .locator('.payment-grid')
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!invoiceReady) {
      await page.getByRole('button', { name: /CLOSE/ }).first().click();
      continue;
    }
    await expect(page.locator('.payment-qr')).toBeVisible();
    await expect(page.locator('.payment-panel')).toBeVisible();
    await expect(page.locator('.payment-panel-title')).toHaveText('INVOICE');
    await expect(page.locator('.payment-invoice-box')).toBeVisible();
    // Use text-based selector since aria-label is different from button text
    const regtestBtn = page.locator('button:has-text("PAY_REGTEST")');
    if (!(await regtestBtn.isVisible())) {
      throw new Error('Regtest pay button missing after invoice ready.');
    }
    await regtestBtn.waitFor({ state: 'visible' });
    await regtestBtn.click({ force: true });
    await expect(page.locator('.payment-modal')).toContainText(/Payment (sent|confirmed)\./, {
      timeout: 20_000
    });
    // Use text-based selector for CLOSE button
    await page.locator('button:has-text("CLOSE")').first().click();
    return true;
  }
  return false;
}

async function tryBolt12Flow(page: Page) {
  await page.getByRole('button', { name: /Offers/i }).click();
  await expect(page.getByText('BOLT12 Offers')).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('Description').fill('Regtest QA offer');
  await page.getByRole('button', { name: 'CREATE_OFFER' }).click();

  const offerWidget = page.locator('.offer-widget__title', { hasText: 'Offer' });
  await expect(offerWidget).toBeVisible({ timeout: 20_000 });

  const offerError = page.locator('.offer-error');
  if (await offerError.isVisible()) {
    throw new Error(`BOLT12 offer error: ${await offerError.textContent()}`);
  }

  await page.getByRole('button', { name: 'REQUEST_INVOICE' }).click();
  const invoiceWidget = page.locator('.offer-widget__title', { hasText: 'Invoice' });
  await expect(invoiceWidget).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.offer-widget__value').nth(1)).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /Feed/i }).click();
  await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 20_000 });
}

async function configureNwc(
  page: Page,
  options: { uri: string; relays?: string; maxSats?: string }
) {
  await page.getByRole('button', { name: /Settings/i }).click();
  await page.getByLabel('NWC_URI').fill(options.uri);
  if (options.relays) {
    await page.getByLabel(/RELAYS/i).fill(options.relays);
  }
  if (options.maxSats) {
    await page.getByLabel(/MAX_SATS_PER_PAYMENT/i).fill(options.maxSats);
  }
  await page.getByRole('button', { name: 'CONNECT' }).click();
  await expect(page.locator('.nwc-status-pill')).toHaveText(/CONNECTED/, { timeout: 20_000 });
  await page.getByRole('button', { name: /Feed/i }).click();
  await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 20_000 });
}

async function main() {
  // Allow Node-side HTTPS calls to the self-signed dev cert (only for local QA).
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';

  const baseUrl = process.env.GALLERY_URL ?? 'https://localhost:4173';
  const headless = envFlag('HEADLESS', true);
  const slowMo = Number(process.env.SLOWMO_MS ?? 0) || 0;
  const testNsec =
    process.env.TEST_NSEC ?? 'nsec1v0fhzv8swp7gax4kn8ux6p5wj2ljz32xj0v2ssuxvck5aa0d8xxslue67d';
  const nwcUri = process.env.NWC_URI;
  const nwcRelays = process.env.NWC_RELAYS;
  const nwcMaxSats = process.env.NWC_MAX_SATS;
  const enableBolt12 = envFlag('ENABLE_BOLT12', false) || envFlag('VITE_ENABLE_BOLT12', false);

  await ensureGalleryAvailable(baseUrl);

  const failures: Failure[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const localRequestFailures: string[] = [];
  const localResponses404: string[] = [];
  const pageErrors: string[] = [];
  let tearingDown = false;

  const browser = await chromium.launch({
    headless,
    slowMo,
    args: ['--ignore-certificate-errors']
  });
  const context = await browser.newContext({
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  page.on('pageerror', (err) => {
    if (tearingDown) return;
    pageErrors.push(String(err));
  });
  page.on('console', (msg) => {
    if (tearingDown) return;
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') consoleErrors.push(text);
    if (type === 'warning' || type === 'warn') {
      consoleWarnings.push(text);
    }
  });
  page.on('requestfailed', (req) => {
    if (tearingDown) return;
    const url = req.url();
    if (!isLocalUrl(url)) return;
    const failure = req.failure();
    const errText = failure?.errorText ?? 'unknown error';
    if (
      (url.includes('/logs/stream') || url.includes('/api/logs/stream')) &&
      (errText === 'net::ERR_ABORTED' || errText === 'net::ERR_NETWORK_IO_SUSPENDED')
    ) {
      return;
    }
    localRequestFailures.push(`${url} :: ${errText}`);
  });
  page.on('response', (res) => {
    if (tearingDown) return;
    if (res.status() !== 404) return;
    const url = res.url();
    if (!isLocalUrl(url)) return;
    localResponses404.push(url);
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    // Skip onboarding tour to prevent overlay from blocking interactions
    await page.evaluate(() => {
      localStorage.setItem('nostrstack.onboarding.v1', 'true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await loginWithNsec(page, testNsec);

    const usingNwc = Boolean(nwcUri);
    if (usingNwc && nwcUri) {
      await configureNwc(page, { uri: nwcUri, relays: nwcRelays, maxSats: nwcMaxSats });
    } else {
      const fundBtn = page.getByRole('button', { name: /Add funds \(regtest\)/ });
      if (await fundBtn.count()) {
        await fundBtn.click();
        const toastRegion = page.getByTestId('toast-region');
        await expect(toastRegion).toContainText(/Funded|Mining regtest/i, { timeout: 120_000 });
      }
    }

    if (enableBolt12) {
      await tryBolt12Flow(page);
    }

    const paid = await tryZapPay(page, usingNwc ? 'nwc' : 'regtest');
    if (!paid) {
      throw new Error('Unable to pay a zap invoice via regtest; no zap-enabled posts found.');
    }
  } catch (err) {
    failures.push({
      kind: 'qa',
      detail: err instanceof Error ? err.stack || err.message : String(err)
    });
  } finally {
    tearingDown = true;
    await context.close();
    await browser.close();
  }

  if (pageErrors.length) failures.push({ kind: 'pageerror', detail: pageErrors.join('\n') });
  if (localRequestFailures.length)
    failures.push({ kind: 'requestfailed', detail: localRequestFailures.join('\n') });
  if (localResponses404.length)
    failures.push({
      kind: 'response:404',
      detail: Array.from(new Set(localResponses404)).join('\n')
    });
  if (consoleErrors.length)
    failures.push({ kind: 'console:error', detail: consoleErrors.join('\n') });

  // Warnings are informative but don’t fail by default; opt-in via FAIL_ON_WARN=1.
  if (envFlag('FAIL_ON_WARN', false) && consoleWarnings.length) {
    failures.push({ kind: 'console:warn', detail: consoleWarnings.join('\n') });
  }

  if (failures.length) {
    console.error('❌ QA failed');
    failures.forEach((f) => {
      console.error(`\n[${f.kind}]`);
      console.error(f.detail);
    });
    process.exit(1);
  }

  console.log('✅ QA passed');
  if (consoleWarnings.length) {
    console.log(`ℹ️ warnings: ${consoleWarnings.length} (set FAIL_ON_WARN=1 to fail)`);
  }
}

main().catch((err) => {
  console.error('❌ QA script crashed:', err);
  process.exit(1);
});
