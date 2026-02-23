import { expect, test } from '@playwright/test';

import { enableTestSigner, expectRelayMode, postComment, setRelays } from './helpers.ts';

const RELAY = process.env.REAL_RELAY ?? 'wss://relay.damus.io';
const shouldRun = process.env.RUN_REAL_RELAY === 'true';

// Opt-in: run with RUN_REAL_RELAY=true REAL_RELAY=wss://relay.damus.io pnpm --filter web exec playwright test tests/comment-relay.spec.ts
test.describe('real relay comment', () => {
  test.skip(!shouldRun, 'Set RUN_REAL_RELAY=true to exercise real relay comment');

  test('posts with built-in signer enabled', async ({ page }) => {
    await page.goto('/');
    await enableTestSigner(page);
    await setRelays(page, RELAY);
    await expectRelayMode(page, 'real');

    const msg = `playwright real relay ${Date.now()}`;
    await postComment(page, msg);
    await expect(page.locator('#comments-container')).toContainText(msg, { timeout: 15000 });
  });
});
