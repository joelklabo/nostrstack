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

  This starts both the API (`http://localhost:3001`) and the Gallery (`http://localhost:4173`).

- **Run Tests**:

  - Unit tests: `pnpm test`
  - End-to-End tests: `pnpm --filter gallery exec playwright test`

- **Linting & Formatting**:

  ```bash
  pnpm lint
  pnpm format
  ```

- **Storybook (Component Development)**:

  ```bash
  # Run Storybook dev server
  pnpm --filter gallery storybook

  # Build Storybook static site
  pnpm --filter gallery build-storybook
  ```

  Storybook provides an isolated environment for developing and testing UI components.

## Project Structure

- `apps/gallery`: The main social network frontend (React/Vite).
- `apps/api`: The backend API (Fastify/Node.js).
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

1. **Run accessibility tests**: `pnpm --filter gallery exec playwright test accessibility.spec.ts`
2. **Test with keyboard only**: Navigate your changes using Tab, Enter, and Escape
3. **Check color contrast**: Use browser DevTools or [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
4. **Add ARIA attributes**: Labels, roles, live regions, states (see `docs/accessibility.md`)
5. **Review Storybook a11y**: Check the "Accessibility" tab in Storybook for violations

For detailed guidelines, patterns, and checklists, see:

- **[docs/accessibility.md](docs/accessibility.md)** - Complete accessibility documentation
- **[apps/gallery/tests/README.md](apps/gallery/tests/README.md)** - Testing guide

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
