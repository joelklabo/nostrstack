#!/usr/bin/env node
import { chromium, expect } from '@playwright/test';

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

async function main() {
  // Allow Node-side HTTPS calls to the self-signed dev cert (only for local QA).
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';

  const baseUrl = process.env.GALLERY_URL ?? 'https://localhost:4173';
  const headless = envFlag('HEADLESS', true);
  const slowMo = Number(process.env.SLOWMO_MS ?? 0) || 0;

  const failures: Failure[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const localRequestFailures: string[] = [];
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
    if (url.includes('/api/logs/stream') && (errText === 'net::ERR_ABORTED' || errText === 'net::ERR_NETWORK_IO_SUSPENDED')) {
      return;
    }
    localRequestFailures.push(`${url} :: ${errText}`);
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('nostrstack Demo')).toBeVisible({ timeout: 30_000 });

    // Smoke: health badges should resolve (not stay "unknown").
    await expect(page.getByText('API', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('LNbits', { exact: true }).first()).toBeVisible();

    // Wallet panel copy buttons (scoped to avoid global "Copied" collisions).
    const copyUrlBtn = page.locator('li', { hasText: 'Open LNbits UI:' }).getByRole('button');
    await copyUrlBtn.click();
    await expect(copyUrlBtn).toHaveText('Copied');
    const copyKeyBtn = page.locator('li', { hasText: 'Admin key:' }).getByRole('button');
    await copyKeyBtn.click();
    await expect(copyKeyBtn).toHaveText('Copied');

    // WalletBalance controls.
    await page.getByRole('button', { name: 'Show key' }).click();
    await expect(page.getByRole('button', { name: 'Hide key' })).toBeVisible();
    await page.getByRole('button', { name: 'Hide key' }).click();
    await expect(page.getByRole('button', { name: 'Show key' })).toBeVisible();

    const refreshBtn = page.getByRole('button', { name: 'Refresh', exact: true });
    await refreshBtn.click();
    // Should return to enabled "Refresh" after any fetch completes.
    await expect(refreshBtn).toBeEnabled({ timeout: 30_000 });

    // Custom wallet: paste admin key + reset + save.
    const dummyKey = 'dummy-admin-key-' + Date.now();
    await page.evaluate(async (k) => navigator.clipboard.writeText(k), dummyKey);
    await page.getByRole('button', { name: 'Paste admin key' }).click();
    await page.getByRole('button', { name: 'Save & refresh' }).click();
    await page.getByRole('button', { name: 'Reset to env' }).click();

    // Faucet.
    await page.getByRole('button', { name: 'Add funds (regtest)' }).click();
    await expect(page.getByText(/Funded & mined/i)).toBeVisible({ timeout: 120_000 });

    // Config & presets.
    await page.getByRole('button', { name: 'Dark' }).click();
    await page.getByRole('button', { name: 'Light' }).click();
    const relaysRow = page.getByRole('button', { name: 'Use real defaults' }).locator('..');
    const copyRelaysBtn = relaysRow.getByRole('button').nth(1);
    await copyRelaysBtn.click();
    await expect(copyRelaysBtn).toHaveText('Copied');

    // Comments: switch relays to mock + post.
    const relaysInput = page.locator('input[placeholder="wss://relay1,wss://relay2"]').first();
    await relaysInput.fill('mock');
    await page.waitForTimeout(300); // allow remount
    await page.getByRole('button', { name: 'Nostr' }).click();
    await expect(page.getByText('Comments (Nostr)', { exact: true })).toBeVisible();
    const commentBox = page.locator('#comments-container textarea').first();
    await commentBox.waitFor({ timeout: 15_000 });
    const comment = `qa-${Date.now()}`;
    await commentBox.fill(comment);
    await page.locator('#comments-container button', { hasText: 'Post' }).first().click();
    await expect(page.locator('#comments-container')).toContainText(comment, { timeout: 15_000 });

    // Back to Lightning for payment flows.
    await page.getByRole('button', { name: 'Lightning' }).click();

    // Tip button -> invoice popover -> pay via in-app test payer.
    await page.locator('#tip-container button').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const bolt11 = (await dialog.locator('code').last().textContent())?.trim() ?? '';
    expect(bolt11).toMatch(/^ln/i);
    await page.evaluate(async (invoice) => {
      await navigator.clipboard.writeText(invoice);
      const paste = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Paste') as HTMLButtonElement | undefined;
      paste?.click();
    }, bolt11);
    const payerInput = page.locator('input[placeholder="Paste BOLT11"]').first();
    await expect(payerInput).toHaveValue(bolt11, { timeout: 10_000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Pay with test payer') as HTMLButtonElement | undefined;
      if (!btn) throw new Error('Pay with test payer button not found');
      btn.click();
    });
    await expect(dialog).toContainText(/Paid|Payment confirmed/i, { timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Close invoice' }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Pay-to-unlock -> invoice -> pay -> unlocked content.
    await page.locator('#pay-container button').first().click();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const bolt11Unlock = (await dialog.locator('code').last().textContent())?.trim() ?? '';
    expect(bolt11Unlock).toMatch(/^ln/i);
    await page.evaluate(async (invoice) => {
      await navigator.clipboard.writeText(invoice);
      const paste = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Paste') as HTMLButtonElement | undefined;
      paste?.click();
    }, bolt11Unlock);
    await expect(payerInput).toHaveValue(bolt11Unlock, { timeout: 10_000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Pay with test payer') as HTMLButtonElement | undefined;
      if (!btn) throw new Error('Pay with test payer button not found');
      btn.click();
    });
    await expect(page.getByTestId('unlock-status')).toContainText(/Unlocked/i, { timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Close invoice' }).click();

    // Request real invoice (API /api/pay) -> recheck status -> pay.
    const requestReal = page.getByRole('button', { name: /Request real invoice/i }).first();
    await requestReal.click();
    await expect(page.getByTestId('real-invoice')).toContainText('lnbcrt', { timeout: 30_000 });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Recheck payment status') as HTMLButtonElement | undefined;
      if (!btn) throw new Error('Recheck payment status button not found');
      btn.click();
    });
    const bolt11Real = (await dialog.locator('code').last().textContent())?.trim() ?? '';
    expect(bolt11Real).toMatch(/^ln/i);
    await page.evaluate(async (invoice) => {
      await navigator.clipboard.writeText(invoice);
      const paste = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Paste') as HTMLButtonElement | undefined;
      paste?.click();
    }, bolt11Real);
    await expect(payerInput).toHaveValue(bolt11Real, { timeout: 10_000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Pay with test payer') as HTMLButtonElement | undefined;
      if (!btn) throw new Error('Pay with test payer button not found');
      btn.click();
    });
    await expect(dialog).toContainText(/Paid|Payment confirmed/i, { timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Close invoice' }).click();

    // Logs: SSE + controls.
    await page.getByRole('button', { name: 'Logs' }).click();
    await expect(page.getByText('Backend stream', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reconnect' }).click();
    await page.getByLabel('Filter logs').fill('wallet');
    await page.getByText(/Capture frontend console/i).click();
    await page.getByRole('button', { name: 'Clear' }).first().click();
  } catch (err) {
    failures.push({ kind: 'qa', detail: err instanceof Error ? err.stack || err.message : String(err) });
  } finally {
    tearingDown = true;
    await context.close();
    await browser.close();
  }

  if (pageErrors.length) failures.push({ kind: 'pageerror', detail: pageErrors.join('\n') });
  if (localRequestFailures.length) failures.push({ kind: 'requestfailed', detail: localRequestFailures.join('\n') });
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
