# Contributing to NostrStack

Thank you for your interest in contributing to NostrStack! We welcome contributions from the community.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/your-username/nostrstack.git
   cd nostrstack
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

## Development Workflow

- **Start Dev Servers**:

  ```bash
  pnpm dev
  ```

  This starts both the API (`https://localhost:3001`) and the Social app (`https://localhost:4173`).

- **Run Tests**:

  - Unit tests: `pnpm test`
  - Read-only cache-safe tests: `pnpm test:ci` (sets `VITEST_CACHE_DIR` to a writable temp directory)
  - End-to-End tests: `pnpm --filter social exec playwright test`

- **Command Conventions**:

  - App-level: `dev:api`, `dev:social`, `dev:docs`
  - CI-safe: `test:ci`
  - Local one-command checks: `pnpm check`

- **Linting & Formatting**:

  ```bash
  pnpm lint
  pnpm format
  ```

- **Storybook (Component Development)**:

  ```bash
  # Run Storybook dev server
  pnpm --filter social storybook

  # Build Storybook static site
  pnpm --filter social build-storybook
  ```

  Storybook provides an isolated environment for developing and testing UI components.

## Project Structure

- `apps/api`: The backend API (Fastify/Node.js).
- `apps/social`: The main social network frontend (React/Vite).
- `apps/docs`: Internal docs website and references.
- `packages/react`: Reusable React components (`PostEditor`, `ZapButton`, `Auth`).
- `packages/widgets`: Core embedding logic and script-tag widgets.
- `packages/sdk`: The TypeScript SDK for interacting with the API.

## Submitting a Pull Request

1. Create a new branch for your feature or fix.
2. Make your changes and ensure tests pass.
3. Commit your changes with descriptive messages (we follow Conventional Commits).
4. Push your branch to your fork.
5. Open a Pull Request against the `main` branch of the original repository.

## Accessibility Guidelines

We follow **WCAG 2.1 Level AA** standards for all user interfaces. When submitting PRs that affect UI:

1. **Run accessibility tests**: `pnpm --filter social exec playwright test accessibility.spec.ts`
2. **Test with keyboard only**: Navigate your changes using Tab, Enter, and Escape
3. **Check color contrast**: Use browser DevTools or [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
4. **Add ARIA attributes**: Labels, roles, live regions, states (see `docs/accessibility.md`)
5. **Review Storybook a11y**: Check the "Accessibility" tab in Storybook for violations

For detailed guidelines, patterns, and checklists, see:

- **[docs/accessibility.md](docs/accessibility.md)** - Complete accessibility documentation
- **[apps/social/tests/README.md](apps/social/tests/README.md)** - Testing guide
- **[docs/commands.md](docs/commands.md)** - Canonical command reference
- **[docs/project-structure.md](docs/project-structure.md)** - Workspace map and ownership

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
