/* eslint-env node */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'http://localhost:4173';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function getDevServerPort() {
  return process.env.DEV_SERVER_PORT || null;
}

function parseSessionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fields = {};
  for (const line of content.split('\n')) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    fields[key] = value;
  }
  return fields;
}

function pidAlive(pidText) {
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function resolveManagedGalleryUrl() {
  const sessionsDir = path.join(REPO_ROOT, '.logs', 'dev', 'sessions');
  if (!fs.existsSync(sessionsDir)) return null;
  const requestedAgent = (process.env.NOSTRDEV_AGENT || '').trim();
  const files = fs
    .readdirSync(sessionsDir)
    .filter((name) => name.endsWith('.session'))
    .map((name) => path.join(sessionsDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const file of files) {
    try {
      const fields = parseSessionFile(file);
      if (!pidAlive(fields.NOSTRDEV_SESSION_PID)) continue;
      if (requestedAgent && fields.NOSTRDEV_SESSION_AGENT !== requestedAgent) continue;
      const port = Number(fields.NOSTRDEV_SESSION_SOCIAL_PORT);
      if (Number.isInteger(port) && port > 0) {
        return `http://localhost:${port}`;
      }
    } catch {
      // Ignore unreadable/stale session files and continue fallback resolution.
    }
  }
  return null;
}

const devServerPort = getDevServerPort();
const devServerFallback = devServerPort ? `http://localhost:${devServerPort}` : null;
const BASE_URL =
  process.env.GALLERY_URL || resolveManagedGalleryUrl() || devServerFallback || DEFAULT_BASE_URL;
const BASE_ORIGIN = new URL(BASE_URL).origin;
const TEST_NSEC =
  process.env.TEST_NSEC || 'nsec1v0fhzv8swp7gax4kn8ux6p5wj2ljz32xj0v2ssuxvck5aa0d8xxslue67d';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = async (fn) => {
  try {
    return await fn();
  } catch {
    return null;
  }
};
const uniq = (items) => [...new Set((items || []).filter(Boolean))];

const findings = { interactions: [] };

const results = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  requestFailures: [],
  response404: []
};

function shouldIgnoreRequestFailure(req) {
  const url = req.url();
  if (!url.startsWith(BASE_ORIGIN)) return true;
  if (url.includes('/api/logs/stream')) return true;

  const err = req.failure()?.errorText || '';
  if (err !== 'net::ERR_ABORTED' && err !== 'net::ERR_NETWORK_IO_SUSPENDED') {
    return false;
  }

  // Direct route navigation can abort superseded document fetches.
  if (req.resourceType() === 'document') {
    return true;
  }

  // Local dev health probes are short-lived and may be cancelled during route changes.
  // Also ignore wallet WebSocket health check - it returns 503 when wallet is not configured.
  if (url.includes('/api/health') || url.includes('/debug/ws-wallet')) {
    return true;
  }

  return false;
}

async function clickMaybe(locator, opts) {
  return safe(() => locator.first().click(opts));
}

async function waitMaybe(locator, opts) {
  return safe(() => locator.waitFor(opts));
}

async function interactOnFeed(page) {
  await clickMaybe(page.getByRole('button', { name: 'All' }));
  findings.interactions.push('clicked-feed-view-all');
  await clickMaybe(page.getByRole('button', { name: 'Following' }));
  findings.interactions.push('clicked-feed-view-following');
  await clickMaybe(page.getByRole('button', { name: /Trending 4h/i }));
  findings.interactions.push('clicked-feed-view-trending');
  await clickMaybe(page.getByRole('button', { name: /(Latest|Chronological)/i }));
  findings.interactions.push('toggled-feed-sort');
  await clickMaybe(page.getByRole('button', { name: /^🛡️|On|Off/ }));
  findings.interactions.push('toggled-spam-filter');
  await clickMaybe(page.getByRole('button', { name: /Search posts and profiles/i }));

  const thread = page.getByTestId('social-event-thread').first();
  if ((await thread.count()) > 0) {
    await thread.click().catch(() => {});
    findings.interactions.push('opened-post-thread');
    if (/\/nostr\//.test(page.url())) {
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }
  }

  await clickMaybe(page.getByTestId('social-event-reply').first());
  findings.interactions.push('opened-reply-modal');
  const replyTextarea = page.getByRole('textbox', { name: 'Reply content' }).first();
  if ((await replyTextarea.count()) > 0) {
    await replyTextarea.fill('UI test reply').catch(() => {});
    await clickMaybe(page.getByRole('button', { name: 'Cancel editing' }));
    findings.interactions.push('closed-reply-modal');
  }

  await clickMaybe(page.getByTestId('social-event-copy-link').first());
  findings.interactions.push('copied-post-link');
  await clickMaybe(page.getByTestId('social-event-source-toggle').first());
  findings.interactions.push('opened-post-source-json');
  await clickMaybe(page.getByTestId('social-event-source-toggle').first());
  findings.interactions.push('closed-post-source-json');

  await clickMaybe(page.getByRole('button', { name: /Load more posts|Load more/i }).first());
  findings.interactions.push('load-more-clicked');

  const writeBtn = page.getByRole('button', { name: /Write your first post/i }).first();
  if ((await writeBtn.count()) > 0) {
    await writeBtn.click().catch(() => {});
    findings.interactions.push('write-first-post');
    const editor = page.getByRole('textbox', { name: 'Note content' }).first();
    if ((await editor.count()) > 0) {
      await editor.fill('Hello from audit automation').catch(() => {});
      await clickMaybe(page.getByRole('button', { name: 'Publish' }).first());
      findings.interactions.push('attempt-publish');
    }
  }

  await clickMaybe(page.getByRole('button', { name: /Find friend/i }));
  findings.interactions.push('clicked-find-friend-card');
}

async function interactOnSearch(page) {
  const query = page.getByLabel('Search query').first();
  if ((await query.count()) === 0) return;
  await query.fill('bitcoin').catch(() => {});
  await clickMaybe(page.getByRole('button', { name: 'Search' }).first());
  findings.interactions.push('search-keyword');
  await wait(600);

  await clickMaybe(page.getByRole('button', { name: 'Retry search' }));
  findings.interactions.push('search-retry');

  await query.fill('alice').catch(() => {});
  await clickMaybe(page.getByRole('button', { name: 'Search' }).first());
  findings.interactions.push('search-identity');
  await wait(800);

  const openProfile = page.getByRole('button', { name: /Open profile for/i }).first();
  if ((await openProfile.count()) > 0) {
    await openProfile.click().catch(() => {});
    findings.interactions.push('open-profile-from-search');
    await wait(600);
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  await clickMaybe(page.getByRole('button', { name: 'Load More' }).first());
  findings.interactions.push('search-load-more');
}

async function interactOnOffers(page) {
  const description = page.getByLabel('Description').first();
  if ((await description.count()) === 0) return;
  await description.fill('Audit offer').catch(() => {});
  await clickMaybe(page.getByRole('button', { name: 'Create Offer' }));
  findings.interactions.push('create-offer');
  await clickMaybe(page.getByRole('button', { name: 'Request Invoice' }).first());
  findings.interactions.push('request-offer-invoice');

  const copyBtn = page.getByRole('button', { name: /Copy/i }).first();
  await clickMaybe(copyBtn);
  findings.interactions.push('copy-offer');
}

async function interactOnSettings(page) {
  await clickMaybe(page.getByRole('button', { name: /Theme:/i }).first());
  findings.interactions.push('toggle-theme');
  await clickMaybe(page.getByRole('button', { name: /MIDNIGHT/i }));
  findings.interactions.push('select-brand-preset');
  await clickMaybe(page.getByRole('button', { name: 'Restart Tour' }));
  findings.interactions.push('restart-tour');
  await clickMaybe(page.getByRole('button', { name: 'Enable Notifications' }));
  findings.interactions.push('enable-notifications');

  const uri = page.getByLabel('Connection String');
  if ((await uri.count()) > 0) {
    await uri.fill('nostr+walletconnect://bad').catch(() => {});
    await clickMaybe(page.getByRole('button', { name: 'Connect' }).first());
    findings.interactions.push('attempt-nwc-connect');
    await clickMaybe(page.getByRole('button', { name: 'Check Balance' }).first());
    findings.interactions.push('attempt-nwc-balance');
    await clickMaybe(page.getByRole('checkbox', { name: /Remember on this device/i }));
    findings.interactions.push('toggle-nwc-remember');
    await clickMaybe(page.getByRole('button', { name: 'Disconnect' }));
    findings.interactions.push('disconnect-nwc');
  }
}

async function interactOnProfile(page) {
  await clickMaybe(page.getByRole('button', { name: 'Edit Profile' }));
  findings.interactions.push('edit-profile');
  const isProfileRoute = page.url().includes('/profile') || page.url().includes('/p/');
  if (!isProfileRoute) {
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }
  await clickMaybe(page.getByRole('button', { name: 'Copy npub' }).first());
  findings.interactions.push('copy-npub');
  await clickMaybe(
    page.getByRole('button', { name: /Follow this user|Following|Unfollow this user/i }).first()
  );
  findings.interactions.push('toggle-follow');
  await clickMaybe(page.getByRole('button', { name: /Mute this user|UNMUTE/i }).first());
  findings.interactions.push('toggle-mute');
  await clickMaybe(page.getByRole('button', { name: /Load More|LOAD MORE/i }).first());
  findings.interactions.push('profile-load-more');
}

async function interactSidebar(page) {
  await page.setViewportSize({ width: 375, height: 844 });
  await clickMaybe(page.getByRole('button', { name: 'Open menu' }));
  findings.interactions.push('open-mobile-menu');
  await clickMaybe(page.getByRole('button', { name: /Help/i }));
  findings.interactions.push('open-help');
  await clickMaybe(page.locator('.sidebar-overlay'));
  findings.interactions.push('close-mobile-overlay');
  await page.setViewportSize({ width: 1365, height: 2000 });
}

(async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text());
    if (msg.type() === 'warning' || msg.type() === 'warn') results.consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => results.pageErrors.push(String(err.message || err)));
  page.on('requestfailed', (req) => {
    if (shouldIgnoreRequestFailure(req)) return;
    const url = req.url();
    const err = req.failure()?.errorText || 'unknown';
    results.requestFailures.push(`${url} :: ${err}`);
  });
  page.on('response', (res) => {
    if (res.status() === 404) {
      const url = res.url();
      if (url.startsWith(BASE_ORIGIN)) {
        results.response404.push(url);
      }
    }
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const hasSignIn = page.getByRole('heading', { name: /Sign in to NostrStack/i });
    if ((await hasSignIn.count()) > 0) {
      const enterNsec = page.getByRole('button', { name: /Enter private key manually/i });
      await enterNsec.click({ timeout: 2000 }).catch(() => {});
      const input = page.getByPlaceholder('nsec1...');
      await input.fill(TEST_NSEC).catch(() => {});
      const signIn = page.getByRole('button', { name: /Sign in/i }).first();
      await signIn.click().catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    } else {
      await clickMaybe(page.getByRole('button', { name: /Browse as Guest/i }));
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    await wait(1000);

    await page.screenshot({ path: '/tmp/qa-post-login.png', fullPage: true });

    await clickMaybe(page.getByRole('button', { name: 'Feed' }).first());
    await page.waitForTimeout(500);
    await interactOnFeed(page);
    await page.screenshot({ path: '/tmp/qa-feed.png', fullPage: true });

    await clickMaybe(page.getByRole('button', { name: 'Find friend' }).first());
    await page.waitForTimeout(500);
    await interactOnSearch(page);
    await page.screenshot({ path: '/tmp/qa-search.png', fullPage: true });

    await clickMaybe(page.getByRole('button', { name: 'Offers' }).first());
    await page.waitForTimeout(500);
    await interactOnOffers(page);
    await page.screenshot({ path: '/tmp/qa-offers.png', fullPage: true });

    await clickMaybe(page.getByRole('button', { name: 'Settings' }).first());
    await page.waitForTimeout(500);
    await interactOnSettings(page);
    await page.screenshot({ path: '/tmp/qa-settings.png', fullPage: true });

    await clickMaybe(page.getByRole('button', { name: 'Profile' }).first());
    await page.waitForTimeout(600);
    await interactOnProfile(page);
    await page.screenshot({ path: '/tmp/qa-profile.png', fullPage: true });

    await interactSidebar(page);
    await page.screenshot({ path: '/tmp/qa-final.png', fullPage: true });
  } catch (err) {
    results.pageErrors.push(String(err?.message || err));
  }

  const payload = {
    issues: []
  };
  const stepDump = JSON.stringify({
    interactions: findings.interactions,
    url: page.url(),
    timestamp: new Date().toISOString()
  });

  const log = (title, severity, area, expected, actual, labels = ['ui-audit']) => {
    payload.issues.push({
      title,
      severity,
      area,
      steps_to_reproduce: stepDump,
      expected,
      actual,
      labels,
      body: `${title}:\n${actual}`
    });
  };

  const consoleErrors = uniq(results.consoleErrors);
  const consoleWarnings = uniq(results.consoleWarnings);
  const pageErrors = uniq(results.pageErrors);
  const requestFailures = uniq(results.requestFailures);
  const response404 = uniq(results.response404);

  if (consoleErrors.length)
    log(
      'Browser console errors observed during UI interaction',
      'medium',
      'console',
      'No console error output in normal interactions.',
      consoleErrors.join('\n')
    );
  if (pageErrors.length)
    log(
      'Page runtime errors detected',
      'high',
      'console',
      'No uncaught exceptions on valid interaction flow.',
      pageErrors.join('\n')
    );
  if (requestFailures.length)
    log(
      'Failed local requests observed during audit',
      'high',
      'network',
      'Local page/API requests should succeed for expected assets and actions.',
      requestFailures.join('\n')
    );
  if (response404.length)
    log(
      '404 responses observed during audit',
      'low',
      'network',
      'Navigation should not trigger unexpected 404 responses.',
      response404.join('\n')
    );
  if (consoleWarnings.length)
    log(
      'Browser console warnings observed during UI interaction',
      'low',
      'console',
      'No noisy console warnings on main user flows.',
      consoleWarnings.join('\n')
    );

  console.log(JSON.stringify(payload));

  await context.close();
  await browser.close();
})();
