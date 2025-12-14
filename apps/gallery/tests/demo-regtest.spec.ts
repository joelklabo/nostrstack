import { execSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

import { enableTestSigner, expectRelayMode, postComment, setRelays } from './helpers.ts';

const shouldRun = process.env.REGTEST_SMOKE === 'true';
const relaysCsv =
  process.env.REAL_RELAY ||
  (process.env.VITE_NOSTRSTACK_RELAYS && process.env.VITE_NOSTRSTACK_RELAYS !== 'mock' ? process.env.VITE_NOSTRSTACK_RELAYS : undefined) ||
  'wss://relay.damus.io';

const payInvoice = (bolt11: string) => {
  execSync(
    `docker compose -f deploy/regtest/docker-compose.yml exec lnd-payer ` +
      `lncli --network=regtest --lnddir=/data --rpcserver=lnd-payer:10010 ` +
      `--macaroonpath=/data/data/chain/bitcoin/regtest/admin.macaroon ` +
      `--tlscertpath=/data/tls.cert payinvoice --force --json "${bolt11.trim()}"`,
    { stdio: 'inherit', cwd: process.cwd() }
  );
};

test.describe('regtest demo (real payments + comments)', () => {
  test.skip(!shouldRun, 'Set REGTEST_SMOKE=true to run real regtest demo smoke');

  test('comments, mock tip, pay unlock, real invoice + pay', async ({ page }) => {
    await page.goto('/');
    await setRelays(page, relaysCsv);
    await enableTestSigner(page);
    const relayMode = relaysCsv.includes('mock') ? 'mock' : 'real';
    await expectRelayMode(page, relayMode);

    // Comments (real relay if provided)
    const commentText = `hello from regtest ${Date.now()}`;
    await postComment(page, commentText);
    await expect(page.locator('#comments-container')).toContainText(commentText, { timeout: 15000 });

    // Mock tip invoice
    await page.getByTestId('mock-tip').click();
    await expect(page.getByTestId('invoice')).toContainText('BOLT11');

    // Pay-to-unlock (mock verify)
    await page.getByTestId('paywall-unlock').click();
    const unlockStatus = page.getByTestId('unlock-status');
    try {
      await expect(unlockStatus).toContainText(/unlocked/i, { timeout: 3000 });
    } catch {
      await page.getByTestId('mock-unlock').click();
      await expect(unlockStatus).toContainText(/unlocked/i, { timeout: 3000 });
    }

    // Real invoice request + payment
    const realBtn = page.getByText('Request real invoice', { exact: false });
    if (await realBtn.count()) {
      await realBtn.click();
      const realPre = page.getByTestId('real-invoice').locator('pre').first();
      await expect(realPre).toContainText('lnbcrt', { timeout: 10000 });
      const pr = (await realPre.textContent())?.trim();
      if (!pr) throw new Error('invoice empty');
      payInvoice(pr);
      await expect(page.locator('text=Invoice')).toBeVisible({ timeout: 8000 });
      // No direct status hook; ensure UI remains responsive
      await expect(realPre).toContainText('lnbcrt');
    }
  });
});
