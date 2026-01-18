# Issue: Test Warnings From JSDOM CSS Parsing and React act()

## Summary

Unit tests emit noisy warnings from JSDOM failing to parse CSS variables and React act() warnings in ShareWidget tests. These warnings are non-fatal but obscure real failures.

## Evidence

- `pnpm test` prints "Could not parse CSS stylesheet" during packages/widgets and apps/social tests.
- `packages/react` tests emit "An update to ShareWidget inside a test was not wrapped in act(...)" warnings.

## Impact

- Test output is noisy and makes failures harder to spot.
- Potentially hides real regressions by flooding logs.

## Proposed Fix

- Adjust test setup to silence or shim CSS parsing for injected theme styles in JSDOM.
- Update ShareWidget tests to wrap state-updating actions in `act(...)`.

## Notes

- The CSS warning appears tied to `ensureNsEmbedStyles` injecting `:where(.ns-theme)` variables in JSDOM.
