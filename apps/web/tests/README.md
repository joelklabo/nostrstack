# Accessibility Testing

This directory contains comprehensive E2E accessibility tests using Playwright and axe-core.

## Test Coverage

### WCAG 2.1 AA Compliance

- **Page Scans**: Automated axe-core scans on all major pages (login, feed, search)
- **Keyboard Navigation**: Tab order, focus management, keyboard shortcuts
- **Focus Management**: Modal focus traps, return focus on close
- **ARIA Attributes**: Live regions, labels, descriptions, states
- **Form Validation**: Proper labels and error associations
- **Landmarks**: Navigation, main content, regions
- **Color Contrast**: WCAG AA (4.5:1 for normal text, 3:1 for large text)

## Running Tests Locally

### All accessibility tests

```bash
cd apps/web
pnpm run e2e accessibility.spec.ts
```

### Specific test suites

```bash
# Page scans only
pnpm run e2e accessibility.spec.ts --grep "Page Scans"

# Keyboard navigation tests
pnpm run e2e accessibility.spec.ts --grep "Keyboard Navigation"

# Modal focus management
pnpm run e2e accessibility.spec.ts --grep "Modal Focus"

# Color contrast
pnpm run e2e accessibility.spec.ts --grep "Color Contrast"
```

### Debug mode (headed browser)

```bash
pnpm run e2e accessibility.spec.ts --headed --debug
```

### Test report

```bash
# Run tests with HTML report
pnpm run e2e accessibility.spec.ts --reporter=html

# View report
npx playwright show-report
```

## Authentication-Required Tests

Many tests require authentication to access protected pages. When running locally without auth setup, these tests will be **skipped** with a message like:

```text
Skipping modal test - authentication required
```

This is expected behavior. In CI, these tests run against a real environment with auth configured.

## Test Failures

### Common Issues

**Color Contrast Violations**:

- Check `--color-fg-muted` and other CSS variables
- Use browser DevTools to inspect computed colors
- Target: 4.5:1 for normal text, 3:1 for large text (18pt+)

**Missing ARIA Attributes**:

- Add `aria-label` to buttons without visible text
- Use `aria-describedby` for form hints/errors
- Set `role="status"` or `role="alert"` for dynamic content
- Add `aria-busy` to loading states

**Focus Management**:

- Modals must trap focus (Tab cycles within modal)
- Auto-focus first focusable element on open
- Return focus to trigger element on close
- Use `modalRef.current.focus()` to manage focus programmatically

**Keyboard Navigation**:

- All interactive elements must be reachable by Tab
- Add keyboard shortcuts for common actions
- Prevent default on arrow keys in custom widgets
- Use `tabindex="-1"` to exclude elements from Tab order

### Debugging Test Failures

1. **Run in headed mode** to see what's happening:

   ```bash
   pnpm run e2e accessibility.spec.ts --headed
   ```

2. **Check axe-core violations** in test output:

   ```text
   expect(accessibilityScanResults.violations).toEqual([]);
   ```

   Look for `violations` array with details on what failed.

3. **Use Playwright trace viewer**:

   ```bash
   pnpm run e2e accessibility.spec.ts --trace on
   npx playwright show-trace test-results/.../trace.zip
   ```

4. **Manual testing**:
   - Use **VoiceOver** (macOS): Cmd+F5
   - Use **NVDA** (Windows): Free screen reader
   - Test with **keyboard only** (no mouse)
   - Use **Lighthouse** in Chrome DevTools

## Adding New Tests

### Template for new page scan

```typescript
test('New page has no accessibility violations', async ({ page }) => {
  await page.goto('/new-page');
  await page.waitForSelector('.page-container', { timeout: 5000 });

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

### Template for keyboard navigation

```typescript
test('Component supports keyboard navigation', async ({ page }) => {
  await page.goto('/page');
  await page.waitForSelector('.component', { timeout: 5000 });

  // Tab to first button
  await page.keyboard.press('Tab');
  const firstButton = page.locator('button').first();
  await expect(firstButton).toBeFocused();

  // Test interaction
  await page.keyboard.press('Enter');
  // ... assertions
});
```

### Template for modal focus trap

```typescript
test('Modal traps focus', async ({ page }) => {
  await page.goto('/');

  // Open modal
  await page.click('button:has-text("Open Modal")');
  await page.waitForSelector('[role="dialog"]', { timeout: 2000 });

  const modal = page.locator('[role="dialog"]');
  const buttons = modal.locator('button');

  // Tab through all buttons
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab');
  }

  // Focus should wrap to first button
  await expect(buttons.first()).toBeFocused();
});
```

## CI Integration

Tests run automatically on every PR via GitHub Actions (`.github/workflows/ci.yml`).

View results at: `https://github.com/your-org/nostrstack/actions`

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [Playwright Docs](https://playwright.dev/docs/intro)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Accessibility Documentation

See `docs/accessibility.md` for:

- Component patterns and guidelines
- Manual testing procedures
- Checklist for new components
- Team accessibility standards
