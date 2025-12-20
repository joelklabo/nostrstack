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

async function loginWithNsec(page: Page, nsec: string) {
  await expect(page.getByText('Sign in to NostrStack')).toBeVisible({ timeout: 30_000 });
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(nsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 20_000 });
}

async function tryZapPay(page: Page) {
  const zapButtons = page.locator('.zap-btn');
  await zapButtons.first().waitFor({ state: 'visible', timeout: 20_000 });
  const total = await zapButtons.count();
  for (let i = 0; i < Math.min(total, 5); i += 1) {
    await zapButtons.nth(i).click();
    await expect(page.locator('.zap-modal')).toBeVisible();
    const invoiceReady = await page
      .locator('.zap-grid')
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!invoiceReady) {
      await page.getByRole('button', { name: /CLOSE/ }).first().click();
      continue;
    }
    await expect(page.locator('.zap-qr')).toBeVisible();
    await expect(page.locator('.zap-panel')).toBeVisible();
    await expect(page.locator('.zap-panel-title')).toHaveText('INVOICE');
    await expect(page.locator('.zap-invoice-box')).toBeVisible();
    const regtestBtn = page.getByRole('button', { name: /PAY_REGTEST/ });
    if (!(await regtestBtn.isVisible())) {
      throw new Error('Regtest pay button missing after invoice ready.');
    }
    await regtestBtn.click();
    await expect(page.getByText('Payment confirmed.')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /CLOSE/ }).first().click();
    return true;
  }
  return false;
}

async function main() {
  // Allow Node-side HTTPS calls to the self-signed dev cert (only for local QA).
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';

  const baseUrl = process.env.GALLERY_URL ?? 'https://localhost:4173';
  const headless = envFlag('HEADLESS', true);
  const slowMo = Number(process.env.SLOWMO_MS ?? 0) || 0;
  const testNsec =
    process.env.TEST_NSEC ?? 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

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

  page.on('pageerror', (err) => {
    if (tearingDown) return;
    pageErrors.push(String(err));
  });
  page.on('console', (msg) => {
    if (tearingDown) return;
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') consoleErrors.push(text);
    if (type === 'warning' || type === 'warn') consoleWarnings.push(text);
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
    await loginWithNsec(page, testNsec);

    const fundBtn = page.getByRole('button', { name: /Add funds \(regtest\)/ });
    if (await fundBtn.count()) {
      await fundBtn.click();
      const toastRegion = page.getByTestId('toast-region');
      await expect(toastRegion).toContainText(/Funded|Mining regtest/i, { timeout: 120_000 });
    }

    const paid = await tryZapPay(page);
    if (!paid) {
      throw new Error('Unable to pay a zap invoice via regtest; no zap-enabled posts found.');
    }
  } catch (err) {
    failures.push({ kind: 'qa', detail: err instanceof Error ? err.stack || err.message : String(err) });
  } finally {
    tearingDown = true;
    await context.close();
    await browser.close();
  }

  if (pageErrors.length) failures.push({ kind: 'pageerror', detail: pageErrors.join('\n') });
  if (localRequestFailures.length) failures.push({ kind: 'requestfailed', detail: localRequestFailures.join('\n') });
  if (localResponses404.length) failures.push({ kind: 'response:404', detail: Array.from(new Set(localResponses404)).join('\n') });
  if (consoleErrors.length) failures.push({ kind: 'console:error', detail: consoleErrors.join('\n') });

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
