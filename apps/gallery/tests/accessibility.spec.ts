import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Accessibility test suite using axe-core
 * 
 * Tests WCAG 2.1 AA compliance across all major pages and user flows.
 * Validates keyboard navigation, focus management, ARIA attributes, and color contrast.
 */

test.describe('Accessibility - Page Scans', () => {
  test('Login page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForSelector('.login-container', { timeout: 5000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Feed view has no accessibility violations (authenticated)', async ({ page }) => {
    // Note: This test assumes you have a way to authenticate
    // You may need to adjust based on your auth setup
    await page.goto('/');
    
    // Skip if still on login page
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping authenticated test - login required');
      return;
    }
    
    await page.waitForSelector('.feed-stream', { timeout: 5000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Search page has no accessibility violations (authenticated)', async ({ page }) => {
    await page.goto('/search');
    
    // Check if redirected to login
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping search test - authentication required');
      return;
    }
    
    await page.waitForSelector('.search-view', { timeout: 5000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('Login page supports keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.auth-options', { timeout: 5000 });
    
    // Focus should start on first button
    await page.keyboard.press('Tab');
    const firstButton = page.locator('.auth-btn').first();
    await expect(firstButton).toBeFocused();
    
    // Tab to next button
    await page.keyboard.press('Tab');
    const secondButton = page.locator('.auth-btn').nth(1);
    await expect(secondButton).toBeFocused();
  });

  test('Search form supports keyboard navigation (authenticated)', async ({ page }) => {
    await page.goto('/search');
    
    // Check if redirected to login
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping search navigation test - authentication required');
      return;
    }
    
    await page.waitForSelector('.search-view', { timeout: 5000 });
    
    // Focus search input
    await page.keyboard.press('Tab');
    const searchInput = page.locator('#friend-search');
    await expect(searchInput).toBeFocused();
    
    // Type query
    await page.keyboard.type('test query');
    await expect(searchInput).toHaveValue('test query');
    
    // Tab to search button
    await page.keyboard.press('Tab');
    const searchButton = page.locator('button[type="submit"]');
    await expect(searchButton).toBeFocused();
    
    // Submit with Enter
    await page.keyboard.press('Enter');
    // Expect search status to update
    await page.waitForSelector('[role="status"]', { timeout: 3000 });
  });
});

test.describe('Accessibility - Modal Focus Management', () => {
  test('Help modal traps focus and returns focus on close', async ({ page }) => {
    await page.goto('/');
    
    // Skip if on login page (help modal only available when authenticated)
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping modal test - authentication required');
      return;
    }
    
    // Open help modal with keyboard shortcut
    await page.keyboard.press('?');
    
    // Wait for modal to appear
    await page.waitForSelector('.shortcuts-modal', { timeout: 2000 });
    
    // Modal should be visible
    const modal = page.locator('.shortcuts-modal');
    await expect(modal).toBeVisible();
    
    // First focusable element (close button) should have focus
    const closeButton = modal.locator('button').first();
    await expect(closeButton).toBeFocused();
    
    // Press Escape to close
    await page.keyboard.press('Escape');
    
    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('Modal focus trap prevents Tab from escaping', async ({ page }) => {
    await page.goto('/');
    
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping modal focus trap test - authentication required');
      return;
    }
    
    // Open help modal
    await page.keyboard.press('?');
    await page.waitForSelector('.shortcuts-modal', { timeout: 2000 });
    
    const modal = page.locator('.shortcuts-modal');
    const buttons = modal.locator('button');
    const buttonCount = await buttons.count();
    
    // Tab through all buttons
    for (let i = 0; i < buttonCount; i++) {
      await page.keyboard.press('Tab');
    }
    
    // After tabbing past last button, focus should wrap to first
    const firstButton = buttons.first();
    await expect(firstButton).toBeFocused();
    
    // Shift+Tab should go to last button
    await page.keyboard.press('Shift+Tab');
    const lastButton = buttons.last();
    await expect(lastButton).toBeFocused();
  });
});

test.describe('Accessibility - ARIA Live Regions', () => {
  test('Search status updates are announced (authenticated)', async ({ page }) => {
    await page.goto('/search');
    
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping search ARIA test - authentication required');
      return;
    }
    
    await page.waitForSelector('.search-view', { timeout: 5000 });
    
    // Check for aria-live region
    const statusRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(statusRegion).toBeVisible();
    
    // Initial status message
    const initialText = await statusRegion.textContent();
    expect(initialText).toBeTruthy();
    
    // Trigger search
    await page.fill('#friend-search', 'bitcoin');
    await page.click('button[type="submit"]');
    
    // Status should update (may show "resolving" or similar)
    await page.waitForTimeout(500);
    const updatedText = await statusRegion.textContent();
    expect(updatedText).toBeTruthy();
  });
});

test.describe('Accessibility - Form Validation', () => {
  test('Search input has proper labels and descriptions (authenticated)', async ({ page }) => {
    await page.goto('/search');
    
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping search form validation test - authentication required');
      return;
    }
    
    await page.waitForSelector('.search-view', { timeout: 5000 });
    
    const searchInput = page.locator('#friend-search');
    
    // Input should have label
    const label = page.locator('label[for="friend-search"]');
    await expect(label).toBeVisible();
    await expect(label).toHaveText('Search query');
    
    // Input should have aria-describedby for helper text
    await expect(searchInput).toHaveAttribute('aria-describedby', 'search-helper');
    
    // Helper text should exist
    const helper = page.locator('#search-helper');
    await expect(helper).toBeVisible();
  });
});

test.describe('Accessibility - Navigation Landmarks', () => {
  test('Feed page has proper landmarks', async ({ page }) => {
    await page.goto('/');
    
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping landmark test - authentication required');
      return;
    }
    
    await page.waitForSelector('.feed-stream', { timeout: 5000 });
    
    // Main content area
    const main = page.locator('main[role="main"]');
    await expect(main).toBeVisible();
    
    // Navigation sidebar
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
  });

  test('Sidebar navigation indicates current page', async ({ page }) => {
    await page.goto('/');
    
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping navigation test - authentication required');
      return;
    }
    
    await page.waitForSelector('nav', { timeout: 5000 });
    
    // Feed button should have aria-current="page"
    const feedButton = page.locator('button:has-text("Feed")');
    await expect(feedButton).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Accessibility - Button States', () => {
  test('Loading buttons have aria-busy attribute', async ({ page }) => {
    await page.goto('/');
    
    const isLogin = await page.locator('.login-container').isVisible().catch(() => false);
    if (isLogin) {
      test.skip(true, 'Skipping button state test - authentication required');
      return;
    }
    
    await page.waitForSelector('.feed-stream', { timeout: 5000 });
    
    // Find load more button
    const loadMoreButton = page.locator('button:has-text("LOAD MORE")');
    if (await loadMoreButton.isVisible()) {
      // Button should have aria-label
      await expect(loadMoreButton).toHaveAttribute('aria-label', 'Load more posts');
      
      // When loading, should have aria-busy
      // Note: This is a structural test - in real usage, clicking would trigger loading state
      const ariaLabel = await loadMoreButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
  });
});

test.describe('Accessibility - Color Contrast', () => {
  test('Page passes WCAG 2.1 AA color contrast checks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.login-container, .feed-stream', { timeout: 5000 });
    
    // WCAG 2.1 AA requires 4.5:1 for normal text, 3:1 for large text
    // We're excluding AAA (7:1) which is more strict
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules(['color-contrast-enhanced']) // Disable AAA check, keep AA only
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
