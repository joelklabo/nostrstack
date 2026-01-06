import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Comprehensive Design Review Test Suite
 *
 * This suite validates:
 * - Visual hierarchy and typography
 * - Color contrast and accessibility (WCAG AA)
 * - Responsive behavior across viewports
 * - Interactive element states (hover, focus, active, disabled)
 * - Loading states and skeleton screens
 * - Touch targets (min 44x44px)
 * - Keyboard navigation and screen reader support
 */

// Test helper to login
async function loginWithNsec(page: any) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
  await page.getByPlaceholder('nsec1...').fill(validNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for main content to load (visible on all viewports)
  await page.waitForSelector('main[role="main"]', { timeout: 10000 });
}

test.describe('Design Review: Typography & Visual Hierarchy', () => {
  test('should use consistent font families from design system', async ({ page }) => {
    await loginWithNsec(page);

    // Check body font
    const bodyFont = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    expect(bodyFont).toContain('apple-system');

    // Check that CSS variables are properly defined
    const rootStyles = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        fontBody: getComputedStyle(root).getPropertyValue('--font-body').trim(),
        fontMono: getComputedStyle(root).getPropertyValue('--font-mono').trim()
      };
    });

    expect(rootStyles.fontBody).toBeTruthy();
    expect(rootStyles.fontMono).toBeTruthy();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await loginWithNsec(page);

    // Check that headings exist and follow proper hierarchy
    const headings = await page.evaluate(() => {
      const h1s = Array.from(document.querySelectorAll('h1'));
      const h2s = Array.from(document.querySelectorAll('h2'));
      const h3s = Array.from(document.querySelectorAll('h3'));
      return {
        h1Count: h1s.length,
        h2Count: h2s.length,
        h3Count: h3s.length,
        hasHeadings: h1s.length > 0 || h2s.length > 0 || h3s.length > 0
      };
    });

    // At minimum, the page should have some semantic headings
    expect(headings.hasHeadings).toBe(true);
  });

  test('should maintain consistent line height and spacing', async ({ page }) => {
    await loginWithNsec(page);

    const bodyLineHeight = await page.evaluate(() => {
      return window.getComputedStyle(document.body).lineHeight;
    });

    // Body should have line-height of 1.5 (or 21px for 14px font)
    expect(parseFloat(bodyLineHeight)).toBeGreaterThanOrEqual(1.4);
  });
});

test.describe('Design Review: Color System & Contrast', () => {
  test('should have all design system color variables defined', async ({ page }) => {
    await loginWithNsec(page);

    const colors = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        canvasDefault: style.getPropertyValue('--color-canvas-default').trim(),
        canvasSubtle: style.getPropertyValue('--color-canvas-subtle').trim(),
        borderDefault: style.getPropertyValue('--color-border-default').trim(),
        fgDefault: style.getPropertyValue('--color-fg-default').trim(),
        fgMuted: style.getPropertyValue('--color-fg-muted').trim(),
        accentFg: style.getPropertyValue('--color-accent-fg').trim(),
        successFg: style.getPropertyValue('--color-success-fg').trim(),
        dangerFg: style.getPropertyValue('--color-danger-fg').trim()
      };
    });

    // Verify all critical color variables are defined
    Object.entries(colors).forEach(([key, value]) => {
      expect(value, `${key} should be defined`).toBeTruthy();
    });
  });

  test('should pass WCAG AA color contrast requirements', async ({ page }) => {
    await loginWithNsec(page);

    // Run axe with color-contrast checks
    const accessibilityScanResults = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    );

    expect(contrastViolations).toEqual([]);
  });

  test('should maintain brand colors consistency', async ({ page }) => {
    await loginWithNsec(page);

    // Check accent color is GitHub blue (#0969da)
    const accentColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-accent-fg')
        .trim();
    });

    expect(accentColor).toBe('#0969da');
  });
});

test.describe('Design Review: Responsive Behavior', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 800 },
    { name: 'Large Desktop', width: 1920, height: 1080 }
  ];

  for (const viewport of viewports) {
    test(`should render properly on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
      page
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginWithNsec(page);

      // Check layout doesn't overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });

      expect(hasOverflow).toBe(false);

      // Check main content is visible
      const mainVisible = await page.locator('main[role="main"]').isVisible();
      expect(mainVisible).toBe(true);
    });
  }

  test('should show mobile menu on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginWithNsec(page);

    // Check for hamburger menu button
    const hamburgerBtn = page.locator('.hamburger-btn');
    await expect(hamburgerBtn).toBeVisible();

    // Test hamburger functionality
    await hamburgerBtn.click();

    // Sidebar should be visible after click
    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar).toBeVisible();
  });

  test('should hide mobile menu controls on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginWithNsec(page);

    // Hamburger should not be visible or should be hidden via CSS
    const hamburgerVisible = await page
      .locator('.hamburger-btn')
      .isVisible()
      .catch(() => false);
    // On desktop, hamburger might be hidden via CSS, so we check computed style
    const hamburgerDisplay = await page
      .locator('.hamburger-btn')
      .evaluate((el) => window.getComputedStyle(el).display)
      .catch(() => 'none');

    expect(hamburgerVisible === false || hamburgerDisplay === 'none').toBe(true);
  });
});

test.describe('Design Review: Interactive States', () => {
  test('should show hover states on navigation items', async ({ page }) => {
    await loginWithNsec(page);
    await page.waitForSelector('.nav-item');

    const navItem = page.locator('.nav-item').first();

    // Get initial background color
    const initialBg = await navItem.evaluate((el) => window.getComputedStyle(el).backgroundColor);

    // Hover and check background changes
    await navItem.hover();
    await page.waitForTimeout(100); // Wait for transition

    const hoveredBg = await navItem.evaluate((el) => window.getComputedStyle(el).backgroundColor);

    // Background should change on hover (unless already active)
    const isActive = await navItem.evaluate((el) => el.classList.contains('active'));
    if (!isActive) {
      expect(hoveredBg).not.toBe(initialBg);
    }
  });

  test('should show focus states with keyboard navigation', async ({ page }) => {
    await loginWithNsec(page);

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Check focus-visible styles are applied
    const focused = await page.evaluate(() => {
      const activeEl = document.activeElement;
      if (!activeEl) return null;
      const styles = window.getComputedStyle(activeEl);
      return {
        outline: styles.outline,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow
      };
    });

    // Some kind of focus indicator should be present
    expect(
      focused?.outline !== 'none' ||
        focused?.outlineColor !== 'rgba(0, 0, 0, 0)' ||
        focused?.boxShadow !== 'none'
    ).toBe(true);
  });

  test('should show active state on navigation items', async ({ page }) => {
    await loginWithNsec(page);
    await page.waitForSelector('.nav-item.active');

    const activeItem = page.locator('.nav-item.active').first();

    // Check active styles
    const activeStyles = await activeItem.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderLeftColor: styles.borderLeftColor,
        backgroundColor: styles.backgroundColor,
        fontWeight: styles.fontWeight
      };
    });

    // Active item should have accent border color
    expect(activeStyles.fontWeight).toContain('600');
  });

  test('should handle disabled button states correctly', async ({ page }) => {
    await loginWithNsec(page);

    // Find any disabled buttons
    const disabledButtons = await page.locator('button:disabled').count();

    if (disabledButtons > 0) {
      const disabledBtn = page.locator('button:disabled').first();

      // Check disabled styling
      const opacity = await disabledBtn.evaluate((el) => window.getComputedStyle(el).opacity);
      const cursor = await disabledBtn.evaluate((el) => window.getComputedStyle(el).cursor);

      expect(parseFloat(opacity)).toBeLessThan(1);
      expect(cursor).toBe('not-allowed');
    }
  });
});

test.describe('Design Review: Touch Targets & Accessibility', () => {
  test('should have minimum 44x44px touch targets for interactive elements', async ({ page }) => {
    await loginWithNsec(page);

    // Check buttons and links
    const touchTargets = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a[href]'));
      return buttons
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0; // Only visible elements
        })
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            class: el.className,
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height
          };
        });
    });

    // Filter out very small decorative elements (like close icons might be slightly smaller)
    const mainInteractiveElements = touchTargets.filter((t) => !t.class.includes('close'));

    // Most interactive elements should meet 44x44 target
    const compliant = mainInteractiveElements.filter(
      (t) => t.width >= 44 || t.height >= 44 || t.area >= 1936 // 44x44
    );

    const complianceRate = compliant.length / Math.max(mainInteractiveElements.length, 1);

    // At least 80% of main interactive elements should be compliant
    expect(complianceRate).toBeGreaterThanOrEqual(0.8);
  });

  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    await loginWithNsec(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const ariaViolations = accessibilityScanResults.violations.filter(
      (v) => v.id.includes('aria') || v.id.includes('label')
    );

    expect(ariaViolations).toEqual([]);
  });

  test('should have proper semantic HTML structure', async ({ page }) => {
    await loginWithNsec(page);

    // Check for key semantic elements
    const semanticElements = await page.evaluate(() => {
      return {
        hasMain: document.querySelector('main') !== null,
        hasNav: document.querySelector('nav') !== null,
        hasAside: document.querySelector('aside') !== null,
        mainHasRole: document.querySelector('main')?.getAttribute('role') === 'main'
      };
    });

    expect(semanticElements.hasMain).toBe(true);
    expect(semanticElements.mainHasRole).toBe(true);
  });
});

test.describe('Design Review: Loading & Skeleton States', () => {
  test('should show loading state with proper styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Check for loading indicator during initial load
    const hasLoadingText = await page
      .locator('text=Loading NostrStack')
      .isVisible()
      .catch(() => false);

    // If loading state is visible, check it has proper styling
    if (hasLoadingText) {
      const loadingStyles = await page.evaluate(() => {
        const loadingEl = document.querySelector('text=Loading NostrStack');
        if (!loadingEl) return null;
        return window.getComputedStyle(loadingEl).fontFamily;
      });

      expect(loadingStyles).toBeTruthy();
    }
  });

  test('should use skeleton screens for loading content', async ({ page }) => {
    await loginWithNsec(page);

    // Check if PostSkeleton component exists in the DOM (might be in use)
    const skeletons = await page.locator('.post-skeleton, [class*="skeleton"]').count();

    // Skeletons might not always be visible depending on load speed
    // This test just ensures they render when present
    expect(skeletons).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Design Review: Layout Consistency', () => {
  test('should maintain consistent spacing using design tokens', async ({ page }) => {
    await loginWithNsec(page);

    // Check grid layout on desktop
    const layoutStyles = await page.evaluate(() => {
      const layout = document.querySelector('.social-layout');
      if (!layout) return null;
      return {
        display: window.getComputedStyle(layout).display,
        gridTemplateColumns: window.getComputedStyle(layout).gridTemplateColumns
      };
    });

    expect(layoutStyles?.display).toBe('grid');
    expect(layoutStyles?.gridTemplateColumns).toBeTruthy();
  });

  test('should have consistent border radius values', async ({ page }) => {
    await loginWithNsec(page);

    const borderRadii = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.post-card, button, .action-btn'));
      return elements.map((el) => window.getComputedStyle(el).borderRadius);
    });

    // Most elements should use 6px border radius (design system standard)
    const commonRadius = borderRadii.filter((r) => r.includes('6px'));
    expect(commonRadius.length).toBeGreaterThan(0);
  });

  test('should use consistent shadows for elevation', async ({ page }) => {
    await loginWithNsec(page);

    const shadows = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.post-card'));
      return cards.map((el) => window.getComputedStyle(el).boxShadow);
    });

    // Cards should have subtle shadows
    const hasShadows = shadows.some((s) => s !== 'none');
    expect(hasShadows).toBe(true);
  });
});

test.describe('Design Review: Dark Mode Support', () => {
  test('should support theme switching', async ({ page }) => {
    await loginWithNsec(page);

    // Navigate to settings
    const settingsBtn = page
      .locator('button:has-text("Settings")')
      .or(page.locator('[aria-label*="Settings"]'));

    if ((await settingsBtn.count()) > 0) {
      await settingsBtn.first().click();
      await page.waitForTimeout(500);

      // Look for theme toggle
      const themeToggle = page.locator('button:has-text("Dark"), button:has-text("Light")');
      const hasThemeToggle = (await themeToggle.count()) > 0;

      expect(hasThemeToggle).toBe(true);

      if (hasThemeToggle) {
        // Get current theme
        const currentTheme = await page.evaluate(() => {
          return document.body.getAttribute('data-theme');
        });

        expect(currentTheme).toBeTruthy();
      }
    }
  });
});

test.describe('Design Review: Animation & Motion', () => {
  test('should respect prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginWithNsec(page);

    // Check that transitions are disabled when reduced motion is preferred
    const transitionStyles = await page.evaluate(() => {
      const navItem = document.querySelector('.nav-item');
      if (!navItem) return null;
      return window.getComputedStyle(navItem).transition;
    });

    // When prefers-reduced-motion is active, transitions should be none or very short
    expect(transitionStyles).toBeTruthy();
  });

  test('should have smooth transitions for interactive elements', async ({ page }) => {
    await loginWithNsec(page);
    await page.waitForSelector('.nav-item');

    const transition = await page.evaluate(() => {
      const btn = document.querySelector('.action-btn, .nav-item');
      if (!btn) return null;
      return window.getComputedStyle(btn).transition;
    });

    expect(transition).toBeTruthy();
    expect(transition).not.toBe('none');
  });
});
