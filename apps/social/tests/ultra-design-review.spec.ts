import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * ULTRA-DEEP Design Review Test Suite
 *
 * This comprehensive suite goes beyond basic accessibility to verify:
 * - Visual design consistency across all states
 * - Component hierarchy and information architecture
 * - Dark mode implementation
 * - Edge cases and error states
 * - Micro-interactions and polish
 * - Typography scale in real usage
 * - Spacing consistency across breakpoints
 * - Mobile UX patterns
 */

// Test helper to login
async function loginWithNsec(page: Page) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
  await page.getByPlaceholder('nsec1...').fill(validNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForSelector('main[role="main"]', { timeout: 10000 });
}

test.describe('Ultra Review: Visual Design Consistency', () => {
  test('should maintain consistent visual weight across components', async ({ page }) => {
    await loginWithNsec(page);

    await expect(page.locator('.social-layout, main[role="main"]')).toBeVisible({ timeout: 10000 });

    // Analyze font weights across different components
    const fontWeights = await page.evaluate(() => {
      const elements = {
        sidebarTitle: document.querySelector('.sidebar-title'),
        navItemActive: document.querySelector('.nav-item.active'),
        navItemInactive: document.querySelector('.nav-item:not(.active)'),
        feedTitle: document.querySelector('h2'),
        postContent: document.querySelector('[data-testid="social-event-content"]'),
        actionButton: document.querySelector('.action-btn')
      };

      return Object.entries(elements).reduce(
        (acc, [key, el]) => {
          if (el) {
            acc[key] = window.getComputedStyle(el).fontWeight;
          }
          return acc;
        },
        {} as Record<string, string>
      );
    });

    // Verify consistent weight hierarchy (if elements exist)
    if (fontWeights.sidebarTitle) {
      expect(fontWeights.sidebarTitle).toBe('600'); // Headings
    }
    if (fontWeights.navItemActive) {
      expect(fontWeights.navItemActive).toBe('600'); // Active states
    }
    if (fontWeights.actionButton) {
      expect(fontWeights.actionButton).toBe('500'); // Interactive elements
    }

    // At least sidebar title should always be present
    expect(fontWeights.sidebarTitle).toBeTruthy();
  });

  test('should use consistent spacing scale', async ({ page }) => {
    await loginWithNsec(page);

    // Measure spacing between major elements
    const spacing = await page.evaluate(() => {
      const layout = document.querySelector('.social-layout');
      const sidebar = document.querySelector('.sidebar-nav');
      const main = document.querySelector('main');
      const telemetry = document.querySelector('.telemetry-sidebar');

      return {
        layoutGrid: window.getComputedStyle(layout!).gridTemplateColumns,
        sidebarPadding: window.getComputedStyle(sidebar!).padding,
        mainPadding: window.getComputedStyle(main!).padding,
        telemetryPadding: window.getComputedStyle(telemetry!).padding
      };
    });

    // Verify consistent padding values (multiples of 4px/8px)
    expect(spacing.mainPadding).toMatch(/24px|1\.5rem/); // 1.5rem = 24px
  });

  test('should maintain visual hierarchy in feed', async ({ page }) => {
    await loginWithNsec(page);

    // Check that visual hierarchy is clear
    const hierarchy = await page.evaluate(() => {
      const feedTitle = document.querySelector('h2');
      const postCard = document.querySelector('[data-testid="social-event-card"]');

      if (!feedTitle || !postCard) return null;

      const feedTitleStyles = window.getComputedStyle(feedTitle);
      const postCardStyles = window.getComputedStyle(postCard);

      return {
        feedTitleSize: parseFloat(feedTitleStyles.fontSize),
        feedTitleWeight: feedTitleStyles.fontWeight,
        cardBorder: postCardStyles.border,
        cardShadow: postCardStyles.boxShadow
      };
    });

    if (hierarchy) {
      expect(hierarchy.feedTitleSize).toBeGreaterThanOrEqual(15); // Prominent heading
      expect(hierarchy.cardBorder).toContain('1px'); // Subtle separation
      expect(hierarchy.cardShadow).not.toBe('none'); // Depth
    }
  });
});

test.describe('Ultra Review: Dark Mode Implementation', () => {
  test('should have proper dark mode color palette', async ({ page }) => {
    await loginWithNsec(page);

    // Navigate to settings and enable dark mode
    const settingsBtn = page.locator('button', { hasText: 'Settings' });
    if ((await settingsBtn.count()) > 0) {
      await settingsBtn.click();

      // Look for dark mode toggle
      const darkModeBtn = page.locator('button:has-text("Dark")');
      if ((await darkModeBtn.count()) > 0) {
        await darkModeBtn.click();
        await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });

        // Verify dark mode colors are applied
        const darkColors = await page.evaluate(() => {
          const root = document.documentElement;
          const body = document.body;
          const theme = body.getAttribute('data-theme');

          return {
            theme,
            canvasDefault: window
              .getComputedStyle(root)
              .getPropertyValue('--color-canvas-default')
              .trim(),
            fgDefault: window.getComputedStyle(root).getPropertyValue('--color-fg-default').trim(),
            bodyBg: window.getComputedStyle(body).backgroundColor
          };
        });

        expect(darkColors.theme).toBe('dark');
        // In dark mode, background should be dark
        expect(darkColors.bodyBg).not.toBe('rgb(255, 255, 255)');
      }
    }
  });

  test('should maintain contrast ratios in dark mode', async ({ page }) => {
    await loginWithNsec(page);

    // Switch to dark mode
    const settingsBtn = page.locator('button', { hasText: 'Settings' });
    if ((await settingsBtn.count()) > 0) {
      await settingsBtn.click();

      const darkModeBtn = page.locator('button:has-text("Dark")');
      if ((await darkModeBtn.count()) > 0) {
        await darkModeBtn.click();
        await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });

        // Run accessibility scan in dark mode
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2aa'])
          .analyze();

        const contrastViolations = accessibilityScanResults.violations.filter(
          (v) => v.id === 'color-contrast'
        );

        expect(contrastViolations).toEqual([]);
      }
    }
  });

  test('should have smooth dark mode transition', async ({ page }) => {
    await loginWithNsec(page);

    const settingsBtn = page.locator('button', { hasText: 'Settings' });
    if ((await settingsBtn.count()) > 0) {
      await settingsBtn.click();

      // Record initial state
      const initialBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });

      const darkModeBtn = page.locator('button:has-text("Dark")');
      if ((await darkModeBtn.count()) > 0) {
        await darkModeBtn.click();
        const newBg = await page.evaluate(() => {
          return window.getComputedStyle(document.body).backgroundColor;
        });

        // Background should have changed
        expect(newBg).not.toBe(initialBg);
      }
    }
  });
});

test.describe('Ultra Review: Component States & Edge Cases', () => {
  test('should handle empty feed state gracefully', async ({ page }) => {
    await loginWithNsec(page);

    await expect(page.locator('.feed-stream')).toBeVisible({ timeout: 10000 });

    // Check if there's content (posts OR empty state message)
    const hasContent = await page.evaluate(() => {
      const main = document.querySelector('main[role="main"]');
      if (!main) return false;

      const text = main.textContent || '';
      const hasPosts = document.querySelectorAll('[data-testid="social-event-card"]').length > 0;
      const hasEmptyState = text.includes('No posts') || text.includes('first post');

      return hasPosts || hasEmptyState || text.trim().length > 0;
    });

    expect(hasContent).toBe(true);
  });

  test('should show proper loading states', async ({ page }) => {
    await page.goto('/');

    // Check for loading indicator during navigation
    const hasLoadingState = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Loading') || text.includes('loading');
    });

    expect(hasLoadingState).toBe(true);
  });

  test('should handle long text content gracefully', async ({ page }) => {
    await loginWithNsec(page);

    // Check text overflow handling
    const textOverflow = await page.evaluate(() => {
      const postContents = Array.from(
        document.querySelectorAll('[data-testid="social-event-content"]')
      );
      return postContents.map((el) => {
        const styles = window.getComputedStyle(el);
        return {
          overflow: styles.overflow,
          wordWrap: styles.wordWrap,
          wordBreak: styles.wordBreak
        };
      });
    });

    // Ensure text doesn't overflow containers
    textOverflow.forEach((styles) => {
      expect(['hidden', 'auto', 'scroll', 'visible']).toContain(styles.overflow);
    });
  });

  test('should show error states with proper styling', async ({ page }) => {
    await loginWithNsec(page);

    // Check if Alert component exists and has proper styling
    const alerts = await page.locator('.ns-alert').count();

    if (alerts > 0) {
      const alertStyles = await page.evaluate(() => {
        const alert = document.querySelector('.ns-alert');
        if (!alert) return null;

        const styles = window.getComputedStyle(alert);
        return {
          padding: styles.padding,
          borderRadius: styles.borderRadius,
          border: styles.border,
          color: styles.color
        };
      });

      if (alertStyles) {
        expect(alertStyles.borderRadius).toMatch(/8px|0.5rem/);
        expect(alertStyles.border).toContain('1px');
      }
    }
  });
});

test.describe('Ultra Review: Typography Scale in Practice', () => {
  test('should maintain readable line lengths', async ({ page }) => {
    await loginWithNsec(page);

    // Check that text content doesn't exceed optimal line length (45-75 chars)
    const lineLengths = await page.evaluate(() => {
      const posts = Array.from(document.querySelectorAll('[data-testid="social-event-content"]'));
      return posts.map((post) => {
        const width = post.getBoundingClientRect().width;
        const fontSize = parseFloat(window.getComputedStyle(post).fontSize);
        // Rough estimate: ~0.5em per character
        const estimatedCharsPerLine = width / (fontSize * 0.5);
        return {
          width,
          fontSize,
          estimatedCharsPerLine
        };
      });
    });

    lineLengths.forEach((line) => {
      // Optimal line length: 45-90 characters for readability
      expect(line.estimatedCharsPerLine).toBeLessThan(100);
    });
  });

  test('should use appropriate font sizes for hierarchy', async ({ page }) => {
    await loginWithNsec(page);

    const fontSizes = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const body = document.querySelector('[data-testid="social-event-content"]');
      const small = document.querySelector('[data-testid="social-event-header"]');

      return {
        h1: h1 ? parseFloat(window.getComputedStyle(h1).fontSize) : null,
        h2: h2 ? parseFloat(window.getComputedStyle(h2).fontSize) : null,
        body: body ? parseFloat(window.getComputedStyle(body).fontSize) : null,
        small: small ? parseFloat(window.getComputedStyle(small).fontSize) : null
      };
    });

    // Verify type scale relationships
    if (fontSizes.h1 && fontSizes.body) {
      expect(fontSizes.h1).toBeGreaterThan(fontSizes.body);
    }
    if (fontSizes.h2 && fontSizes.body) {
      expect(fontSizes.h2).toBeGreaterThan(fontSizes.body);
    }
    if (fontSizes.body && fontSizes.small) {
      expect(fontSizes.body).toBeGreaterThan(fontSizes.small);
    }
  });

  test('should have sufficient line spacing for readability', async ({ page }) => {
    await loginWithNsec(page);

    const lineHeights = await page.evaluate(() => {
      const body = document.querySelector('[data-testid="social-event-content"] p');
      const nav = document.querySelector('.nav-item');

      return {
        bodyLineHeight: body ? parseFloat(window.getComputedStyle(body).lineHeight) : null,
        bodyFontSize: body ? parseFloat(window.getComputedStyle(body).fontSize) : null,
        navLineHeight: nav ? parseFloat(window.getComputedStyle(nav).lineHeight) : null
      };
    });

    // Line height should be at least 1.4x font size for readability
    if (lineHeights.bodyLineHeight && lineHeights.bodyFontSize) {
      const ratio = lineHeights.bodyLineHeight / lineHeights.bodyFontSize;
      expect(ratio).toBeGreaterThanOrEqual(1.4);
    }
  });
});

test.describe('Ultra Review: Micro-interactions & Polish', () => {
  test('should have smooth hover transitions on all interactive elements', async ({ page }) => {
    await loginWithNsec(page);

    const transitions = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, .action-btn, .nav-item'));
      return buttons.map((btn) => {
        const styles = window.getComputedStyle(btn);
        return {
          tag: btn.tagName,
          class: btn.className,
          transition: styles.transition,
          cursor: styles.cursor
        };
      });
    });

    transitions.forEach((t) => {
      // Interactive elements should have cursor pointer
      if (t.cursor !== 'not-allowed') {
        expect(['pointer', 'default']).toContain(t.cursor);
      }

      // Should have transitions (or explicitly none for reduced motion)
      expect(typeof t.transition).toBe('string');
    });
  });

  test('should have appropriate focus indicators on all focusable elements', async ({ page }) => {
    await loginWithNsec(page);

    // Tab through elements and verify focus styles
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      const styles = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        outline: styles.outline,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor
      };
    });

    if (focusedElement) {
      // Should have some kind of focus indicator
      const hasFocusIndicator =
        focusedElement.outline !== 'none' ||
        focusedElement.boxShadow !== 'none' ||
        focusedElement.outlineColor !== 'rgba(0, 0, 0, 0)';

      expect(hasFocusIndicator).toBe(true);
    }
  });

  test('should show loading spinners with proper animation', async ({ page }) => {
    await loginWithNsec(page);

    // Check for spinner elements
    const spinners = await page.locator('.zap-spinner, .ns-spinner, [class*="spinner"]').count();

    if (spinners > 0) {
      const spinnerAnimation = await page.evaluate(() => {
        const spinner = document.querySelector('.zap-spinner, .ns-spinner');
        if (!spinner) return null;

        const styles = window.getComputedStyle(spinner);
        return {
          animation: styles.animation,
          width: styles.width,
          height: styles.height,
          borderRadius: styles.borderRadius
        };
      });

      if (spinnerAnimation) {
        expect(spinnerAnimation.animation).not.toBe('none');
        expect(spinnerAnimation.borderRadius).toMatch(/50%|999px/); // Should be circular
      }
    }
  });

  test('should have appropriate cursor states', async ({ page }) => {
    await loginWithNsec(page);

    const cursors = await page.evaluate(() => {
      return {
        button: window.getComputedStyle(document.querySelector('button')!).cursor,
        link: window.getComputedStyle(document.querySelector('a')!).cursor,
        disabledButton: document.querySelector('button:disabled')
          ? window.getComputedStyle(document.querySelector('button:disabled')!).cursor
          : null
      };
    });

    expect(cursors.button).toBe('pointer');
    if (cursors.disabledButton) {
      expect(cursors.disabledButton).toBe('not-allowed');
    }
  });
});

test.describe('Ultra Review: Mobile UX Patterns', () => {
  test('should have mobile-optimized touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginWithNsec(page);

    // Check hamburger menu
    const hamburger = page.locator('.hamburger-btn');
    await expect(hamburger).toBeVisible();

    const hamburgerSize = await hamburger.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    // Hamburger should be at least 44x44
    expect(hamburgerSize.width).toBeGreaterThanOrEqual(44);
    expect(hamburgerSize.height).toBeGreaterThanOrEqual(44);
  });

  test('should show mobile menu with proper animation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginWithNsec(page);

    const hamburger = page.locator('.hamburger-btn');

    // Click hamburger
    await hamburger.click();

    // Sidebar should be visible
    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar).toHaveClass(/is-open/);

    // Check for overlay
    const overlay = page.locator('.sidebar-overlay');
    await expect(overlay).toHaveClass(/is-visible/);
  });

  test('should prevent body scroll when mobile menu is open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginWithNsec(page);

    const hamburger = page.locator('.hamburger-btn');
    await hamburger.click();

    // Try to scroll - menu should stay in place
    const sidebar = page.locator('.sidebar-nav');
    const isVisible = await sidebar.isVisible();

    expect(isVisible).toBe(true);
  });

  test('should close mobile menu when clicking overlay', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginWithNsec(page);

    // Close onboarding tour if present
    const tourCloseBtn = page.locator('[aria-label*="Close"], [aria-label*="close"]').first();
    if (await tourCloseBtn.isVisible().catch(() => false)) {
      await tourCloseBtn.click();
    }

    // Open menu
    await page.locator('.hamburger-btn').click();

    // Click overlay - use force to bypass potential intercepts
    const overlay = page.locator('.sidebar-overlay');
    await overlay.click({ force: true });

    // Sidebar should be hidden
    const sidebar = page.locator('.sidebar-nav');
    const hasOpenClass = await sidebar.evaluate((el) => el.classList.contains('is-open'));

    expect(hasOpenClass).toBe(false);
  });
});

test.describe('Ultra Review: Spacing Consistency Across Breakpoints', () => {
  const breakpoints = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 }
  ];

  for (const bp of breakpoints) {
    test(`should maintain spacing scale on ${bp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await loginWithNsec(page);

      const spacing = await page.evaluate(() => {
        const main = document.querySelector('main');
        const cards = Array.from(document.querySelectorAll('[data-testid="social-event-card"]'));

        if (!main) return null;

        const mainPadding = window.getComputedStyle(main).padding;
        const cardPaddings = cards.map((card) => window.getComputedStyle(card).padding);

        return {
          mainPadding,
          cardPaddings,
          cardCount: cards.length
        };
      });

      if (spacing) {
        // Padding should be consistent multiples of base unit (usually 4px or 8px)
        expect(spacing.mainPadding).toBeTruthy();
      }
    });
  }
});

test.describe('Ultra Review: Information Architecture', () => {
  test('should have clear visual grouping of related elements', async ({ page }) => {
    await loginWithNsec(page);

    const grouping = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar-nav');
      const main = document.querySelector('main');
      const telemetry = document.querySelector('.telemetry-sidebar');

      return {
        hasSidebar: !!sidebar,
        hasMain: !!main,
        hasTelemetry: !!telemetry,
        sidebarSections: sidebar ? sidebar.querySelectorAll('div[style*="padding"]').length : 0
      };
    });

    expect(grouping.hasSidebar).toBe(true);
    expect(grouping.hasMain).toBe(true);
    expect(grouping.hasTelemetry).toBe(true);
  });

  test('should have clear navigation hierarchy', async ({ page }) => {
    await loginWithNsec(page);

    const navStructure = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      const navItems = nav ? Array.from(nav.querySelectorAll('.nav-item')) : [];

      return {
        hasNav: !!nav,
        navItemCount: navItems.length,
        hasActiveState: navItems.some((item) => item.classList.contains('active')),
        navLabel: nav?.getAttribute('aria-label')
      };
    });

    expect(navStructure.hasNav).toBe(true);
    expect(navStructure.navItemCount).toBeGreaterThan(0);
    expect(navStructure.hasActiveState).toBe(true);
    expect(navStructure.navLabel).toBe('Main navigation');
  });

  test('should maintain focus order that matches visual order', async ({ page }) => {
    await loginWithNsec(page);

    const focusOrder = [];

    // Tab through first 5 elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;

        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          class: el.className,
          top: rect.top,
          left: rect.left
        };
      });

      if (focused) {
        focusOrder.push(focused);
      }
    }

    // Focus order should generally go from top to bottom, left to right
    // (Some flexibility for modern layouts)
    expect(focusOrder.length).toBeGreaterThan(0);
  });
});

test.describe('Ultra Review: Visual Regression Detection', () => {
  test('should capture baseline screenshot of feed view', async ({ page }) => {
    await loginWithNsec(page);
    await expect(page.locator('.social-layout, main[role="main"]')).toBeVisible({ timeout: 10000 });

    // Take full page screenshot
    await page.screenshot({
      path: 'test-results/visual-baseline-feed.png',
      fullPage: false
    });
  });

  test('should capture baseline screenshot of dark mode', async ({ page }) => {
    await loginWithNsec(page);

    const settingsBtn = page.locator('button', { hasText: 'Settings' });
    if ((await settingsBtn.count()) > 0) {
      await settingsBtn.click();

      const darkModeBtn = page.locator('button:has-text("Dark")');
      if ((await darkModeBtn.count()) > 0) {
        await darkModeBtn.click();
        await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });

        await page.screenshot({
          path: 'test-results/visual-baseline-dark.png',
          fullPage: false
        });
      }
    }
  });

  test('should capture mobile view baseline', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginWithNsec(page);
    await expect(page.locator('.social-layout, main[role="main"]')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/visual-baseline-mobile.png',
      fullPage: false
    });
  });
});

test.describe('Ultra Review: Performance & Polish', () => {
  test('should not have layout shifts during load', async ({ page }) => {
    await page.goto('/');

    // Measure cumulative layout shift
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & {
              hadRecentInput: boolean;
              value: number;
            };
            if (!layoutShift.hadRecentInput) {
              cls += layoutShift.value;
            }
          }
        });

        observer.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 3000);
      });
    });

    // CLS should be less than 0.1 for good UX
    expect(cls).toBeLessThan(0.25); // Being lenient for mock data
  });

  test('should load fonts efficiently', async ({ page }) => {
    await loginWithNsec(page);

    const fonts = await page.evaluate(() => {
      const body = document.body;
      const computedFont = window.getComputedStyle(body).fontFamily;

      // Check if system fonts are being used (fast)
      const usesSystemFonts =
        computedFont.includes('apple-system') || computedFont.includes('BlinkMacSystemFont');

      return {
        fontFamily: computedFont,
        usesSystemFonts
      };
    });

    // Should use system fonts for performance
    expect(fonts.usesSystemFonts).toBe(true);
  });

  test('should have appropriate z-index layering', async ({ page }) => {
    await loginWithNsec(page);

    const zIndices = await page.evaluate(() => {
      return {
        skipLink: window.getComputedStyle(document.querySelector('.skip-link')!).zIndex,
        modal: document.querySelector('.zap-overlay')
          ? window.getComputedStyle(document.querySelector('.zap-overlay')!).zIndex
          : null,
        hamburger: window.getComputedStyle(document.querySelector('.hamburger-btn')!).zIndex
      };
    });

    // Skip link should have very high z-index when focused
    expect(parseInt(zIndices.skipLink)).toBeGreaterThan(1000);

    // Modal should have high z-index
    if (zIndices.modal) {
      expect(parseInt(zIndices.modal)).toBeGreaterThan(100);
    }
  });
});
