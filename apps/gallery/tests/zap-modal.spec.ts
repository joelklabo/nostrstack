import { expect, test } from '@playwright/test';
import * as fs from 'fs';

import { buildNostrEventResponse, loginWithNsec, mockNostrEventApi, seedMockEvent } from './helpers';

test('Zap Modal flow', async ({ page }) => {
  // Ensure the mock relay is installed by waiting for window.nostr
  // await page.waitForFunction(() => (window as any).nostr);

  // 1. Login
  await loginWithNsec(page);

  // Mock the API response for the event we're about to seed
  const mockEventId = 'mock-event-1';
  await mockNostrEventApi(page, {
    [mockEventId]: buildNostrEventResponse({ id: mockEventId, content: 'Hello Nostr! This is a mock post from Alice.' })
  });

  // Seed a mock event to the page
  await seedMockEvent(page, { id: mockEventId, content: 'Hello Nostr! This is a mock post from Alice.' });
  
  // Wait for the seeded post to appear
  try {
    await expect(page.getByText('Hello Nostr! This is a mock post from Alice.')).toBeVisible({ timeout: 15000 });
  } catch (e) {
    console.error('Test failed: Post not visible. Dumping page content and logs.');
    await page.screenshot({ path: 'test-results/post-not-visible-failure.png', fullPage: true });
    const content = await page.content();
    fs.writeFileSync('test-results/post-not-visible-failure.html', content);
    const logs = await page.evaluate(() => (window as unknown as { VITE_PLAYWRIGHT_LOGS?: string[] }).VITE_PLAYWRIGHT_LOGS || []);
    fs.writeFileSync('test-results/post-not-visible-failure-console.log', logs.join('\n'));
    throw e;
  }
  
  // 2. Find a Zap button
  // Use locator with aria-label to match exact implementation
  const zapButton = page.locator(`[aria-label="Zap Hello Nostr! This is a mock post from Alice."`).first();
  await expect(zapButton).toBeVisible();

  // 3. Click the Zap button to open the modal
  await zapButton.click();

  // 4. Verify the Zap Modal is open and shows the correct content
  const zapModal = page.locator('.zap-modal');
  await expect(zapModal).toBeVisible();
  await expect(zapModal.locator('h2')).toHaveText('ZAP');
  
  // Verify that the QR code is visible
  const qrCode = zapModal.locator('canvas');
  await expect(qrCode).toBeVisible();
  
  // 5. Simulate a successful Zap (mocking the onZap callback)
  // For this test, we'll just check that the input fields are present
  // and the 'Zap' button is enabled.
  const amountInput = zapModal.locator('input[type="number"]');
  await expect(amountInput).toBeVisible();
  
  const zapAction = zapModal.locator('button', { hasText: 'Zap' });
  await expect(zapAction).toBeEnabled();

  // 6. Close the modal
  await zapModal.locator('[aria-label="Close"]').click();
  await expect(zapModal).not.toBeVisible();
});
