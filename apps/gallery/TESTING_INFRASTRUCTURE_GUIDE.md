# NostrStack Gallery - Testing Infrastructure Guide

**Version:** 2.0
**Last Updated:** 2026-01-06
**Maintainer:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Test Suites](#test-suites)
3. [Running Tests](#running-tests)
4. [Writing New Tests](#writing-new-tests)
5. [Visual Regression Testing](#visual-regression-testing)
6. [Accessibility Testing](#accessibility-testing)
7. [Test Helpers & Utilities](#test-helpers--utilities)
8. [Debugging Tests](#debugging-tests)
9. [CI/CD Integration](#cicd-integration)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The NostrStack Gallery uses **Playwright** for end-to-end design and functionality testing. Our test infrastructure focuses on:

- **Design consistency** - Typography, colors, spacing
- **Accessibility** - WCAG AA compliance, keyboard navigation
- **Responsive behavior** - Mobile, tablet, desktop viewports
- **Component states** - Hover, focus, loading, error, empty
- **Visual regression** - Detecting unintended visual changes
- **Performance** - Layout shifts, font loading, z-index

### Test Statistics

- **Total Tests:** 60
- **Test Suites:** 2 (Basic + Ultra-Deep)
- **Current Pass Rate:** 100%
- **Execution Time:** ~43 seconds
- **Browser:** Chromium (can expand to Firefox, WebKit)

---

## Test Suites

### 1. Basic Design Review (`tests/design-review.spec.ts`)

**Purpose:** Core design system verification
**Tests:** 27
**Execution Time:** ~12 seconds

**Categories:**

- Typography & Visual Hierarchy (3 tests)
- Color System & Contrast (3 tests)
- Responsive Behavior (6 tests)
- Interactive States (4 tests)
- Touch Targets & Accessibility (3 tests)
- Loading & Skeleton States (2 tests)
- Layout Consistency (3 tests)
- Dark Mode Support (1 test)
- Animation & Motion (2 tests)

**When to run:**

- Before every commit
- After design system changes
- After CSS modifications
- Before pull requests

### 2. Ultra-Deep Design Review (`tests/ultra-design-review.spec.ts`)

**Purpose:** Comprehensive design quality assurance
**Tests:** 33
**Execution Time:** ~31 seconds

**Categories:**

- Visual Design Consistency (3 tests)
- Dark Mode Implementation (3 tests)
- Component States & Edge Cases (4 tests)
- Typography Scale in Practice (3 tests)
- Micro-interactions & Polish (4 tests)
- Mobile UX Patterns (4 tests)
- Spacing Consistency (3 tests)
- Information Architecture (3 tests)
- Visual Regression Detection (3 tests)
- Performance & Polish (3 tests)

**When to run:**

- Before major releases
- After significant UI changes
- Weekly as part of QA
- Before design reviews

---

## Running Tests

### Quick Commands

**Run all tests:**

```bash
pnpm e2e
```

**Run specific suite:**

```bash
pnpm e2e tests/design-review.spec.ts
pnpm e2e tests/ultra-design-review.spec.ts
```

**Run both suites together:**

```bash
pnpm e2e tests/design-review.spec.ts tests/ultra-design-review.spec.ts
```

**Run specific test:**

```bash
pnpm e2e tests/design-review.spec.ts -g "should maintain consistent font families"
```

**Run tests matching pattern:**

```bash
pnpm e2e -g "Dark Mode"
pnpm e2e -g "accessibility"
pnpm e2e -g "Mobile"
```

### Advanced Options

**Run in headed mode (see browser):**

```bash
pnpm e2e --headed
```

**Run in debug mode:**

```bash
pnpm e2e --debug
```

**Run on specific browser:**

```bash
pnpm e2e --project=chromium
pnpm e2e --project=firefox
pnpm e2e --project=webkit
```

**Run in parallel (faster):**

```bash
pnpm e2e --workers=4
```

**Generate HTML report:**

```bash
pnpm e2e --reporter=html
```

---

## Writing New Tests

### Test Structure Template

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Helper function (reuse across tests)
async function loginWithNsec(page: any) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
  await page.getByPlaceholder('nsec1...').fill(validNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForSelector('main[role="main"]', { timeout: 10000 });
}

// Test group
test.describe('Feature Name', () => {
  test('should do expected behavior', async ({ page }) => {
    // Arrange - set up test state
    await loginWithNsec(page);

    // Act - perform actions
    await page.click('.some-button');

    // Assert - verify results
    const element = await page.locator('.result');
    await expect(element).toBeVisible();
  });
});
```

### Naming Conventions

**Test descriptions should:**

- Start with "should"
- Be specific and descriptive
- Focus on behavior, not implementation

**Good examples:**

```typescript
test('should maintain 4.5:1 contrast ratio for text');
test('should show empty state when no posts available');
test('should close mobile menu when clicking overlay');
```

**Bad examples:**

```typescript
test('check colors'); // Too vague
test('test button'); // Not descriptive
test('verify the app has proper contrast'); // Too broad
```

### Test Categories

Choose the appropriate category based on what you're testing:

1. **Visual Design** - Layout, spacing, typography
2. **Color System** - Colors, contrast, dark mode
3. **Responsive** - Breakpoints, mobile behavior
4. **Interactive** - Hover, focus, click states
5. **Accessibility** - ARIA, keyboard, screen readers
6. **Performance** - Loading, layout shifts
7. **Component States** - Loading, error, empty
8. **Regression** - Visual snapshots

---

## Visual Regression Testing

### Overview

Visual regression testing captures screenshots and compares them to baseline images to detect unintended visual changes.

### Capturing Baselines

**First time capturing a baseline:**

```typescript
test('should capture component baseline', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.component');

  // Capture baseline
  await expect(page).toHaveScreenshot('component-baseline.png', {
    maxDiffPixels: 100
  });
});
```

**Run test to create baseline:**

```bash
pnpm e2e tests/your-test.spec.ts --update-snapshots
```

This creates: `tests/your-test.spec.ts-snapshots/component-baseline-chromium-linux.png`

### Comparing to Baselines

**Run tests normally:**

```bash
pnpm e2e tests/your-test.spec.ts
```

**If visual changes detected:**

```
Error: Screenshot comparison failed:
  Expected: component-baseline-chromium-linux.png
  Actual:   component-baseline-actual.png
  Diff:     component-baseline-diff.png

  235 pixels (ratio 0.02 of all image pixels) are different.
```

### Updating Baselines

**When changes are intentional:**

```bash
# Review changes first
git diff tests/

# Update baselines
pnpm e2e tests/your-test.spec.ts --update-snapshots

# Verify new baselines
pnpm e2e tests/your-test.spec.ts

# Commit updated baselines
git add tests/**/*.png
git commit -m "Update visual baselines after design changes"
```

### Best Practices

1. **Stable elements only** - Avoid capturing dynamic content (timestamps, random data)
2. **Use fullPage: false** - Capture specific components, not entire pages
3. **Set viewport** - Always use consistent viewport size
4. **Wait for stability** - Wait for animations, lazy loading to complete
5. **Review diffs carefully** - Always check actual vs expected images

**Example with best practices:**

```typescript
test('should maintain button visual design', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  // Wait for all animations to complete
  await page.waitForTimeout(500);

  // Capture specific element
  const button = await page.locator('.action-btn').first();
  await expect(button).toHaveScreenshot('action-button.png', {
    maxDiffPixels: 50,
    threshold: 0.2
  });
});
```

---

## Accessibility Testing

### Axe-core Integration

Our tests use `@axe-core/playwright` to automatically scan for accessibility violations.

### Basic Accessibility Scan

```typescript
import AxeBuilder from '@axe-core/playwright';

test('should pass accessibility scan', async ({ page }) => {
  await page.goto('/');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

### Testing Specific Rules

```typescript
test('should have sufficient color contrast', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();

  const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');

  expect(contrastViolations).toEqual([]);
});
```

### Common Accessibility Tests

**1. Color Contrast:**

```typescript
// Tests 4.5:1 minimum for normal text, 3:1 for large text
await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
```

**2. Keyboard Navigation:**

```typescript
test('should be keyboard navigable', async ({ page }) => {
  await page.goto('/');

  // Tab through interactive elements
  await page.keyboard.press('Tab');

  // Verify focus indicator visible
  const focused = await page.locator(':focus');
  const outline = await focused.evaluate((el) => window.getComputedStyle(el).outline);

  expect(outline).not.toBe('none');
});
```

**3. ARIA Labels:**

```typescript
test('should have ARIA labels on buttons', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a']).analyze();

  const labelViolations = results.violations.filter((v) => v.id === 'button-name');

  expect(labelViolations).toEqual([]);
});
```

**4. Semantic HTML:**

```typescript
test('should use semantic HTML elements', async ({ page }) => {
  await page.goto('/');

  const hasMain = (await page.locator('main').count()) > 0;
  const hasNav = (await page.locator('nav').count()) > 0;
  const hasH1 = (await page.locator('h1').count()) > 0;

  expect(hasMain).toBe(true);
  expect(hasNav).toBe(true);
  expect(hasH1).toBe(true);
});
```

---

## Test Helpers & Utilities

### Login Helper

```typescript
async function loginWithNsec(page: any) {
  await page.goto('/');
  await page.getByText('Enter nsec manually').click();
  const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
  await page.getByPlaceholder('nsec1...').fill(validNsec);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForSelector('main[role="main"]', { timeout: 10000 });
}
```

**Usage:**

```typescript
test('should show feed after login', async ({ page }) => {
  await loginWithNsec(page);

  const feed = await page.locator('.feed');
  await expect(feed).toBeVisible();
});
```

### Viewport Helper

```typescript
const viewports = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 800 },
  { name: 'Large Desktop', width: 1920, height: 1080 }
];

for (const viewport of viewports) {
  test(`should work on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });

    await page.goto('/');
    // Test responsive behavior
  });
}
```

### Dark Mode Helper

```typescript
async function enableDarkMode(page: any) {
  const settingsBtn = page.locator('button', { hasText: 'Settings' });
  await settingsBtn.click();
  await page.waitForTimeout(300);

  const darkModeBtn = page.locator('button:has-text("Dark")');
  await darkModeBtn.click();
  await page.waitForTimeout(300);

  // Verify dark mode active
  const theme = await page.evaluate(() => document.body.getAttribute('data-theme'));
  expect(theme).toBe('dark');
}
```

### Wait Helpers

```typescript
// Wait for element to be visible
await page.waitForSelector('.element', { state: 'visible' });

// Wait for network idle
await page.waitForLoadState('networkidle');

// Wait for specific timeout
await page.waitForTimeout(500);

// Wait for function to return true
await page.waitForFunction(() => {
  return document.querySelector('.element')?.classList.contains('loaded');
});
```

---

## Debugging Tests

### Visual Debugging

**Run in headed mode:**

```bash
pnpm e2e --headed
```

**Run in debug mode (step through):**

```bash
pnpm e2e --debug
```

**Slow down execution:**

```typescript
test.use({
  launchOptions: {
    slowMo: 1000 // 1 second delay between actions
  }
});
```

### Screenshot Debugging

**Take screenshot at any point:**

```typescript
test('debugging test', async ({ page }) => {
  await page.goto('/');

  // Take screenshot
  await page.screenshot({ path: 'debug-1.png' });

  await page.click('.button');

  // Take another screenshot
  await page.screenshot({ path: 'debug-2.png' });
});
```

**Full page screenshot:**

```typescript
await page.screenshot({
  path: 'debug-full.png',
  fullPage: true
});
```

### Console Logging

**Listen to console messages:**

```typescript
test('should not have console errors', async ({ page }) => {
  const consoleMessages: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleMessages.push(msg.text());
    }
  });

  await page.goto('/');

  expect(consoleMessages).toEqual([]);
});
```

### Network Debugging

**Log all network requests:**

```typescript
page.on('request', (request) => {
  console.log('>>', request.method(), request.url());
});

page.on('response', (response) => {
  console.log('<<', response.status(), response.url());
});
```

### Trace Viewer

**Record trace:**

```bash
pnpm e2e --trace on
```

**View trace:**

```bash
npx playwright show-trace trace.zip
```

The trace viewer shows:

- Timeline of actions
- Screenshots at each step
- Network activity
- Console logs
- DOM snapshots

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/playwright.yml`:

```yaml
name: Playwright Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: |
          cd apps/gallery
          pnpm install

      - name: Install Playwright Browsers
        run: |
          cd apps/gallery
          pnpm exec playwright install --with-deps

      - name: Run Playwright tests
        run: |
          cd apps/gallery
          pnpm e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: apps/gallery/playwright-report/
          retention-days: 30
```

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "Running design tests before commit..."

cd apps/gallery
pnpm e2e tests/design-review.spec.ts --workers=1

if [ $? -ne 0 ]; then
  echo "❌ Design tests failed. Please fix before committing."
  exit 1
fi

echo "✅ Design tests passed!"
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

### PR Quality Gates

**Require tests to pass before merge:**

1. Add to GitHub branch protection rules
2. Require status check "Playwright Tests" to pass
3. Prevent merging if tests fail

---

## Troubleshooting

### Common Issues

#### 1. Tests timing out

**Problem:**

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded
```

**Solutions:**

```typescript
// Increase timeout
await page.waitForSelector('.element', { timeout: 30000 });

// Wait for element to be visible (not just present)
await page.waitForSelector('.element', { state: 'visible' });

// Use more specific selector
await page.waitForSelector('main[role="main"]'); // Better
await page.waitForSelector('text=NostrStack'); // Can fail on mobile
```

#### 2. Element not clickable

**Problem:**

```
Error: Element is not visible
```

**Solutions:**

```typescript
// Wait for element to be visible
await element.waitFor({ state: 'visible' });

// Scroll into view
await element.scrollIntoViewIfNeeded();

// Use force click (bypass actionability checks)
await element.click({ force: true });

// Close blocking dialogs first
const dialog = page.locator('[role="dialog"]');
if (await dialog.isVisible()) {
  await dialog.locator('button[aria-label="Close"]').click();
}
```

#### 3. Flaky tests

**Problem:** Tests pass sometimes, fail other times

**Solutions:**

```typescript
// Add waits for animations
await page.waitForTimeout(300);

// Wait for network to settle
await page.waitForLoadState('networkidle');

// Use retry logic
await expect(async () => {
  const text = await page.textContent('.element');
  expect(text).toBe('Expected');
}).toPass();

// Increase test timeout
test.setTimeout(60000); // 60 seconds
```

#### 4. Screenshot comparison failures

**Problem:**

```
235 pixels (ratio 0.02 of all image pixels) are different
```

**Solutions:**

```typescript
// Increase threshold
await expect(page).toHaveScreenshot('baseline.png', {
  maxDiffPixels: 500, // Allow more pixel differences
  threshold: 0.3 // 30% threshold
});

// Wait for animations to complete
await page.waitForTimeout(500);

// Hide dynamic content
await page.addStyleTag({
  content: '.timestamp { visibility: hidden; }'
});

// Use specific viewport
await page.setViewportSize({ width: 1280, height: 800 });
```

#### 5. Accessibility scan false positives

**Problem:** Axe reports violations that aren't actually issues

**Solutions:**

```typescript
// Disable specific rules
await new AxeBuilder({ page })
  .disableRules(['color-contrast']) // If using non-standard colors
  .analyze();

// Exclude specific elements
await new AxeBuilder({ page }).exclude('.third-party-component').analyze();

// Use specific tags only
await new AxeBuilder({ page })
  .withTags(['wcag2aa']) // Only check WCAG AA
  .analyze();
```

---

## Best Practices Summary

### ✅ Do's

1. **Run tests before committing**
2. **Write tests for new features**
3. **Use descriptive test names**
4. **Test across multiple viewports**
5. **Include accessibility scans**
6. **Update visual baselines intentionally**
7. **Use helpers for common tasks**
8. **Add proper waits for async operations**
9. **Test all component states**
10. **Review test failures carefully**

### ❌ Don'ts

1. **Don't skip failing tests**
2. **Don't use arbitrary timeouts without reason**
3. **Don't test implementation details**
4. **Don't update baselines without review**
5. **Don't ignore accessibility violations**
6. **Don't use selectors that break on mobile**
7. **Don't forget to test dark mode**
8. **Don't commit with failing tests**
9. **Don't test external dependencies**
10. **Don't make tests dependent on each other**

---

## Resources

### Documentation

- [Playwright Docs](https://playwright.dev/)
- [Axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Our Test Report](./COMPREHENSIVE_TEST_REPORT.md)

### Tools

- [Playwright VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)
- [Axe DevTools](https://www.deque.com/axe/devtools/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)

### Examples

All examples can be found in:

- `tests/design-review.spec.ts`
- `tests/ultra-design-review.spec.ts`

---

## Changelog

### Version 2.0 (2026-01-06)

- Added ultra-deep design review suite
- Expanded to 60 total tests
- Added visual regression testing
- Added dark mode testing
- Achieved 100% pass rate
- Added comprehensive documentation

### Version 1.0 (Initial)

- Created basic design review suite
- 27 tests covering core functionality
- Accessibility testing with axe-core
- Responsive testing across viewports

---

## Support

**Questions or issues?**

1. Check this guide first
2. Review existing tests for examples
3. Check Playwright documentation
4. Open an issue with details

**Contributing:**

1. Write tests for new features
2. Maintain existing tests
3. Update documentation
4. Share learnings with team

---

**Happy Testing! 🎭**
