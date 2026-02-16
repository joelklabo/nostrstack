import { expect, test } from '@playwright/test';

import { clickWithDispatchFallback, loginWithNsec, waitForFeedSurface } from './helpers';

const testNsec =
  process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

test.describe('App Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithNsec(page, testNsec);
  });

  test('sidebar navigation switches views', async ({ page }) => {
    const nav = page.getByRole('navigation');

    // Default is Feed
    await waitForFeedSurface(page);
    await expect(nav.getByRole('button', { name: 'Feed' })).toHaveClass(/active/);

    // Search
    await nav.getByRole('button', { name: 'Find friend' }).click();
    await expect(nav.getByRole('button', { name: 'Find friend' })).toHaveClass(/active/);

    // Profile
    await nav.getByRole('button', { name: 'Profile' }).click();
    await expect(page.locator('.profile-view')).toBeVisible();

    // Settings
    await nav.getByRole('button', { name: 'Settings' }).click();
    await expect(nav.getByRole('button', { name: 'Settings' })).toHaveClass(/active/);

    // Back to Feed
    await nav.getByRole('button', { name: 'Feed' }).click();
    await waitForFeedSurface(page);
  });

  test('toggle view source in feed', async ({ page }) => {
    // We expect at least one post if using mock relays or if real relays have data.
    // If not, we can publish one?
    // Let's publish a note first to ensure there is something.
    const editor = page.getByPlaceholder('Share something with the network...');
    await editor.fill('Testing interactions');
    await page.getByText('Publish').click();
    await expect(page.getByText('Success: Event published to relays.')).toBeVisible({
      timeout: 10000
    });

    const postCard = page.locator('[data-testid="social-event-card"]').first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    const viewSourceBtn = postCard.getByRole('button', { name: /View event source JSON/i });
    await clickWithDispatchFallback(viewSourceBtn, { timeout: 8000 });

    // Should show JSON view
    const sourceView = postCard.locator('[data-testid="social-event-json"]');
    await expect(sourceView).toBeVisible();
    const hideSourceBtn = postCard.getByRole('button', { name: /Hide event source JSON/i });
    await expect(hideSourceBtn).toBeVisible();

    // Hide it
    await clickWithDispatchFallback(hideSourceBtn, { timeout: 8000 });
    await expect(sourceView).toBeHidden();
  });

  test('settings route is directly reachable', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Settings' })).toHaveClass(/active/);
    await expect(page.getByRole('heading', { name: 'System Settings' })).toBeVisible();
  });

  test('search route is directly reachable', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('button', { name: 'Find friend' })).toHaveClass(/active/);
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible();
    await expect(page.getByRole('search')).toBeVisible();

    await page.getByRole('navigation').getByRole('button', { name: 'Feed' }).click();
    await waitForFeedSurface(page);
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveClass(/active/);
  });

  test('view state resets when leaving non-home routes', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('button', { name: 'Find friend' })).toHaveClass(/active/);

    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Settings' })).toHaveClass(/active/);

    await page.goto('/');
    await waitForFeedSurface(page);
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveClass(/active/);
  });
});
