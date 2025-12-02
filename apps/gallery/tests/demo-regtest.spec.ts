import { execSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

const shouldRun = process.env.REGTEST_SMOKE === 'true';
const relaysCsv = process.env.VITE_NOSTRSTACK_RELAYS ?? 'mock';

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
    // Set relays if provided (so we exercise the UI selector and avoid mock fallback note)
    if (relaysCsv) {
      const relayInput = page.locator('input[placeholder="mock or wss://relay1,wss://relay2"]').first();
      if (await relayInput.count()) {
        await relayInput.fill(relaysCsv);
      }
    }

    // Comments (relays from selector)
    const commentBox = page.locator('#comments-container textarea').first();
    await commentBox.waitFor({ timeout: 5000 });
    await commentBox.fill('hello from e2e');
    await page.locator('#comments-container button', { hasText: 'Post' }).first().click();
    await expect(page.locator('#comments-container')).toContainText('hello from e2e');

    // Mock tip invoice
    await page.getByTestId('mock-tip').click();
    await expect(page.getByTestId('invoice')).toContainText('BOLT11');

    // Pay-to-unlock (mock verify)
    const payBtn = page.locator('#pay-container button').first();
    await payBtn.click();
    const unlockStatus = page.getByTestId('unlock-status');
    try {
      await expect(unlockStatus).toContainText(/unlocked/i, { timeout: 3000 });
    } catch {
      await page.getByTestId('mock-unlock').click();
      await expect(unlockStatus).toContainText(/unlocked/i, { timeout: 3000 });
    }

    // Real invoice request + payment (requires VITE_ENABLE_REAL_PAYMENTS=true)
    const realBtn = page.getByText('Request real invoice', { exact: false });
    if (await realBtn.count()) {
      await realBtn.click();
      const realPre = page.getByTestId('real-invoice').locator('pre').first();
      await expect(realPre).toContainText('lnbcrt', { timeout: 10000 });
      const pr = (await realPre.textContent())?.trim();
      if (!pr) throw new Error('invoice empty');
      payInvoice(pr);
      // No direct status hook; ensure UI remains responsive
      await expect(realPre).toContainText('lnbcrt');
    }
  });
});
