# Project Overview

This is a monorepo for a multi-tenant Lightning + Nostr backend with an SDK and embeddable widgets. The project is built with TypeScript and is structured as a pnpm workspace.

The main components are:

*   **`apps/api`**: A Fastify API server that provides the backend services. It uses Prisma as its ORM.
*   **`apps/gallery`**: A demo application built with React and Vite to showcase the SDK and embeddable widgets.
*   **`packages/sdk`**: A typed client for the API.
*   **`packages/embed`**: A browser bundle and widgets.
*   **`packages/config`**: Shared linting and tsconfig configurations.
*   **`deploy/azure`**: Bicep and GitHub Actions pipelines for deploying to Azure Container Apps.

# Building and Running

## Prerequisites

*   pnpm
*   Docker

## Getting Started

1.  **Install dependencies:**

    ```bash
    pnpm install
    ```

2.  **Start the PostgreSQL database:**

    ```bash
    docker compose up -d postgres
    ```

3.  **Set up environment variables:**

    ```bash
    cp apps/api/.env.example .env
    ```

4.  **Run the development servers:**

    This will start the API server and the gallery app in development mode.

    ```bash
    pnpm dev
    ```

## Running in Demo Mode

The project provides several demo modes to run the application with different configurations.

*   **Regtest mode:**

    ```bash
    pnpm demo:regtest
    ```

*   **Mutinynet mode:**

    ```bash
    pnpm demo:mutinynet
    ```

*   **Mainnet mode:**

    ```bash
    pnpm demo:mainnet
    ```

## Building

To build all the packages, run the following command:

```bash
pnpm build
```

# Testing

## Unit Tests

To run the unit tests for all packages, use the following command:

```bash
pnpm test
```

## End-to-End Tests

To run the end-to-end tests for the API, use the following command:

```bash
pnpm e2e
```

# Development Conventions

## Linting

The project uses ESLint for linting the code. To run the linter, use the following command:

```bash
pnpm lint
```

## Formatting

The project uses Prettier for code formatting. To format the code, use the following command:

```bash
pnpm format
```

## Type Checking

The project uses TypeScript for type checking. To run the type checker, use the following command:

```bash
pnpm typecheck
```
