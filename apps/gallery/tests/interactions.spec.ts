import { expect, test } from '@playwright/test';

import { loginWithNsec } from './helpers';

const testNsec = process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

test.describe('App Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithNsec(page, testNsec);
  });

  test('sidebar navigation switches views', async ({ page }) => {
    const nav = page.getByRole('navigation');

    // Default is Feed
    await expect(page.getByRole('heading', { name: 'Live Feed' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Feed' })).toHaveClass(/active/);

    // Search
    await nav.getByRole('button', { name: 'Find friend' }).click();
    await expect(page.getByRole('heading', { name: 'Find friend' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Find friend' })).toHaveClass(/active/);

    // Notifications
    await nav.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText('INCOMING_TRANSMISSIONS')).toBeVisible();

    // Settings
    await nav.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'SYSTEM_SETTINGS' })).toBeVisible();
    
    // Back to Feed
    await nav.getByRole('button', { name: 'Feed' }).click();
    await expect(page.getByRole('heading', { name: 'Live Feed' })).toBeVisible();
  });

  test('toggle view source in feed', async ({ page }) => {
    // We expect at least one post if using mock relays or if real relays have data.
    // If not, we can publish one?
    // Let's publish a note first to ensure there is something.
    const editor = page.getByPlaceholder('WHAT ARE YOU HACKING ON?...');
    await editor.fill('Testing interactions');
    await page.getByText('PUBLISH_EVENT').click();
    await expect(page.getByText('SUCCESS: Event published to relays.')).toBeVisible({ timeout: 10000 });

    const postCard = page.locator('.post-card').first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    const viewSourceBtn = postCard.getByRole('button', { name: 'View Source' });
    await viewSourceBtn.click();
    
    // Should show JSON view
    await expect(page.locator('.nostrstack-json')).toBeVisible();
    await expect(postCard.getByRole('button', { name: 'Hide Source' })).toBeVisible();
    
    // Hide it
    await postCard.getByRole('button', { name: 'Hide Source' }).click();
    await expect(page.locator('.nostrstack-json')).toBeHidden();
  });
});
