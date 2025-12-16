# Plan: NostrStack Social Network

## Iteration 1: Mental Draft & Critique

### Concept
Build a "bare bones" but "nerd hacker" style Nostr social network hosted at `nostrstack.com`. It will serve as a showcase for the `nostrstack` SDK and a functional social app.

### Architecture
- **Frontend:** Expand `apps/gallery` into the full site. Rename to `apps/web`? Or keep `gallery` as the component showcase and build a new `apps/social`. *Decision:* `apps/gallery` is already the "demo site". It has a lot of boilerplate. I will **evolve** `apps/gallery` into the social network to save time, but re-brand it heavily.
- **Backend:** `apps/api` handles LNURL, Zaps (NIP-57), and Paywalls.
- **Packages:**
    - `packages/embed`: Core UI widgets (Tips, Paywalls, Comments).
    - `packages/blog-kit`: React components for blogs/social.
    - `packages/sdk`: Client logic.

### Key Features
1.  **Feed:** Global timeline (kind 1), user profiles (kind 0).
2.  **Auth:** NIP-07 (primary) + "Login with nsec" (fallback, encrypted local storage).
3.  **Zaps:**
    -   *Sending:* Use `nostr-tools` + NIP-07 to zap posts.
    -   *Receiving:* The `apps/api` needs to act as a Lightning Service Provider (LSP) for the site's users? Or just for the site owner? *Constraint:* The prompt says "incorporate into other sites". So `apps/api` is likely the *platform* backend. Users on `nostrstack.com` might just be visiting. *Wait*, "authenticate with a browser extension... full profiles". This implies a full client.
    -   *Zap Receipt:* If I zap someone *else*, their LSP handles it. If I want to *receive* zaps on my profile *on this site*, I need a Lightning Address. The site could provision one (`user@nostrstack.com`) via `apps/api`, mapped to an internal LNbits wallet or just a forwarder? *Complexity:* Provisioning wallets for every user is hard.
    -   *Simplification:* For this "bare bones" site, maybe we just display the user's *existing* lud16/lightning address from their profile and facilitate zapping them. We don't need to *host* their wallet unless they opt-in (which `apps/api` supports via multi-tenancy, but let's stick to client-side zapping first).

4.  **Paywall Feature:** "Selling paywalled content". Users can post "premium" notes? Or just the site has premium content? "Selling" implies users can sell.
    -   *Mechanism:* Encrypt content (NIP-04 or similar) or just hide it. Payment unlocks it.
    -   *Implementation:* A "Pay to Unlock" component wrapper.

5.  **Aesthetic:** "Nerd Hacker".
    -   Terminal font (Fira Code, JetBrains Mono).
    -   High contrast (Green/Black, Amber/Black).
    -   Raw JSON toggles everywhere.
    -   Live WebSocket telemetry visible.

### Critique 1
-   **Scope:** Building a *full* multi-user wallet provider is too big. Focus on being a *client* that *uses* Nostr + Lightning. The "selling" part can be done by users providing an LNURL, and the client handling the flow.
-   **Security:** "Storing nsec". I must implement a robust encrypted local storage mechanism if I do this. NIP-07 is preferred.
-   **Reuse:** The "SDK" requirement means I should double-down on `packages/blog-kit` or create `packages/social-kit`.

---

## Iteration 2: Refined Plan

### Goals
1.  **Deploy Target:** `apps/gallery` -> `nostrstack.com`.
2.  **Theme:** Cyberpunk/Terminal.
3.  **Core Components:**
    -   `ZapButton`: Handles NIP-57 flow.
    -   `Feed`: Virtualized list of events.
    -   `Profile`: Metadata + Feed.
    -   `Editor`: Post text + "Premium" toggle (L402/Paywall).

### Architecture Adjustments
-   **Backend:** `apps/api` will primarily serve as the *Platform* backend (providing the "nostrstack.com" lightning address for the *site owner* or for *demos*). For general users, we just read their profile metadata.
-   **Auth:** Implement a `Signer` class that wraps NIP-07 and LocalNsec.
-   **State:** Use `nostr-tools/SimplePool` or `ndk` (if available, otherwise stick to tools) for fetching. `apps/gallery` already has `useMountWidgets` which uses `packages/embed`. I should probably move more logic *out* of `embed` into `sdk` or `social-kit` if it's purely React.
-   *Correction:* `packages/embed` is vanilla JS. `packages/blog-kit` is React. I should build the social components in `packages/blog-kit` (maybe rename to `packages/react` eventually, but `blog-kit` is fine for now) and use them in `apps/gallery`.

### Detailed Features
1.  **Dashboard:** The main view. Left sidebar: Nav (Feed, Global, Me, Settings). Center: Feed. Right: Telemetry/Zaps stream.
2.  **Feed Item:**
    -   Header: Author info (picture, name, nip05).
    -   Body: Text (markdown parsed).
    -   Actions: Reply, Repost, Like, **ZAP**.
    -   *Hacker Mode:* Toggle to show raw event JSON.
3.  **Zap Flow:**
    -   Click Zap -> Fetch user's lud16 -> Fetch LNURL -> Get Invoice -> Open Invoice (or NIP-07 WebLN pay).
4.  **Paywall Feature:**
    -   When posting, user can select "Paywall".
    -   *Challenge:* How to enforce? Client-side hidden? Or server-side?
    -   *Real Logic:* Real paywalls require a server holding the secret. `apps/api` has `PayToUnlock`. I will implement a demo where *I* (the site admin) post paywalled content via the Admin UI, and users pay to see it. User-to-user paywalls are too complex for "bare bones" (requires holding secrets for users).

---

## Iteration 3: Final Plan

### Project Structure
-   **`apps/gallery`**: The "NostrStack Social" app.
-   **`packages/blog-kit`**: The reusable React UI library. Will add `Feed`, `ZapButton`, `Login` components here.
-   **`apps/api`**: The Lightning/Nostr backend.

### Visual Style ("Nerd Mode")
-   **Font:** Monospace (e.g., 'Courier New', 'Fira Code').
-   **Colors:** Dark mode default. Neon accents.
-   **Layout:** Dense, data-heavy.
-   **Telemetry:** A constant running log of WebSocket events (relays, zaps) in a "terminal" window at the bottom or side.

### Step-by-Step Implementation
1.  **Setup & Cleanup:**
    -   Clean up `apps/gallery` to be a Single Page App (SPA) structure, not just a widget demo.
    -   Ensure `packages/blog-kit` exports necessary components.
    *Status: Initial refactor complete.*
2.  **Authentication:**
    -   Create `AuthContext` in `blog-kit`.
    -   Support NIP-07 (window.nostr).
    -   Support "Encrypted Nsec" (using `nostr-tools/nip49`? or simple AES with user password).
    *Status: `AuthContext` and NIP-07/nsec login implemented.*
3.  **Feed Component (`blog-kit`):**
    -   Fetch Global Feed (kinds 1).
    -   Render events.
    -   "Hacker View": Button to expand raw JSON.
    *Status: Basic global feed implemented with PostItem and JSON toggle.*
4.  **Interaction Components (`blog-kit`):**
    -   `ZapButton`: Resolves LNURL from event author, requests invoice, displays QR/WebLN.
    -   `ShareButton`: Already exists.
    *Status: `ZapButton` implemented.*
5.  **User Profiles (`apps/gallery`):**
    -   `ProfileView`: Display user metadata (kind 0) and notes (kind 1).
    *Status: `ProfileView` implemented and integrated.*
6.  **Paywall Integration:**
    -   Use the existing `PayToUnlockCard` logic but styled for the social feed.
    -   Create a "Premium Post" type.
    *Status: `PaywalledContent` component implemented and integrated into `FeedView`.*
7.  **Site Assembly (`apps/gallery`):**
    -   Assemble the components into the "NostrStack" layout.
    -   Add the "Telemetry Console".
    *Status: `TelemetryBar` implemented with real data from `apps/api`.*
8.  **Testing:**
    -   Unit tests for new `blog-kit` components.
    -   E2E (Playwright) for the full flow: Login -> Scroll Feed -> Zap.
    *Status: Tests verified and passing.*

### Deployment
-   Ensure `pnpm build` works for `apps/gallery`.
-   The "deployment" step in the prompt is "site is DEPLOYED on nostrstack.com". I will verify the build artifacts and simulation. I cannot *actually* push to Cloudflare/Azure from here without credentials, but I will prepare the scripts and verify the *local* production build works perfectly.
    *Status: Build artifacts verified. DEPLOY.md created.*
