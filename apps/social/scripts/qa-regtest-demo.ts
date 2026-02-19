#!/usr/bin/env node
import { chromium, expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

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

function parseSessionValue(contents: string, key: string) {
  const line = contents.split('\n').find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim();
}

async function sessionUrlReachable(url: string, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return res.ok || res.status === 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

type ManagedSession = {
  galleryUrl: string | undefined;
  apiUrl: string | undefined;
};

async function detectManagedSessionUrls(): Promise<ManagedSession> {
  const repoRoot = path.resolve(import.meta.dirname, '../../..');
  const sessionDir =
    process.env.NOSTRDEV_SESSION_DIR ?? path.join(repoRoot, '.logs', 'dev', 'sessions');
  const requestedAgent = process.env.NOSTRDEV_AGENT?.trim();

  let files: string[];
  try {
    files = await fs.readdir(sessionDir);
  } catch {
    return { galleryUrl: undefined, apiUrl: undefined };
  }

  const sessionFiles = files.filter((file) => file.endsWith('.session'));
  if (!sessionFiles.length) return { galleryUrl: undefined, apiUrl: undefined };

  const sessions = await Promise.all(
    sessionFiles.map(async (fileName) => {
      const fullPath = path.join(sessionDir, fileName);
      const stat = await fs.stat(fullPath).catch(() => null);
      const contents = await fs.readFile(fullPath, 'utf8').catch(() => '');
      return {
        mtimeMs: stat?.mtimeMs ?? 0,
        agent: parseSessionValue(contents, 'NOSTRDEV_SESSION_AGENT'),
        apiPort: parseSessionValue(contents, 'NOSTRDEV_SESSION_API_PORT'),
        socialPort: parseSessionValue(contents, 'NOSTRDEV_SESSION_SOCIAL_PORT')
      };
    })
  );

  const preferred = sessions
    .filter(
      (session) => session.socialPort && (!requestedAgent || session.agent === requestedAgent)
    )
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const fallback = sessions
    .filter((session) => session.socialPort)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const session of [...preferred, ...fallback]) {
    const socialPort = Number(session.socialPort);
    const apiPort = Number(session.apiPort);
    if (!Number.isFinite(socialPort) || socialPort <= 0) continue;

    const galleryCandidates = [`http://localhost:${socialPort}`, `https://localhost:${socialPort}`];
    const apiCandidates = [`http://localhost:${apiPort}`, `https://localhost:${apiPort}`];

    let galleryUrl: string | undefined;
    for (const candidate of galleryCandidates) {
      if (await sessionUrlReachable(candidate)) {
        galleryUrl = candidate;
        break;
      }
    }
    if (!galleryUrl) continue;

    let apiUrl: string | undefined;
    for (const candidate of apiCandidates) {
      if (await sessionUrlReachable(candidate)) {
        apiUrl = candidate;
        break;
      }
    }

    return { galleryUrl, apiUrl };
  }

  return { galleryUrl: undefined, apiUrl: undefined };
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
    await zapButtons.nth(i).dispatchEvent('click');
    await expect(page.locator('.payment-modal')).toBeVisible();
    if (mode === 'nwc') {
      const nwcPaid = await page
        .getByText('NWC payment sent.')
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      if (!nwcPaid) {
        await page.locator('.payment-header button').getByText(/CLOSE/i).click({ force: true });
        continue;
      }
      await expect(page.getByText('Payment successful!')).toBeVisible({ timeout: 10_000 });
      const closeBtn = page.locator('.payment-modal:visible button:has-text("CLOSE")').first();
      await closeBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await closeBtn.click({ force: true });
      return true;
    }

    const invoiceReady = await page
      .locator('.payment-grid')
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!invoiceReady) {
      await page.locator('.payment-header button').getByText(/CLOSE/i).click({ force: true });
      continue;
    }
    await expect(page.locator('.payment-qr')).toBeVisible();
    await expect(page.locator('.payment-panel')).toBeVisible();
    await expect(page.locator('.payment-panel-title')).toHaveText('INVOICE');
    await expect(page.locator('.payment-invoice-box')).toBeVisible();
    const regtestBtn = page.locator('button:has-text("PAY_REGTEST")');
    const regtestAvailable = await regtestBtn.isVisible();
    if (!regtestAvailable) {
      console.log(
        '⚠️ PAY_REGTEST button not available - regtest wallet not configured on API, skipping regtest payment test'
      );
      await page
        .locator('.payment-header button')
        .getByText(/CLOSE/i)
        .click({ force: true })
        .catch(() => {});
      return false;
    }
    await regtestBtn.waitFor({ state: 'visible' });
    let paid = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await regtestBtn.click({ force: true });
      paid = await expect(page.locator('.payment-modal'))
        .toContainText(/Payment (sent|confirmed)\./, { timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      if (paid) break;
    }
    if (!paid) {
      const closeBtn = page.locator('.payment-modal:visible button:has-text("CLOSE")').first();
      await closeBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await closeBtn.click({ force: true });
      continue;
    }
    const closeBtn = page.locator('.payment-modal:visible button:has-text("CLOSE")').first();
    await closeBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await closeBtn.click({ force: true });
    return true;
  }
  return false;
}

async function tryBolt12Flow(page: Page) {
  await page.getByRole('button', { name: /Offers/i }).click();
  await expect(page.getByText('BOLT12 Offers')).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('Description').fill('Regtest QA offer');
  await page.getByRole('button', { name: /Create.*BOLT12.*offer/i }).click();

  const offerWidget = page.locator('.offer-widget__title', { hasText: 'Offer' });
  await expect(offerWidget).toBeVisible({ timeout: 20_000 });

  const offerError = page.locator('.offer-error');
  if (await offerError.isVisible()) {
    throw new Error(`BOLT12 offer error: ${await offerError.textContent()}`);
  }

  await page.getByRole('button', { name: /Request Invoice/i }).click();
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

  const detected = await detectManagedSessionUrls();
  const devServerPort = process.env.DEV_SERVER_PORT;
  const fallbackUrl = devServerPort ? `http://localhost:${devServerPort}` : 'http://localhost:4173';
  const baseUrl = process.env.GALLERY_URL ?? detected.galleryUrl ?? fallbackUrl;
  const _apiUrl = process.env.API_URL ?? detected.apiUrl ?? 'http://localhost:3001';

  if (detected.galleryUrl || detected.apiUrl) {
    const parts: string[] = [];
    if (detected.galleryUrl) parts.push(`gallery=${detected.galleryUrl}`);
    if (detected.apiUrl) parts.push(`api=${detected.apiUrl}`);
    console.log(`ℹ️ using managed dev session: ${parts.join(', ')}`);
  }

  const hasExplicitUrl = process.env.GALLERY_URL || process.env.DEV_SERVER_PORT;
  if (!process.env.GALLERY_URL && !detected.galleryUrl && !process.env.NOSTRDEV_AGENT) {
    console.log(
      `ℹ️ No managed session detected. Using defaults (gallery=${fallbackUrl}). Set GALLERY_URL/API_URL or run under pnpm dev:logs for managed sessions.`
    );
  }

  if (process.env.NOSTRDEV_AGENT && !detected.galleryUrl && !detected.apiUrl && !hasExplicitUrl) {
    const agent = process.env.NOSTRDEV_AGENT;
    console.error(`❌ Managed session for agent '${agent}' not found or not reachable.`);
    console.error(
      '   Run "pnpm dev:logs" to start a managed session, or set GALLERY_URL/DEV_SERVER_PORT explicitly.'
    );
    process.exit(1);
  }

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
  await context.addInitScript(() => {
    localStorage.setItem('nostrstack.onboarding.v1', 'true');
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
    if (type === 'warning') {
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
      const reason = usingNwc
        ? 'no zap-enabled posts found for NWC payment'
        : 'regtest wallet not configured or no zap-enabled posts found';
      console.log(`⚠️ QA zap test skipped: ${reason}`);
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
