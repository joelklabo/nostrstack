import { expect, test } from '@playwright/test';

import { loginWithNsec, TEST_NSEC } from './helpers.ts';

/**
 * Regression tests for GitHub issues:
 * - #1: Onboarding layout broken (z-index issues)
 * - #2: Feed flickering (constant re-renders)
 */

test.describe('Issue #2: Feed Stability', () => {
  test('feed does not flicker during initial load', async ({ page }) => {
    // Clear any stored onboarding state so we can test fresh
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('nostrstack.onboarding.v1');
    });

    await loginWithNsec(page, TEST_NSEC);

    // Skip onboarding if it appears
    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    // Wait for feed to be visible
    await expect(page.getByRole('heading', { name: 'Live Feed' })).toBeVisible({ timeout: 10000 });

    // Track state changes - the feed should not flash to empty state after loading
    let emptyStateCount = 0;
    let hasLoadedContent = false;

    // Monitor for 3 seconds to catch any flickering
    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
      const feedStream = page.locator('.feed-stream');
      await expect(feedStream).toBeVisible();

      // Check if we have actual content (posts or skeleton loaders)
      const postCards = page.locator('.post-card');
      const skeletons = page.locator('[class*="skeleton"]');
      const noPostsYet = page.getByText('No posts yet');

      const postCount = await postCards.count();
      const skeletonCount = await skeletons.count();
      const noPostsVisible = await noPostsYet.isVisible().catch(() => false);

      // If we see posts or skeletons, content is loading/loaded
      if (postCount > 0 || skeletonCount > 0) {
        hasLoadedContent = true;
      }

      // If we see "No posts yet" AFTER having loaded content, that's a flicker
      if (noPostsVisible && hasLoadedContent) {
        emptyStateCount++;
      }

      await page.waitForTimeout(100);
    }

    // Should never flicker back to empty state after showing content
    expect(emptyStateCount).toBe(0);
  });

  test('feed maintains content during filter changes', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    // Skip onboarding if it appears
    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    await expect(page.getByRole('heading', { name: 'Live Feed' })).toBeVisible({ timeout: 10000 });

    // Wait for initial feed to load
    await page.waitForTimeout(2000);

    // Toggle spam filter - this shouldn't cause complete re-render
    const spamFilterBtn = page.getByTitle('Toggle Spam Filter');
    if (await spamFilterBtn.isVisible().catch(() => false)) {
      const feedStreamBefore = await page.locator('.feed-stream').innerHTML();

      await spamFilterBtn.click();
      await page.waitForTimeout(500);

      // Feed stream should still exist and have content
      const feedStream = page.locator('.feed-stream');
      await expect(feedStream).toBeVisible();

      // Verify feed didn't completely empty and reload
      const feedStreamAfter = await feedStream.innerHTML();
      // If both are non-empty, we didn't have a flicker
      expect(feedStreamBefore.length).toBeGreaterThan(0);
      expect(feedStreamAfter.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Issue #1: Onboarding Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Clear onboarding state to force it to show
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('nostrstack.onboarding.v1');
    });
  });

  test('onboarding tour renders above all other elements', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    // Wait for onboarding to appear (auto-triggers after 1500ms)
    const onboardingCard = page.locator('.onboarding-card');
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    // Verify the card is properly visible and not obscured
    const cardBoundingBox = await onboardingCard.boundingBox();
    expect(cardBoundingBox).not.toBeNull();
    expect(cardBoundingBox!.width).toBeGreaterThan(0);
    expect(cardBoundingBox!.height).toBeGreaterThan(0);

    // Verify z-index is high enough (should be 100000)
    const cardZIndex = await onboardingCard.evaluate((el) => getComputedStyle(el).zIndex);
    expect(Number(cardZIndex)).toBeGreaterThanOrEqual(100000);

    // Verify overlay or spotlight is visible
    const overlay = page.locator('.onboarding-overlay');
    const spotlight = page.locator('.onboarding-spotlight');
    const overlayVisible = await overlay.isVisible().catch(() => false);
    const spotlightVisible = await spotlight.isVisible().catch(() => false);
    expect(overlayVisible || spotlightVisible).toBe(true);

    // Check overlay/spotlight z-index
    if (overlayVisible) {
      const overlayZIndex = await overlay.evaluate((el) => getComputedStyle(el).zIndex);
      expect(Number(overlayZIndex)).toBeGreaterThanOrEqual(99999);
    }
    if (spotlightVisible) {
      const spotlightZIndex = await spotlight.evaluate((el) => getComputedStyle(el).zIndex);
      expect(Number(spotlightZIndex)).toBeGreaterThanOrEqual(99998);
    }
  });

  test('onboarding tour buttons are clickable and functional', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    // Wait for onboarding to appear
    const onboardingCard = page.locator('.onboarding-card');
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    // Get initial title
    const initialTitle = await page.locator('.onboarding-title').textContent();

    // Click Next button
    const nextBtn = page.locator('.onboarding-btn-next');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Wait for step transition
    await page.waitForTimeout(500);

    // Verify we moved to the next step (title should change)
    const newTitle = await page.locator('.onboarding-title').textContent();
    expect(newTitle).not.toBe(initialTitle);

    // Test Skip button
    const skipBtn = page.locator('.onboarding-btn-skip');
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();

    // Onboarding should be dismissed
    await expect(onboardingCard).not.toBeVisible({ timeout: 2000 });
  });

  test('onboarding spotlight highlights correct elements', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    // Wait for onboarding to appear
    const onboardingCard = page.locator('.onboarding-card');
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    // Navigate to a step with a target (step 2+ has targets)
    const nextBtn = page.locator('.onboarding-btn-next');
    await nextBtn.click();
    await page.waitForTimeout(500);

    // After first "Next", we should be on step 2 which targets .sidebar-nav
    const spotlight = page.locator('.onboarding-spotlight');
    const spotlightVisible = await spotlight.isVisible().catch(() => false);

    if (spotlightVisible) {
      // Verify spotlight has proper dimensions (not 0x0)
      const spotlightBox = await spotlight.boundingBox();
      expect(spotlightBox).not.toBeNull();
      expect(spotlightBox!.width).toBeGreaterThan(0);
      expect(spotlightBox!.height).toBeGreaterThan(0);

      // Verify spotlight position is within viewport
      expect(spotlightBox!.x).toBeGreaterThanOrEqual(0);
      expect(spotlightBox!.y).toBeGreaterThanOrEqual(0);
    }
  });

  test('onboarding does not break when target element is missing', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    // Wait for onboarding
    const onboardingCard = page.locator('.onboarding-card');
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    // Navigate through all steps without errors
    const nextBtn = page.locator('.onboarding-btn-next');
    let steps = 0;
    const maxSteps = 10; // Safety limit

    while (steps < maxSteps) {
      const isLastStep = await nextBtn.textContent();
      if (isLastStep === 'Finish') {
        await nextBtn.click();
        break;
      }
      await nextBtn.click();
      await page.waitForTimeout(300);
      steps++;

      // Verify card is still visible after each step
      const cardStillVisible = await onboardingCard.isVisible().catch(() => false);
      if (!cardStillVisible) break;
    }

    // Tour should complete without errors
    await expect(onboardingCard).not.toBeVisible({ timeout: 2000 });
  });
});
