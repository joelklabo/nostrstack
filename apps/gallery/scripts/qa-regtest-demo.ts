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

async function payWithTestPayer(page: Page) {
  const payBtn = page.getByTestId('test-payer-pay');
  await expect(payBtn).toBeVisible({ timeout: 30_000 });
  await expect(payBtn).toBeEnabled({ timeout: 30_000 });
  // The invoice dialog can overlay parts of the page; click via DOM to avoid hit-target flakiness.
  await payBtn.evaluate((el) => (el as HTMLButtonElement).click());
  await expect(payBtn).toHaveText(/Paying/i, { timeout: 10_000 });
  await expect(payBtn).toHaveText(/Pay with test payer/i, { timeout: 30_000 });
  await expect(payBtn).toBeEnabled({ timeout: 30_000 });
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
    if (url.includes('/api/logs/stream') && (errText === 'net::ERR_ABORTED' || errText === 'net::ERR_NETWORK_IO_SUSPENDED')) {
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
    await expect(page.getByText('nostrstack Demo')).toBeVisible({ timeout: 30_000 });

    // Smoke: health badges should resolve (not stay "unknown").
    await expect(page.getByText('API', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('LNbits', { exact: true }).first()).toBeVisible();

    // Wallet panel copy buttons (scoped to avoid global "Copied" collisions).
    const copyUrlBtn = page.locator('li', { hasText: 'Open LNbits UI:' }).getByRole('button');
    await copyUrlBtn.click();
    await expect(page.getByTestId('toast-region')).toContainText('Copied URL');
    const copyKeyBtn = page.locator('li', { hasText: 'Admin key:' }).getByRole('button');
    await copyKeyBtn.click();
    await expect(page.getByTestId('toast-region')).toContainText('Copied key');
    let adminKeyFromClipboard = '';
    try {
      adminKeyFromClipboard = (await page.evaluate(async () => navigator.clipboard.readText())) ?? '';
    } catch {
      // Some environments may not allow clipboard reads; fall back to DOM.
    }
    let adminKey = adminKeyFromClipboard.trim();
    if (!/^[0-9a-f]{8,}$/i.test(adminKey)) {
      adminKey =
        (await page
          .locator('li', { hasText: 'Admin key:' })
          .locator('code')
          .first()
          .textContent())?.trim() ?? '';
    }
    expect(adminKey).toMatch(/^[0-9a-f]{8,}$/i);

    // WalletBalance controls.
    await page.getByRole('button', { name: 'Show key' }).click();
    await expect(page.getByRole('button', { name: 'Hide key' })).toBeVisible();
    await page.getByRole('button', { name: 'Hide key' }).click();
    await expect(page.getByRole('button', { name: 'Show key' })).toBeVisible();

    const refreshBtn = page.getByRole('button', { name: 'Refresh', exact: true });
    await refreshBtn.click();
    // Should return to enabled "Refresh" after any fetch completes.
    await expect(refreshBtn).toBeEnabled({ timeout: 30_000 });
    await expect(refreshBtn).toHaveText('Refresh', { timeout: 30_000 });

    // Custom wallet: paste admin key + reset + save.
    await page.evaluate(async (k) => navigator.clipboard.writeText(k), adminKey);
    await page.getByRole('button', { name: 'Paste admin key' }).click();
    await page.getByRole('button', { name: 'Save & refresh' }).click();
    await page.getByRole('button', { name: 'Reset to env' }).click();
    await expect
      .poll(async () => {
        return page.evaluate(() => ({
          url: window.localStorage.getItem('nostrstack.lnbits.url'),
          key: window.localStorage.getItem('nostrstack.lnbits.key'),
          readKey: window.localStorage.getItem('nostrstack.lnbits.readKey'),
          walletId: window.localStorage.getItem('nostrstack.lnbits.walletId.manual')
        }));
      })
      .toEqual({ url: null, key: null, readKey: null, walletId: null });

    // Faucet.
    await page.getByRole('button', { name: 'Add funds (regtest)' }).click();
    await expect(page.getByText(/Funded & mined/i)).toBeVisible({ timeout: 120_000 });

    // Config & presets.
    await page.getByLabel('Amount (sats)').first().fill('6');
    await page
      .getByRole('button', { name: 'Dark', exact: true })
      .evaluate((el) => (el as HTMLButtonElement).click());
    await page
      .getByRole('button', { name: 'Light', exact: true })
      .evaluate((el) => (el as HTMLButtonElement).click());

    // Brand preset should change primary color.
    const primaryBefore =
      (await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('.nostrstack-theme') as HTMLElement).getPropertyValue(
            '--nostrstack-color-primary'
          )
      )) ?? '';
    const brandSelect = page.getByLabel('Brand preset');
    await brandSelect.selectOption('emerald');
    const primaryAfter =
      (await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('.nostrstack-theme') as HTMLElement).getPropertyValue(
            '--nostrstack-color-primary'
          )
      )) ?? '';
    expect(primaryAfter.trim()).not.toEqual(primaryBefore.trim());

    // Theme export: copy CSS + vars.
    const themeExportHeading = page.getByRole('heading', { name: 'Theme export' }).first();
    await themeExportHeading.scrollIntoViewIfNeeded();
    const selectorInput = page.getByPlaceholder('.nostrstack-theme').first();
    await selectorInput.fill('.qa-theme');
    await page.getByRole('button', { name: 'Copy CSS (light+dark)' }).click();
    await expect(page.getByTestId('toast-region')).toContainText('Copied CSS (light+dark)');
    const cssFromClipboard = (await page.evaluate(async () => navigator.clipboard.readText())) ?? '';
    expect(cssFromClipboard).toContain('.qa-theme');
    await page.getByRole('button', { name: 'Copy vars (json)' }).click();
    await expect(page.getByTestId('toast-region')).toContainText('Copied vars (json)');
    const varsFromClipboard = (await page.evaluate(async () => navigator.clipboard.readText())) ?? '';
    expect(varsFromClipboard).toContain('"--nostrstack-color-primary"');

    // QR Lab: should verify (or fall back) without console errors.
    const qrLabHeading = page.getByRole('heading', { name: 'QR Lab' }).first();
    await qrLabHeading.scrollIntoViewIfNeeded();
    const qrLabStatus = page.getByTestId('qr-lab-status');
    await expect(qrLabStatus).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => (await qrLabStatus.textContent())?.trim() ?? '', { timeout: 30_000 })
      .toMatch(/^(OK|Fallback used)$/);

    // Relays: apply defaults, copy, and exercise Add relay (with a duplicate).
    await page.getByRole('button', { name: 'Use real defaults' }).click();
    const relaysRow = page.getByRole('button', { name: 'Use real defaults' }).locator('..');
    const copyRelaysBtn = relaysRow.getByRole('button').nth(1);
    await copyRelaysBtn.click();
    await expect(page.getByTestId('toast-region')).toContainText('Copied relays');

    const relaysInput = page.locator('input[placeholder="wss://relay1,wss://relay2"]').first();
    const relaysBefore = await relaysInput.inputValue();
    const firstRelay = relaysBefore.split(',').map((s) => s.trim()).filter(Boolean)[0] ?? '';
    if (firstRelay) {
      const addRelayInput = page.getByLabel('Add relay URL').first();
      await addRelayInput.fill(firstRelay);
      await page.getByRole('button', { name: 'Add relay' }).click();
      await expect(relaysInput).toHaveValue(relaysBefore);
    }

    // Nostr: exercise profile + panel controls.
    await page.getByRole('tab', { name: 'Nostr' }).click();
    await expect(page.getByText('Comments (Nostr)', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Preview missing state' }).click();
    await expect(page.getByRole('button', { name: 'Show detected state' })).toBeVisible();
    await page.getByRole('button', { name: 'Show detected state' }).click();
    await expect(page.getByRole('button', { name: 'Preview missing state' })).toBeVisible();
    await page.getByRole('button', { name: 'Re-check' }).click();
    await page.getByRole('button', { name: 'Request permission' }).click();

    await page.getByRole('button', { name: 'hex' }).first().click();
    await page.getByRole('button', { name: 'npub' }).first().click();
    // Copy key may be disabled when no signer/pubkey is available in this environment.
    const nostrCopyKeyBtn = page.getByRole('button', { name: 'Copy key' }).first();
    if (await nostrCopyKeyBtn.isEnabled()) await nostrCopyKeyBtn.click();

    await page.getByRole('button', { name: 'Clear feed' }).click();

    // Comments: switch relays to mock + post.
    await page.getByRole('tab', { name: 'Lightning' }).click();
    await relaysInput.fill('mock');
    await page.waitForTimeout(300); // allow remount
    await page.getByRole('tab', { name: 'Nostr' }).click();
    const commentBox = page.locator('#comments-container textarea').first();
    await commentBox.waitFor({ timeout: 15_000 });
    const comment = `qa-${Date.now()}`;
    await commentBox.fill(comment);
    await page.locator('#comments-container button', { hasText: 'Post' }).first().click();
    await expect(page.locator('#comments-container')).toContainText(comment, { timeout: 15_000 });

    // Back to Lightning for payment flows.
    await page.getByRole('tab', { name: 'Lightning' }).click();

    // Tip widget -> generate invoice -> pay via in-app test payer.
    const tipPreset = page.locator('#tip-container .nostrstack-tip__amt').first();
    await expect(tipPreset).toBeVisible({ timeout: 30_000 });
    await tipPreset.click();
    const tipInvoice = page.locator('#tip-container .nostrstack-invoice-box code').first();
    await expect(tipInvoice).toHaveText(/^ln/i, { timeout: 30_000 });
    const bolt11 = (await tipInvoice.textContent())?.trim() ?? '';
    expect(bolt11).toMatch(/^ln/i);
    await page.evaluate(async (invoice) => {
      await navigator.clipboard.writeText(invoice);
      const paste = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Paste') as HTMLButtonElement | undefined;
      paste?.click();
    }, bolt11);
    const payerInput = page.locator('input[placeholder="Paste BOLT11"]').first();
    await expect(payerInput).toHaveValue(bolt11, { timeout: 10_000 });
    await payWithTestPayer(page);
    await expect(page.locator('#tip-container')).toContainText(/Payment confirmed|Paid ✓/i, { timeout: 30_000 });

    // Pay-to-unlock -> invoice -> pay -> unlocked content.
    // Regression: this layout used to overflow into the sidebar at some mid-width viewports.
    await page.setViewportSize({ width: 1514, height: 900 });
    const measurePaywallOverflow = async () =>
      await page.evaluate(() => {
        const paywall = document.querySelector('.nostrstack-paywall') as HTMLElement | null;
        const card = paywall?.closest('section') as HTMLElement | null;
        if (!paywall || !card) return null;
        const cardRect = card.getBoundingClientRect();
        let maxDelta = 0;
        let offender: { tag: string; cls: string; text: string; delta: number } | null = null;
        for (const el of Array.from(card.querySelectorAll('*'))) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const delta = rect.right - cardRect.right;
          if (delta > maxDelta + 0.5) {
            maxDelta = delta;
            offender = {
              tag: (el as HTMLElement).tagName.toLowerCase(),
              cls: String((el as HTMLElement).className || ''),
              text: ((el as HTMLElement).textContent || '').trim().slice(0, 60),
              delta
            };
          }
        }
        return { maxDelta, offender };
      });
    const overflowLocked = await measurePaywallOverflow();
    expect(overflowLocked).not.toBeNull();
    expect(overflowLocked!.maxDelta).toBeLessThanOrEqual(1);

    await page.getByTestId('paywall-unlock').click();
    const invoiceCode = page.locator('.nostrstack-paywall__invoice').first();
    await expect(invoiceCode).toBeVisible({ timeout: 30_000 });
    const overflowPending = await measurePaywallOverflow();
    expect(overflowPending).not.toBeNull();
    expect(overflowPending!.maxDelta).toBeLessThanOrEqual(1);
    const bolt11Unlock = (await invoiceCode.getAttribute('title'))?.trim() ?? '';
    expect(bolt11Unlock).toMatch(/^ln/i);
    await page.evaluate(async (invoice) => {
      await navigator.clipboard.writeText(invoice);
      const paste = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Paste') as HTMLButtonElement | undefined;
      paste?.click();
    }, bolt11Unlock);
    await expect(payerInput).toHaveValue(bolt11Unlock, { timeout: 10_000 });
    await payWithTestPayer(page);
    await expect(page.getByTestId('unlock-status')).toContainText(/Unlocked/i, { timeout: 30_000 });

    // Request real invoice (API /api/pay) -> recheck status -> pay.
    const dialog = page.getByRole('dialog');
    const requestReal = page.getByRole('button', { name: /Request real invoice/i }).first();
    await requestReal.click();
    await expect(dialog).toContainText('6 sats', { timeout: 30_000 });
    await expect(page.getByTestId('real-invoice')).toContainText('lnbcrt', { timeout: 30_000 });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Copy invoice' }).click();
    await expect(page.getByTestId('toast-region')).toContainText('Copied invoice');
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(page.getByTestId('toast-region')).toContainText('Copied');
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
    await payWithTestPayer(page);
    await expect(dialog).toContainText(/Paid|Payment confirmed/i, { timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Close invoice' }).click();

    // Logs: SSE + controls.
    await page.getByRole('tab', { name: 'Logs' }).click();
    await expect(page.getByText('Backend stream', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reconnect' }).click();
    await page.getByLabel('Filter logs').fill('wallet');
    await page.getByText(/Capture frontend console/i).click();
    await page.getByRole('button', { name: 'Clear' }).first().click();
    await page.getByRole('button', { name: 'Clear' }).nth(1).click();
    await page.getByText(/Frontend capture on/i).click();

    // Status & build + telemetry controls.
    await page.getByRole('tab', { name: 'Lightning' }).click();
    const statusHeading = page.getByRole('heading', { name: 'Status & build' }).first();
    await statusHeading.scrollIntoViewIfNeeded();
    await expect(statusHeading).toBeVisible({ timeout: 30_000 });
    const telemetryHeading = page.getByRole('heading', { name: 'Telemetry' }).first();
    await telemetryHeading.scrollIntoViewIfNeeded();
    await expect(telemetryHeading).toBeVisible({ timeout: 30_000 });
    const wsOverride = page.getByPlaceholder('ws://localhost:4173/api/ws/telemetry').first();
    await wsOverride.fill('');
    await wsOverride.blur();
    await page.getByRole('button', { name: 'Reset WS' }).click();
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
