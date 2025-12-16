# Contributing to NostrStack

Thank you for your interest in contributing to NostrStack! We welcome contributions from the community.

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/nostrstack.git
    cd nostrstack
    ```
3.  **Install dependencies**:
    ```bash
    pnpm install
    ```

## Development Workflow

-   **Start Dev Servers**:
    ```bash
    pnpm dev
    ```
    This starts both the API (`http://localhost:3001`) and the Gallery (`http://localhost:4173`).

-   **Run Tests**:
    -   Unit tests: `pnpm test`
    -   End-to-End tests: `pnpm --filter gallery exec playwright test`

-   **Linting & Formatting**:
    ```bash
    pnpm lint
    pnpm format
    ```

## Project Structure

-   `apps/gallery`: The main social network frontend (React/Vite).
-   `apps/api`: The backend API (Fastify/Node.js).
-   `packages/blog-kit`: Reusable React components (`PostEditor`, `ZapButton`, `Auth`).
-   `packages/embed`: Core embedding logic and non-React widgets.
-   `packages/sdk`: The TypeScript SDK for interacting with the API.

## Submitting a Pull Request

1.  Create a new branch for your feature or fix.
2.  Make your changes and ensure tests pass.
3.  Commit your changes with descriptive messages (we follow Conventional Commits).
4.  Push your branch to your fork.
5.  Open a Pull Request against the `main` branch of the original repository.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
