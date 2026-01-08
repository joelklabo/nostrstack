# Nostrstack: High-Value Next Tasks Analysis

**Generated:** 2026-01-06
**Context:** Post Lightning Epic e40 (70+ Storybook stories, Chromatic CI)

## Executive Summary

Nostrstack is in excellent health post-Storybook expansion. With 39 issues (35 closed, 4 blocked on mainnet), comprehensive test coverage (59 unit tests, 25 E2E specs, 17 stories), and a mature CI pipeline, the codebase is primed for feature expansion and quality improvements.

**Recent Wins:**

- Refactored `renderPayToAction` and `renderTipWidget` into modular files.
- Added comprehensive tests for payment widgets.
- Consolidated verification documentation.

## Current State Assessment

### ✅ Strengths

- **Testing Excellence**: 59 unit tests, 25 Playwright E2E specs, 17 Storybook stories
- **CI/CD Maturity**: Chromatic visual regression, Azure staging/prod pipelines
- **Architecture Quality**: Multi-tenant API, clean package separation, Lightning + Nostr integration
- **Documentation**: 30+ docs covering architecture, workflows, UX specs, demo modes
- **Developer Experience**: bd workflow, MCP devtools integration, comprehensive linting

### ⚠️ Gaps Identified

1. **Accessibility**: Only 49 aria-\* attributes across entire codebase
2. **Test Coverage**: Only 2 data-testid attributes (limits test robustness)
3. **Blog-Kit Tests**: 6 test files vs 40 components (15% coverage)
4. **Embed Package Tests**: Still missing tests for `renderCommentWidget`, `relayBadge`, `share`, `blockchainStats`.
5. **Performance**: No formal performance testing or monitoring
6. **API Documentation**: Missing OpenAPI/Swagger comprehensive docs
7. **UI Polish**: ui-audit-findings.md has 10 unresolved UX issues
8. **Component Library**: No formal component catalog beyond Storybook
9. **Data Fetching**: Nostr data fetching logic is duplicated across components.

## Prioritized Opportunities

### 🎯 Tier 1: High Impact, Medium Effort (Start Here)

#### 1. **Complete Embed Modularization**

**Impact:** High (maintainability, testing)
**Effort:** 1-2 days
**Details:**

- Extract `renderCommentWidget` from `packages/embed/src/index.ts` to `packages/embed/src/widgets/commentWidget.ts`.
- Create unit tests: `packages/embed/src/widgets/commentWidget.test.ts`.
- This finishes the modularization epic, leaving `index.ts` as a clean entry point.

**Deliverables:**

- `packages/embed/src/widgets/commentWidget.ts`
- `packages/embed/src/widgets/commentWidget.test.ts`
- Clean `packages/embed/src/index.ts`
- BD Issue: `embed-modularization-complete`

---

#### 2. **Accessibility Audit & Enhancement**

**Impact:** Critical for production readiness, legal compliance  
**Effort:** 2-3 days  
**Details:**

- Add ARIA labels, roles, landmarks to all interactive components
- Implement keyboard navigation for modals, dropdowns, forms
- Add focus management for invoice popover, payment modal, post editor
- Create accessibility E2E tests with Playwright + axe-core
- Document a11y patterns in design system
- Target: WCAG 2.1 AA compliance

**Files to Update:**

- `packages/blog-kit/src/ui/*.tsx` (PaymentModal, SendSats, ReactionButton)
- `apps/gallery/src/*.tsx` (FeedView, SearchView, Sidebar)
- `packages/embed/src/*.ts` (invoicePopover, relayBadge, share)

**Deliverables:**

- BD Issue: `accessibility-aa-wcag` with sub-issues per component category
- Playwright test: `tests/accessibility.spec.ts` with axe violations assertions
- Docs: `docs/accessibility.md` with patterns + testing guide

---

#### 3. **Comprehensive Unit Test Coverage for Blog-Kit**

**Impact:** High (reduces regression risk for most-used package)  
**Effort:** 2-3 days  
**Details:**

- Current: 6 test files for 40 components (15%)
- Target: 80%+ coverage for critical components
- Focus areas:
  - `zap-button.tsx` (no tests, complex Lightning logic)
  - `reaction-button.tsx` (no tests, Nostr event handling)
  - `reply-modal.tsx` (no tests, form validation)
  - `tip-activity-feed.tsx` (no tests, WebSocket state)
  - `blockchain-stats.tsx` (no tests, telemetry parsing)
  - `share-button.tsx` / `share-widget.tsx` (no tests)
  - `offer-widget.tsx` (no tests, BOLT12 flows)

**Approach:**

- Use Vitest + React Testing Library (already in stack)
- Add `data-testid` attributes systematically
- Test user interactions, edge cases, error states
- Mock WebSocket, Nostr relays, API calls

**Deliverables:**

- 10+ new test files in `packages/blog-kit/src/`
- Coverage report showing >80% line/branch coverage
- BD Issue: `blog-kit-test-coverage` with sub-issues per component

---

#### 4. **Finish Embed Package Test Suite**

**Impact:** High (core package for external users)  
**Effort:** 1 day
**Details:**

- Current: Tests exist for `tipWidget`, `payToAction`, `index`.
- Target: Test coverage for remaining modules.
- Focus areas:
  - `invoicePopover.ts` - rendering, copy, QR code display
  - `relayBadge.ts` - connection status updates
  - `share.ts` - Nostr event publishing
  - `blockchainStats.ts` - telemetry data display
  - `qr.ts` - QR generation with presets/branding

**Approach:**

- Use JSDOM for DOM testing (Vitest config exists)
- Mock NostrstackClient API calls

**Deliverables:**

- New test files in `packages/embed/src/`
- E2E embed test in gallery: `apps/gallery/tests/embed-widgets.spec.ts`
- BD Issue: `embed-test-coverage-final`

---

### 🚀 Tier 2: Strategic Features (After Tier 1)

#### 5. **Nostr Data Abstraction (Hooks Library)**

**Impact:** High (developer experience, performance)
**Effort:** 3-4 days
**Details:**

- Current: Components fetch data directly using `SimplePool` or `fetch`.
- Goal: Abstract into reusable React hooks for caching, deduping, and background updates.
- Pattern: Similar to `tanstack-query` but for Nostr events.
- Create `packages/blog-kit/src/hooks/useNostrQuery.ts` (or `useNostrEvents`).

**New Hooks:**

- `useProfile(pubkey)`
- `useFeed(filter)`
- `useThread(rootId)`
- `useZaps(eventId)`

**Deliverables:**

- `packages/blog-kit/src/hooks/*.ts`
- Refactor `PostList`, `ProfileView`, `ThreadView` to use hooks.
- BD Issue: `nostr-data-hooks`

---

#### 6. **Widget Lifecycle Manager**

**Impact:** Medium (maintainability)
**Effort:** 1 day
**Details:**

- `packages/embed/src/index.ts` has repetitive "mount if not mounted, store destroy function" logic.
- Create a `WidgetManager` class or helper to handle:
  - Auto-mounting based on data attributes.
  - Tracking active instances.
  - Clean teardown (destroy).
  - Re-mounting on DOM changes (MutationObserver?).

**Deliverables:**

- `packages/embed/src/core/widgetManager.ts`
- Update `index.ts` to use it.
- BD Issue: `embed-widget-manager`

---

#### 7. **Performance Monitoring & Optimization**

**Impact:** High (production scalability)  
**Effort:** 3-4 days  
**Details:**

- Add Web Vitals tracking (LCP, FID, CLS) to gallery
- Lighthouse CI integration in GitHub Actions
- Bundle size monitoring (track @nostrstack/widgets growth)
- API performance profiling (Fastify + Prometheus)
- Lazy loading for routes, heavy components
- Optimize Nostr relay connection pooling

**Deliverables:**

- `.github/workflows/performance.yml` with Lighthouse CI
- `apps/gallery/src/analytics/web-vitals.ts`
- Bundle size budget in `package.json`
- Docs: `docs/performance.md` with targets + profiling guide
- BD Issue: `performance-monitoring`

---

#### 8. **API Documentation & Developer Portal**

**Impact:** Medium-High (external developer adoption)  
**Effort:** 2-3 days  
**Details:**

- Expand OpenAPI schema (currently minimal)
- Add request/response examples for all endpoints
- Create interactive API explorer (Swagger UI exists but sparse)
- Document webhook flows (LNbits payment callbacks)
- Add authentication guide (tenant API keys, NIP-05)
- SDK usage examples for common patterns

**Deliverables:**

- Enhanced `apps/api/src/openapi.ts` with full schema
- `docs/api-reference.md` with endpoint catalog
- Example scripts in `docs/api-examples/`
- BD Issue: `api-documentation`

---

### 🔧 Tier 3: Technical Debt & Infrastructure

#### 9. **ESLint 9 Migration**

**Impact:** Low-Medium (removes deprecated warnings)  
**Effort:** 1 day  
**Details:**
From `docs/dependencies.md`:

- Migrate from ESLint 8.57 to v9+
- Update @typescript-eslint/\* plugins
- Migrate to flat config format
- Remove deprecated transitive deps

**Deliverables:**

- Updated `packages/config/eslint.config.js`
- Remove `rimraf`, `glob@7`, `inflight` warnings
- BD Issue: `eslint-v9-migration`

---

#### 10. **Knip Configuration Fix**

**Impact:** Low (code quality tooling)  
**Effort:** 0.5 days  
**Details:**

- Fix Vite CJS/ESM issue in `apps/gallery/vitest.config.ts`
- Enable `lint:knip` to catch unused exports
- Add to CI pipeline

**Deliverables:**

- Working `pnpm lint:knip` command
- Add to `lint` script and CI
- BD Issue: `knip-config-fix`

---

## Recommended Execution Plan

### Sprint 1 (Week 1): Embed Finalization & A11y

1. **Complete Embed Modularization** (1 day)
2. **Finish Embed Package Test Suite** (1 day)
3. **Accessibility Audit & Enhancement** (3 days)

**Outcome:** `embed` package is 100% modular and tested; Core UI is accessible.

---

### Sprint 2 (Week 2): Blog-Kit Quality & Data

4. **Comprehensive Unit Test Coverage for Blog-Kit** (3 days)
5. **Nostr Data Abstraction (Hooks)** (2 days)

**Outcome:** Robust React library with clean data fetching patterns.

---

### Sprint 3 (Week 3): Performance & Docs

6. **Performance Monitoring** (3 days)
7. **API Documentation** (2 days)

**Outcome:** Performance visibility, developer-friendly API reference

---

## Conclusion

The extraction of `renderPayToAction` and `renderTipWidget` was a great success. The immediate next step should be **finishing the job** by extracting `renderCommentWidget` and adding the remaining tests for the embed package. This "clears the deck" for the larger accessibility and React-focused tasks.

**Next Action:** Create BD issue `embed-modularization-complete` and assign it.
