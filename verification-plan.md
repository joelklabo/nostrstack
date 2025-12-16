# Verification Plan

## Automated Verification (CI/CD)

The primary verification method is the automated E2E test suite using Playwright.

1. **Build**: Ensure `pnpm build` passes for all packages.
2. **Unit Tests**: Run `pnpm test` to verify `packages/blog-kit` logic (Auth, PostEditor).
3. **E2E Tests**: Run `pnpm --filter gallery exec playwright test tests/social-flow.spec.ts`.
   - Verifies Login (NSEC).
   - Verifies Feed rendering.
   - Verifies Navigation to Profile.
   - Verifies Posting flow (UI state changes).

## Manual Verification (Local Dev)

To verify manually during development:

1. **Start Dev Server**:
   ```bash
   pnpm dev
   ```
   This starts the API (port 3001) and Gallery (port 4173).

2. **Login**:
   - Open `http://localhost:4173`.
   - Select "MANUAL_OVERRIDE (NSEC)".
   - Enter a valid nsec (e.g. `nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5`).
   - Click "EXECUTE".

3. **Feed & Posting**:
   - Confirm "STREAMING_LIVE_EVENTS..." appears.
   - Type in the "WHAT ARE YOU HACKING ON?..." box.
   - Click "PUBLISH_EVENT".
   - Confirm status updates to "Signing event..." -> "Event published".

4. **Telemetry**:
   - Open the browser console or check the "SYSTEM_TELEMETRY" sidebar (if enabled).
   - Verify connection messages to relays (`wss://relay.damus.io`).

5. **Lightning (Zaps)**:
   - On a feed item, click "⚡ ZAP".
   - Confirm the Zap modal appears with a QR code.
   - (Optional) Pay the invoice if you have a wallet connected to the same network context, or just verify the UI flow.

6. **Paywall**:
   - Verify that some content might be blurred (if `paywall` tag is present on events, mostly relevant for testing with specific seeded data).