# Accessibility Guidelines

This document outlines accessibility standards and best practices for the NostrStack project.

## Overview

### WCAG 2.1 AA Compliance

We target **WCAG 2.1 Level AA** compliance across all user interfaces. This ensures our applications are:
- **Perceivable**: Users can perceive the information being presented
- **Operable**: Users can operate the interface using various input methods
- **Understandable**: Information and interface operation is clear
- **Robust**: Content works with current and future technologies

### Why Accessibility Matters for Nostr/Lightning

Accessibility is critical for decentralized social networks and Lightning payments:

1. **Financial Inclusion**: Lightning payments must be accessible to users with disabilities to fulfill Bitcoin's promise of financial inclusion
2. **Free Speech**: Nostr's censorship-resistant protocol must serve all users, regardless of ability
3. **Global Reach**: 15%+ of the world's population experiences some form of disability—accessibility expands our user base
4. **Legal Compliance**: Many jurisdictions require digital accessibility (ADA, Section 508, EN 301 549)
5. **Better UX for Everyone**: Accessible design benefits all users—keyboard navigation, clear focus indicators, semantic HTML

## Component Patterns

### Modal Dialogs

**Requirements**:
- Focus trap: Tab key cycles within modal
- Auto-focus first interactive element on open
- Escape key closes modal
- Return focus to trigger element on close
- Proper ARIA attributes

**Implementation**:
```tsx
import { useEffect, useRef } from 'react';

export function MyModal({ open, onClose }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Store trigger and auto-focus
  useEffect(() => {
    if (!open) return;
    
    triggerRef.current = document.activeElement as HTMLElement;
    
    const focusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();
    
    return () => {
      if (triggerRef.current) triggerRef.current.focus();
    };
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const modal = modalRef.current;
      if (!modal) return;
      
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      
      if (!focusable.length) return;
      
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <h2 id="modal-title">Modal Title</h2>
        <p id="modal-description">Modal description</p>
        <button onClick={onClose} aria-label="Close modal">×</button>
      </div>
    </div>
  );
}
```

### Form Controls

**Requirements**:
- Every input has an associated `<label>` with `for` attribute
- Use `aria-describedby` for hints and help text
- Use `aria-invalid` for validation errors
- Use `aria-live="assertive"` for error announcements

**Implementation**:
```tsx
<div>
  <label htmlFor="amount-input">Amount (sats)</label>
  <input
    id="amount-input"
    type="number"
    value={amount}
    onChange={e => setAmount(e.target.value)}
    aria-describedby="amount-hint amount-error"
    aria-invalid={hasError}
  />
  <div id="amount-hint" className="hint">
    Enter amount in satoshis
  </div>
  {hasError && (
    <div id="amount-error" className="error" role="alert" aria-live="assertive">
      Amount must be at least 1 sat
    </div>
  )}
</div>
```

### Interactive Buttons

**Requirements**:
- Use `aria-label` for buttons without visible text (icons)
- Use `aria-busy` during loading states
- Use `aria-pressed` for toggle buttons
- Use `aria-disabled` when disabled (not just `disabled` attribute)

**Implementation**:
```tsx
<button
  className="zap-button"
  onClick={handleZap}
  disabled={isLoading || isDisabled}
  aria-label={`Zap ${amount} sats to ${author}`}
  aria-busy={isLoading}
  aria-disabled={isDisabled}
  aria-pressed={isZapped}
>
  {isLoading ? (
    <>
      <span className="spinner" aria-hidden="true" />
      Zapping...
    </>
  ) : (
    `⚡ ${amount}`
  )}
</button>
```

### Live Regions

**Requirements**:
- Use `aria-live="polite"` for status updates
- Use `aria-live="assertive"` for errors
- Use `role="status"` for non-interactive status messages
- Use `role="alert"` for important messages

**Implementation**:
```tsx
{/* Status updates */}
<div role="status" aria-live="polite">
  {status === 'connecting' && 'Connecting to relay...'}
  {status === 'connected' && 'Connected to relay'}
</div>

{/* Error alerts */}
{error && (
  <div role="alert" aria-live="assertive" className="error">
    {error}
  </div>
)}

{/* Payment status */}
<div role="status" aria-busy={isPaying}>
  {isPaying ? 'Processing payment...' : 'Payment complete'}
</div>
```

### Navigation

**Requirements**:
- Use semantic HTML: `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`
- Add `aria-label` to distinguish multiple navigation regions
- Use `aria-current="page"` to indicate current page
- Provide skip links for keyboard users

**Implementation**:
```tsx
{/* Skip link for keyboard users */}
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

{/* Navigation with landmarks */}
<nav aria-label="Main navigation">
  <button
    onClick={() => navigate('/feed')}
    aria-current={currentView === 'feed' ? 'page' : undefined}
  >
    Feed
  </button>
  <button
    onClick={() => navigate('/search')}
    aria-current={currentView === 'search' ? 'page' : undefined}
  >
    Search
  </button>
</nav>

<main id="main-content" role="main" aria-label="Feed stream">
  {/* Main content */}
</main>

<aside aria-label="Wallet and system status">
  {/* Sidebar */}
</aside>
```

## Testing Guide

### Automated Testing

**Run axe-core tests**:
```bash
  cd apps/web
pnpm run e2e accessibility.spec.ts
```

See `apps/web/tests/README.md` for detailed testing documentation.

**What axe-core checks**:
- ARIA attributes validity
- Color contrast ratios
- Form labels and associations
- Heading hierarchy
- Keyboard accessibility
- Landmark usage

### Manual Keyboard Navigation Testing

**Process**:
1. Hide your mouse (put it aside)
2. Use only keyboard to navigate:
   - **Tab**: Move forward
   - **Shift+Tab**: Move backward
   - **Enter/Space**: Activate buttons/links
   - **Escape**: Close modals
   - **Arrow keys**: Navigate within components
3. Verify:
   - All interactive elements are reachable
   - Focus indicator is always visible
   - Tab order is logical
   - Modals trap focus
   - Escape closes modals

**Common issues**:
- Missing `tabindex="0"` on custom interactive elements
- `tabindex="-1"` on elements that should be focusable
- No visible focus indicator (`:focus-visible` styles missing)
- Tab order doesn't match visual order
- Focus lost after actions (modal close, form submit)

### Screen Reader Testing

**macOS - VoiceOver**:
```bash
# Start VoiceOver
Cmd + F5

# Basic commands
Ctrl + Option + Right Arrow  # Next item
Ctrl + Option + Left Arrow   # Previous item
Ctrl + Option + Space        # Activate item
```

**Windows - NVDA** (free):
Download from: https://www.nvaccess.org/download/

**What to test**:
- All images have `alt` text
- Buttons announce their purpose
- Form inputs announce their labels
- Status updates are announced (aria-live)
- Modals announce title and description
- Navigation landmarks are announced

### Lighthouse Accessibility Audits

**Run in Chrome DevTools**:
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Accessibility" category
4. Click "Analyze page load"

**Target score**: 95-100

**Common issues flagged**:
- Missing alternative text for images
- Low color contrast ratios
- Form elements without labels
- Missing ARIA attributes
- Duplicate IDs
- Missing page `<title>`

## Checklist for New Components

Use this checklist when creating or modifying components:

### ARIA Attributes

- [ ] Interactive elements have descriptive `aria-label` (if no visible text)
- [ ] Modals have `role="dialog"` and `aria-modal="true"`
- [ ] Modals have `aria-labelledby` and `aria-describedby`
- [ ] Form inputs have associated `<label>` elements
- [ ] Form errors use `aria-describedby` and `aria-invalid`
- [ ] Loading states use `aria-busy="true"`
- [ ] Toggle buttons use `aria-pressed`
- [ ] Disabled elements use `aria-disabled`
- [ ] Status updates use `role="status"` and `aria-live="polite"`
- [ ] Error alerts use `role="alert"` and `aria-live="assertive"`
- [ ] Decorative icons use `aria-hidden="true"`

### Keyboard Interaction

- [ ] All interactive elements are keyboard accessible (Tab)
- [ ] Custom interactive elements have `tabindex="0"`
- [ ] Modals trap focus (Tab cycles within modal)
- [ ] Escape key closes modals
- [ ] Focus returns to trigger element after modal closes
- [ ] Enter/Space activates buttons
- [ ] Arrow keys work for custom widgets (carousels, menus)

### Focus Management

- [ ] Visible focus indicator on all interactive elements
- [ ] Focus indicator meets 3:1 contrast ratio with background
- [ ] Focus automatically moves to first input on modal open
- [ ] Focus restored to trigger element on modal close
- [ ] Focus not lost after actions (form submit, delete)

### Color Contrast

- [ ] Normal text: 4.5:1 contrast ratio minimum
- [ ] Large text (18pt+ or 14pt+ bold): 3:1 contrast ratio minimum
- [ ] Interactive elements: 3:1 contrast ratio for focus indicators
- [ ] Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

### Semantic HTML

- [ ] Use `<button>` for actions, `<a>` for links
- [ ] Use `<nav>` for navigation regions
- [ ] Use `<main>` for primary content
- [ ] Use `<aside>` for sidebars
- [ ] Use `<header>` and `<footer>` where appropriate
- [ ] Use heading hierarchy (`<h1>` → `<h2>` → `<h3>`)

### Testing

- [ ] Run axe-core tests: `pnpm run e2e accessibility.spec.ts`
- [ ] Test with keyboard only (Tab, Enter, Escape)
- [ ] Test with screen reader (VoiceOver or NVDA)
- [ ] Run Lighthouse accessibility audit (95+ score)
- [ ] Verify color contrast with browser DevTools

## Resources

### Official Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Testing Tools
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse in Chrome DevTools](https://developer.chrome.com/docs/lighthouse/overview/)

### Screen Readers
- [VoiceOver (macOS)](https://www.apple.com/accessibility/voiceover/) - Built-in
- [NVDA (Windows)](https://www.nvaccess.org/) - Free
- [JAWS (Windows)](https://www.freedomscientific.com/products/software/jaws/) - Commercial

### Learning Resources
- [WebAIM Articles](https://webaim.org/articles/)
- [A11ycasts on YouTube](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g)
- [Inclusive Components](https://inclusive-components.design/)
- [The A11Y Project](https://www.a11yproject.com/)

### React-Specific
- [React Accessibility Docs](https://react.dev/learn/accessibility)
- [React Aria (Adobe)](https://react-spectrum.adobe.com/react-aria/)
- [Reach UI](https://reach.tech/) - Accessible component library

## Contributing

When submitting PRs that affect UI:

1. **Run accessibility tests**: `pnpm run e2e accessibility.spec.ts`
2. **Test with keyboard**: Navigate your changes using only Tab, Enter, and Escape
3. **Check color contrast**: Use browser DevTools or WebAIM checker
4. **Update Storybook**: Add accessibility examples to component stories
5. **Document patterns**: Update this guide if introducing new patterns

### Storybook Integration

Our Storybook includes the [@storybook/addon-a11y](https://storybook.js.org/addons/@storybook/addon-a11y) addon for real-time accessibility checks:

```bash
pnpm run storybook
```

Open any story and check the "Accessibility" tab to see violations and passes.

## Contact

For accessibility questions or to report issues:
- Open an issue with the `accessibility` label
- Tag `@a11y` in PR comments for review
- See `CONTRIBUTING.md` for general contribution guidelines

---

**Last updated**: January 2026  
**Standard**: WCAG 2.1 Level AA  
**Next review**: Quarterly
