# Nostrstack: High-Value Next Tasks Analysis
**Generated:** 2025-01-05
**Context:** Post Lightning Epic e40 (70+ Storybook stories, Chromatic CI)

## Executive Summary
Nostrstack is in excellent health post-Storybook expansion. With 39 issues (35 closed, 4 blocked on mainnet), comprehensive test coverage (59 unit tests, 25 E2E specs, 17 stories), and a mature CI pipeline, the codebase is primed for feature expansion and quality improvements.

## Current State Assessment

### ✅ Strengths
- **Testing Excellence**: 59 unit tests, 25 Playwright E2E specs, 17 Storybook stories
- **CI/CD Maturity**: Chromatic visual regression, Azure staging/prod pipelines
- **Architecture Quality**: Multi-tenant API, clean package separation, Lightning + Nostr integration
- **Documentation**: 30+ docs covering architecture, workflows, UX specs, demo modes
- **Developer Experience**: bd workflow, MCP devtools integration, comprehensive linting

### ⚠️ Gaps Identified
1. **Accessibility**: Only 49 aria-* attributes across entire codebase
2. **Test Coverage**: Only 2 data-testid attributes (limits test robustness)
3. **Blog-Kit Tests**: 6 test files vs 40 components (15% coverage)
4. **Embed Package Tests**: Only 1 test file (index.test.ts)
5. **Performance**: No formal performance testing or monitoring
6. **API Documentation**: Missing OpenAPI/Swagger comprehensive docs
7. **UI Polish**: ui-audit-findings.md has 10 unresolved UX issues
8. **Component Library**: No formal component catalog beyond Storybook

## Prioritized Opportunities

### 🎯 Tier 1: High Impact, Medium Effort (Start Here)

#### 1. **Accessibility Audit & Enhancement** 
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

#### 2. **Comprehensive Unit Test Coverage for Blog-Kit**
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

#### 3. **UI Audit Findings Implementation**
**Impact:** High (improves UX quality for production)  
**Effort:** 2-3 days  
**Details:**
From `docs/ui-audit-findings.md`:

**High Priority:**
- [ ] Post content markdown rendering (linkification, newlines)
- [ ] Empty wallet state with onboarding copy
- [ ] Zap feedback with local optimistic UI

**Medium Priority:**
- [ ] Relay status visibility improvements
- [ ] Search result sparse profile enrichment
- [ ] Identity resolver debounce UX smoothing

**Low Priority:**
- [ ] Telemetry bar log limit configuration
- [ ] JSON view syntax highlighting
- [ ] Navigation transition improvements

**Deliverables:**
- Update `packages/blog-kit/src/post-editor.tsx` with markdown rendering
- Add empty states to `apps/gallery/src/WalletView.tsx`
- Implement optimistic zap updates in feed
- BD Issue: `ui-audit-polish` with sub-issues per finding

---

#### 4. **Embed Package Test Suite**
**Impact:** High (core package for external users)  
**Effort:** 2 days  
**Details:**
- Current: 1 test file (`index.test.ts`)
- Target: Test coverage for all exported widgets
- Focus areas:
  - `invoicePopover.ts` - rendering, copy, QR code display
  - `relayBadge.ts` - connection status updates
  - `share.ts` - Nostr event publishing
  - `blockchainStats.ts` - telemetry data display
  - `qr.ts` - QR generation with presets/branding
  - `themePresets.ts` - CSS var generation

**Approach:**
- Use JSDOM for DOM testing (Vitest config exists)
- Test auto-mount behavior from data attributes
- Verify theme token application
- Mock NostrstackClient API calls

**Deliverables:**
- 6+ test files in `packages/embed/src/`
- E2E embed test in gallery: `apps/gallery/tests/embed-widgets.spec.ts`
- BD Issue: `embed-test-coverage`

---

### 🚀 Tier 2: Strategic Features (After Tier 1)

#### 5. **Performance Monitoring & Optimization**
**Impact:** High (production scalability)  
**Effort:** 3-4 days  
**Details:**
- Add Web Vitals tracking (LCP, FID, CLS) to gallery
- Lighthouse CI integration in GitHub Actions
- Bundle size monitoring (track @nostrstack/embed growth)
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

#### 6. **API Documentation & Developer Portal**
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

#### 7. **Personal Site Kit Expansion**
**Impact:** High (core value proposition)  
**Effort:** 4-5 days  
**Details:**
From `docs/personal-site-kit.md` (planned components not yet implemented):

**New Widgets:**
- Tip Activity Feed (live feed of recent tips)
- Support Grid Layout (tips + comments + share unified)
- Profile Card (enhanced Nostr profile with relay health)
- Bitcoin Stats Widget (mempool fees, block time, hash rate)
- Share to Nostr button with post preview

**Implementation:**
- Add to `packages/embed/src/` as pure TS/DOM
- Wrap in React components in `packages/blog-kit/src/`
- Add Storybook stories for each widget
- Create comprehensive demo in gallery `/personal-site-kit` route
- Update injector CLI to support new widgets

**Deliverables:**
- 5 new widget files in `packages/embed/src/`
- 5 React wrappers in `packages/blog-kit/src/`
- 5 Storybook stories
- Updated `docs/personal-site-kit.md` with widget catalog
- BD Epic: `personal-site-kit-expansion` with per-widget issues

---

#### 8. **Mobile Responsiveness & Touch Optimization**
**Impact:** Medium-High (user experience)  
**Effort:** 2-3 days  
**Details:**
- Audit all components for mobile breakpoints
- Add touch-specific interactions (swipe, long-press)
- Optimize invoice popover for mobile screens
- Add mobile-specific Storybook viewports
- Test on iOS Safari, Chrome Android

**Deliverables:**
- Mobile E2E tests in Playwright (WebKit + mobile viewport)
- Responsive Storybook stories with mobile viewports
- `docs/mobile-testing.md`
- BD Issue: `mobile-optimization`

---

### 🔧 Tier 3: Technical Debt & Infrastructure

#### 9. **ESLint 9 Migration**
**Impact:** Low-Medium (removes deprecated warnings)  
**Effort:** 1 day  
**Details:**
From `docs/dependencies.md`:
- Migrate from ESLint 8.57 to v9+
- Update @typescript-eslint/* plugins
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

#### 11. **Dependency Audit & Upgrades**
**Impact:** Medium (security, stability)  
**Effort:** 1-2 days  
**Details:**
- Audit deprecated transitive deps
- Upgrade Fastify static (remove `glob@8` warning)
- Upgrade jsdom, node-fetch, shellcheck
- Run `pnpm audit` and resolve high/critical issues
- Update all workspace packages to latest patch versions

**Deliverables:**
- Zero deprecated dependency warnings
- Security audit clean
- Updated `docs/dependencies.md`
- BD Issue: `dependency-upgrades`

---

## Recommended Execution Plan

### Sprint 1 (Week 1): Quality & Accessibility
1. **accessibility-aa-wcag** (3 days)
2. **ui-audit-polish** (2 days)

**Outcome:** Production-ready UX with WCAG AA compliance

---

### Sprint 2 (Week 2): Test Coverage
3. **blog-kit-test-coverage** (3 days)
4. **embed-test-coverage** (2 days)

**Outcome:** 80%+ test coverage across packages, reduced regression risk

---

### Sprint 3 (Week 3): Performance & Docs
5. **performance-monitoring** (3 days)
6. **api-documentation** (2 days)

**Outcome:** Performance visibility, developer-friendly API reference

---

### Sprint 4 (Weeks 4-5): Feature Expansion
7. **personal-site-kit-expansion** (5 days)

**Outcome:** Rich widget library for personal sites, key differentiator

---

### Sprint 5 (Week 6): Polish & Debt
8. **mobile-optimization** (2 days)
9. **eslint-v9-migration** (1 day)
10. **dependency-upgrades** (1 day)
11. **knip-config-fix** (0.5 days)

**Outcome:** Clean codebase, mobile-ready, zero tech debt warnings

---

## Success Metrics

### Quality Gates
- [ ] 80%+ unit test coverage (blog-kit, embed)
- [ ] 0 critical/high security vulnerabilities
- [ ] 0 ESLint/TypeScript errors
- [ ] WCAG 2.1 AA compliance (axe-core)
- [ ] Lighthouse scores: Performance 90+, Accessibility 100

### Feature Completeness
- [ ] Personal Site Kit with 5+ widgets
- [ ] Comprehensive API documentation
- [ ] Mobile-optimized UI (iOS/Android)
- [ ] Performance monitoring dashboard

### Developer Experience
- [ ] All bd issues have clear acceptance criteria
- [ ] Every component has Storybook story
- [ ] CI/CD passing with <10min build time
- [ ] Zero deprecated dependency warnings

---

## Alternative Strategies

### Option A: Wait for Mainnet Cutover
**Pros:** Unblocks 4 issues, enables production Lightning  
**Cons:** External dependency, unknown timeline, idle time  
**Verdict:** ❌ Not recommended - plenty of high-value work available

### Option B: Focus on Marketing/Growth
**Pros:** Drive adoption, get user feedback  
**Cons:** UX gaps + accessibility issues will hurt retention  
**Verdict:** ⚠️ Consider after Sprint 1-2 complete (quality first)

### Option C: New Epic Feature (e.g., AI-powered content)
**Pros:** Differentiator, exciting  
**Cons:** Technical debt + quality gaps undermine innovation  
**Verdict:** ⚠️ Consider after Sprint 1-3 (foundation first)

---

## Conclusion

**Recommendation:** Start with **Tier 1** (Accessibility + Test Coverage + UI Polish) to establish production-grade quality foundation, then expand to **Tier 2** features (Performance + Personal Site Kit) for competitive differentiation.

The codebase is healthy and the Storybook foundation is solid. Now is the perfect time to:
1. **Shore up quality** (a11y, tests, UX polish)
2. **Build competitive features** (widget library, performance)
3. **Clean technical debt** (ESLint, deps, tooling)

This approach balances immediate production readiness with strategic feature development, positioning nostrstack for successful mainnet launch when unblocked.

**Next Action:** Create BD issues for Tier 1 tasks and begin with `accessibility-aa-wcag` epic.
