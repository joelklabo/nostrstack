import { expect, test } from '@playwright/test';

import { loginWithNsec, TEST_NSEC } from './helpers.ts';

const waitForAnimationFrame = (page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

const liveFeedHeading = (page) => page.getByRole('heading', { name: /Live Feed/ });
const feedCards = (page) => page.getByTestId('social-event-card');
const feedSkeletons = (page) => page.locator('[class*="skeleton"]');

/**
 * Regression tests for GitHub issues:
 * - #1: Onboarding layout broken (z-index issues)
 * - #2: Feed flickering (constant re-renders)
 */

test.describe('Issue #2: Feed Stability', () => {
  test('feed does not flicker during initial load', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('nostrstack.onboarding.v1');
    });

    await loginWithNsec(page, TEST_NSEC);

    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    const heading = liveFeedHeading(page);
    const cards = feedCards(page);
    const skeletons = feedSkeletons(page);
    const noPostsYet = page.getByText('No posts yet');
    const feedStream = page.locator('.feed-stream');

    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => (await cards.count()) + (await skeletons.count()), {
        timeout: 10000,
        intervals: [100]
      })
      .toBeGreaterThan(0);

    let emptyStateCount = 0;
    let hasLoadedContent = false;

    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
      await expect(feedStream).toBeVisible();

      const postCount = await cards.count();
      const skeletonCount = await skeletons.count();
      const noPostsVisible = await noPostsYet.isVisible().catch(() => false);

      if (postCount > 0 || skeletonCount > 0) {
        hasLoadedContent = true;
      }

      if (hasLoadedContent && noPostsVisible) {
        emptyStateCount++;
      }

      await waitForAnimationFrame(page);
    }

    expect(emptyStateCount).toBe(0);
  });

  test('feed maintains content during filter changes', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    const skipBtn = page.getByRole('button', { name: 'Skip' });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
    }

    const heading = liveFeedHeading(page);
    const cards = feedCards(page);
    const skeletons = feedSkeletons(page);
    const feedStream = page.locator('.feed-stream');
    const visibleFeed = cards.or(skeletons);
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(visibleFeed).toBeVisible({ timeout: 8000 });

    const spamFilterBtn = page.getByTitle('Toggle Spam Filter');
    if (await spamFilterBtn.isVisible().catch(() => false)) {
      const feedStreamBefore = await feedStream.innerHTML();

      await spamFilterBtn.click();
      await expect(feedCards(page).or(skeletons).first()).toBeVisible({ timeout: 5000 });

      const feedStreamAfter = await feedStream.innerHTML();
      expect(feedStreamBefore.length).toBeGreaterThan(0);
      expect(feedStreamAfter.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Issue #1: Onboarding Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('nostrstack.onboarding.v1');
    });
  });

  test('onboarding tour renders above all other elements', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    const onboardingCard = page.locator('.onboarding-card, [data-testid="onboarding-card"]');
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    const cardBoundingBox = await onboardingCard.boundingBox();
    expect(cardBoundingBox).not.toBeNull();
    expect(cardBoundingBox!.width).toBeGreaterThan(0);
    expect(cardBoundingBox!.height).toBeGreaterThan(0);

    const cardZIndex = await onboardingCard.evaluate((el) => getComputedStyle(el).zIndex);
    expect(Number(cardZIndex)).toBeGreaterThanOrEqual(100000);

    const overlay = page.locator('.onboarding-overlay, [data-testid="onboarding-overlay"]');
    const spotlight = page.locator('.onboarding-spotlight, [data-testid="onboarding-spotlight"]');
    const overlayVisible = await overlay.isVisible().catch(() => false);
    const spotlightVisible = await spotlight.isVisible().catch(() => false);
    expect(overlayVisible || spotlightVisible).toBe(true);

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

    const onboardingCard = page.locator('.onboarding-card, [data-testid="onboarding-card"]');
    const onboardingTitle = page.locator('#tour-title, [data-testid="onboarding-title"]');
    const nextBtn = page.getByRole('button', { name: /Next|Go to next step/i });
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    const initialTitle = await onboardingTitle.textContent();

    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    const nextTitle = await onboardingTitle.textContent();
    expect(nextTitle).not.toBe(initialTitle);

    const skipBtn = page.getByRole('button', { name: /Skip tour|Skip/ });
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();

    await expect(onboardingCard).not.toBeVisible({ timeout: 3000 });
  });

  test('onboarding spotlight highlights correct elements', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    const onboardingCard = page.locator('.onboarding-card, [data-testid="onboarding-card"]');
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    const nextBtn = page.getByRole('button', { name: /Next|Go to next step/i });
    const currentTitle = await page
      .locator('#tour-title, [data-testid="onboarding-title"]')
      .textContent();
    await nextBtn.click();

    const changedTitle = page.locator('#tour-title, [data-testid="onboarding-title"]');
    await expect(changedTitle).not.toHaveText(currentTitle ?? '');

    const spotlight = page.locator('.onboarding-spotlight, [data-testid="onboarding-spotlight"]');
    const spotlightVisible = await spotlight.isVisible().catch(() => false);

    if (spotlightVisible) {
      const spotlightBox = await spotlight.boundingBox();
      expect(spotlightBox).not.toBeNull();
      expect(spotlightBox!.width).toBeGreaterThan(0);
      expect(spotlightBox!.height).toBeGreaterThan(0);
      expect(spotlightBox!.x).toBeGreaterThanOrEqual(0);
      expect(spotlightBox!.y).toBeGreaterThanOrEqual(0);
    }
  });

  test('onboarding does not break when target element is missing', async ({ page }) => {
    await loginWithNsec(page, TEST_NSEC);

    const onboardingCard = page.locator('.onboarding-card, [data-testid="onboarding-card"]');
    const onboardingTitle = page.locator('#tour-title, [data-testid="onboarding-title"]');
    const nextBtn = page.getByRole('button', { name: /Next|Go to next step|Finish/i });
    await expect(onboardingCard).toBeVisible({ timeout: 5000 });

    let steps = 0;
    const maxSteps = 10;

    while (steps < maxSteps) {
      const isLastStep = (await nextBtn.getAttribute('aria-label')) === 'Finish tour';
      const stepTitle = await onboardingTitle.textContent();
      await nextBtn.click();

      if (isLastStep) break;
      steps++;

      await expect(onboardingTitle).not.toHaveText(stepTitle ?? '', { timeout: 5000 });
      await expect(onboardingCard).toBeVisible();
    }

    await expect(onboardingCard).not.toBeVisible({ timeout: 3000 });
  });
});
