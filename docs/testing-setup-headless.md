# Testing Setup for Headless Environments

This guide covers running the full UI test suite in headless environments (SSH, Docker, CI/CD) without a display server.

## System Setup

### Prerequisites

```bash
# Check if running headless
echo $DISPLAY  # Empty = headless

# Verify Chrome/Chromium is installed
which chromium chromium-browser google-chrome chrome
chromium --version  # Should show version (e.g., 143.0.7499.109)

# Verify Playwright browsers are installed
cd apps/gallery
pnpm exec playwright install chromium
```

## Chrome DevTools MCP Setup

The MCP scripts now support headless Chrome automatically:

```bash
# Start Chrome with remote debugging (headless mode auto-detected)
./scripts/mcp-chrome.sh

# Verify Chrome is running
curl -s http://127.0.0.1:9222/json/version | jq -r '.Browser'
# Output: Chrome/143.0.7499.109

# Start MCP DevTools server
./scripts/mcp-devtools-server.sh

# Check logs
tail -f .logs/dev/mcp-devtools.log
```

### Environment Variables

```bash
# Force headless mode even with DISPLAY set
MCP_CHROME_HEADLESS=1 ./scripts/mcp-chrome.sh

# Use different port
MCP_CHROME_PORT=9223 ./scripts/mcp-chrome.sh

# Custom profile location
MCP_CHROME_PROFILE=/tmp/my-chrome-profile ./scripts/mcp-chrome.sh

# Restart instead of reusing existing instance
MCP_CHROME_REUSE_EXISTING=0 ./scripts/mcp-chrome.sh
```

## Running UI Tests

### Quick Validation

```bash
# Start dev servers
pnpm dev  # Starts both API and Gallery

# Run accessibility tests (fastest)
cd apps/gallery
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm exec playwright test accessibility --reporter=line

# Expected output:
#   3 passed (5.4s)
#   10 skipped (auth-required tests)
```

### Full Test Suite

```bash
# All Playwright tests
cd apps/gallery
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm exec playwright test --reporter=html

# View report
pnpm exec playwright show-report
```

### Specific Test Categories

```bash
# Accessibility only
pnpm exec playwright test accessibility

# Demo flows
pnpm exec playwright test demo-flows

# Zap modal
pnpm exec playwright test zap-modal

# All tests with specific tag
pnpm exec playwright test --grep "@smoke"
```

## Manual UI Verification

### Using Playwright Directly

```javascript
// test-manual.js
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const context = await browser.newContext({ 
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 }
});
const page = await context.newPage();

// Monitor console
page.on('console', msg => console.log('[CONSOLE]', msg.type(), msg.text()));
page.on('pageerror', err => console.error('[ERROR]', err.message));

// Navigate and interact
await page.goto('https://localhost:4173/');
await page.screenshot({ path: '/tmp/screenshot.png' });

// Check for elements
const hasLogin = await page.getByText('Sign in to NostrStack').isVisible();
console.log('Login page:', hasLogin ? '✅' : '❌');

await browser.close();
```

Run with:
```bash
cd apps/gallery
NODE_TLS_REJECT_UNAUTHORIZED=0 node test-manual.js
```

### Using Chrome DevTools Protocol

With Chrome and MCP server running:

```bash
# Get list of targets
curl -s http://127.0.0.1:9222/json | jq -r '.[0].webSocketDebuggerUrl'

# Open a page
curl -s http://127.0.0.1:9222/json/new?https://localhost:4173/

# Take screenshot via CDP
# (Requires chrome-remote-interface or similar client)
```

## Troubleshooting

### Chrome Won't Start

```bash
# Check if port is in use
lsof -nP -iTCP:9222 -sTCP:LISTEN

# Kill existing Chrome instances
pkill -f "chromium.*remote-debugging-port"

# Restart with clean profile
rm -rf /tmp/chrome-mcp-profile-9222
./scripts/mcp-chrome.sh
```

### Tests Fail with "Not Visible"

```bash
# Increase timeouts in playwright.config.ts
timeout: 60000  # 60 seconds

# Or set via environment
PLAYWRIGHT_TIMEOUT=60000 pnpm exec playwright test
```

### Certificate Errors

```bash
# Gallery uses self-signed certs for HTTPS
NODE_TLS_REJECT_UNAUTHORIZED=0  # Required for tests

# Chrome args (already included in scripts)
--allow-insecure-localhost
--ignore-certificate-errors
```

### API Not Available Errors

These are expected when API server isn't running:

```
ERR_CONNECTION_REFUSED
net::ERR_FAILED
WebSocket connection to 'wss://localhost:3001/ws/telemetry' failed
```

If you need API integration:

```bash
# Terminal 1: Start PostgreSQL if not running
docker compose up postgres -d

# Terminal 2: Start API
cd apps/api
pnpm dev

# Terminal 3: Start Gallery
cd apps/gallery
pnpm dev

# Terminal 4: Run tests
cd apps/gallery
pnpm exec playwright test
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install Playwright
  run: pnpm exec playwright install --with-deps chromium

- name: Start dev servers
  run: |
    pnpm dev &
    sleep 10

- name: Run tests
  env:
    NODE_TLS_REJECT_UNAUTHORIZED: 0
  run: pnpm exec playwright test --reporter=github
```

### Docker

```dockerfile
FROM node:20-bullseye

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libgbm1

# Set headless mode
ENV MCP_CHROME_HEADLESS=1

# Run tests
CMD ["pnpm", "exec", "playwright", "test"]
```

## Current Test Results

✅ **Working:**
- Accessibility tests (3/13 passed, 10 skipped auth-required)
- Login page rendering
- Console error detection
- Screenshot capture
- Headless Chrome with remote debugging
- MCP DevTools server connection

⚠️ **Known Issues:**
- API connection errors (expected when API not running)
- Telemetry WebSocket errors (expected, non-critical)
- Auth-required tests skip without login flow

## Next Steps

To enable full test coverage:

1. **Add authentication helper**: Create `tests/helpers/auth.ts` with test user login
2. **Mock API responses**: Use Playwright request interception for offline testing
3. **Add visual regression**: Integrate Percy or Chromatic for screenshot comparison
4. **Performance tests**: Add Lighthouse CI for performance budgets
5. **E2E flows**: Add complete user journeys (signup → post → zap)

## Resources

- [Playwright Docs](https://playwright.dev/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [MCP DevTools Server](https://www.npmjs.com/package/chrome-devtools-mcp)
- [Accessibility Testing](./accessibility.md)
