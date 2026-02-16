import { chromium } from 'playwright';

const BASE_URL = process.env.GALLERY_URL || 'https://localhost:4177';

const dedupe = (items) => [...new Set((items || []).filter(Boolean))];

const log = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  requestFailures: [],
  response404: []
};

const interactions = [];
const addInter = (name) => interactions.push(name);

const safeClick = async (locator, timeout = 1200) => {
  try {
    await locator.first().click({ timeout });
    return true;
  } catch {
    return false;
  }
};

const safeFill = async (locator, text) => {
  try {
    await locator.first().fill(text);
    return true;
  } catch {
    return false;
  }
};

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
    const text = msg.text();
    if (msg.type() === 'error') log.consoleErrors.push(text);
    if (msg.type() === 'warning' || msg.type() === 'warn') log.consoleWarnings.push(text);
  });
  page.on('pageerror', (error) => log.pageErrors.push(String(error?.message || error)));
  page.on('requestfailed', (request) => {
    const url = request.url();
    const err = request.failure()?.errorText || 'unknown';
    if ((url.startsWith('https://localhost:4177') || url.startsWith('http://localhost:4177')) && !url.includes('/api/logs/stream')) {
      log.requestFailures.push(`${url} :: ${err}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() === 404) {
      const url = response.url();
      if (url.startsWith('https://localhost:4177') || url.startsWith('http://localhost:4177')) {
        log.response404.push(url);
      }
    }
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.screenshot({ path: '/tmp/qa-01-login.png', fullPage: true });

    const guestBtn = page.getByRole('button', { name: /Browse as Guest/i }).first();
    if (await guestBtn.count()) {
      await guestBtn.click({ timeout: 2000 }).catch(() => {});
      addInter('guest-login');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    await page.setViewportSize({ width: 1365, height: 1800 });

    // Feed
    await safeClick(page.getByRole('button', { name: 'Feed' }));
    addInter('open-feed');
    await page.waitForTimeout(250);
    await safeClick(page.getByRole('button', { name: 'All' }));
    addInter('feed-all');
    await safeClick(page.getByRole('button', { name: 'Following' }));
    addInter('feed-following');
    await safeClick(page.getByRole('button', { name: /Trending 4h/i }));
    addInter('feed-trending');
    await safeClick(page.getByRole('button', { name: /(Latest|Chronological)/i }));
    addInter('feed-sort');
    await safeClick(page.getByRole('button', { name: /^🛡️|On|Off/ }));
    addInter('feed-spam-toggle');
    await safeClick(page.getByRole('button', { name: /Search/i, exact: false }));
    addInter('feed-search-btn');
    await safeClick(page.getByRole('button', { name: /Find friend/i }));
    addInter('feed-find-friend-card');

    // Search
    await page.setViewportSize({ width: 1440, height: 1800 });
    await page.goto(`${BASE_URL}/search`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    addInter('navigate-search');
    const query = page.getByLabel('Search query');
    if (await query.count()) {
      await safeFill(query, 'alice');
      await safeClick(page.getByRole('button', { name: 'Search' }));
      addInter('search-submit');
      await page.waitForTimeout(500);
      await safeClick(page.getByRole('button', { name: 'Retry search' }));
      addInter('search-retry');
      const retryMetadata = page.getByRole('button', { name: /Retry profile metadata lookup/i });
      if (await retryMetadata.count()) await retryMetadata.click().catch(() => {});
      await page.getByRole('button', { name: /Open profile for/i }).first().click().catch(() => {});
      addInter('search-open-profile');
    }

    // Offers
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    addInter('navigate-offers');
    const offerDesc = page.getByLabel('Description');
    if (await offerDesc.count()) {
      await safeFill(offerDesc, 'Audit offer');
      await safeClick(page.getByRole('button', { name: 'Create Offer' }));
      addInter('offers-create');
      await page.waitForTimeout(300);
      await safeClick(page.getByRole('button', { name: 'Request Invoice' }).first());
      addInter('offers-request-invoice');
      const invoiceAmount = page.getByLabel(/Amount \(msat\)/i).first();
      await safeFill(invoiceAmount, '');
    }

    // Settings
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    addInter('navigate-settings');
    await safeClick(page.getByRole('button', { name: /Theme:/i }).first());
    addInter('settings-theme');
    await safeClick(page.getByRole('button', { name: /MIDNIGHT/i }));
    addInter('settings-brand');
    await safeClick(page.getByRole('button', { name: 'Restart Tour' }).first());
    addInter('settings-restart-tour');
    await safeClick(page.getByRole('button', { name: 'Enable Notifications' }).first());
    addInter('settings-enable-notifications');
    await safeFill(page.getByLabel('Connection String'), 'nostr+walletconnect://bad');
    await safeFill(page.getByLabel('RELAYS (comma or space separated)'), 'wss://relay.damus.io');
    await safeFill(page.getByLabel('Max Payment'), '1000');
    await safeClick(page.getByRole('button', { name: 'Connect' }));
    addInter('settings-nwc-connect');
    await safeClick(page.getByRole('button', { name: 'Check Balance' }));
    addInter('settings-nwc-check');
    await safeClick(page.getByRole('button', { name: 'Disconnect' }));
    addInter('settings-nwc-disconnect');

    // Profile
    await page.goto(`${BASE_URL}/p/alice`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    addInter('navigate-profile');
    await safeClick(page.getByRole('button', { name: 'Copy npub' }));
    addInter('profile-copy-npub');
    await safeClick(page.getByRole('button', { name: /Follow this user|Following|Unfollow this user/i }));
    addInter('profile-follow');
    await safeClick(page.getByRole('button', { name: /Mute this user|UNMUTE/i }));
    addInter('profile-mute');

    // Sidebar mobile interactions
    await page.setViewportSize({ width: 390, height: 844 });
    addInter('viewport-mobile');
    await safeClick(page.getByRole('button', { name: /Open menu/i }));
    addInter('mobile-open-menu');
    await safeClick(page.getByRole('button', { name: /Help/i }));
    addInter('mobile-help');
    await safeClick(page.locator('.sidebar-overlay'));
    addInter('mobile-overlay-close');

    await page.screenshot({ path: '/tmp/qa-final.png', fullPage: true });
  } catch (error) {
    log.pageErrors.push(String(error?.message || error));
  }

  const result = { issues: [] };
  const steps = JSON.stringify({
    interactions,
    path: BASE_URL,
    timestamp: new Date().toISOString()
  });

  const uniqLog = (name) => dedupe(log[name]);

  if (uniqLog('consoleErrors').length) {
    result.issues.push({
      title: 'Browser console errors during standard UI flow',
      severity: 'high',
      area: 'console',
      steps_to_reproduce: steps,
      expected: 'No console errors during normal interaction flow.',
      actual: uniqLog('consoleErrors').join('\n'),
      labels: ['ui-audit'],
      body: uniqLog('consoleErrors').join('\n')
    });
  }

  if (uniqLog('consoleWarnings').length) {
    result.issues.push({
      title: 'Browser console warnings during standard UI flow',
      severity: 'low',
      area: 'console',
      steps_to_reproduce: steps,
      expected: 'No actionable console warnings during normal flow.',
      actual: uniqLog('consoleWarnings').join('\n'),
      labels: ['ui-audit'],
      body: uniqLog('consoleWarnings').join('\n')
    });
  }

  if (uniqLog('pageErrors').length) {
    result.issues.push({
      title: 'Runtime page exceptions observed',
      severity: 'high',
      area: 'console',
      steps_to_reproduce: steps,
      expected: 'No runtime exceptions while interacting with major views.',
      actual: uniqLog('pageErrors').join('\n'),
      labels: ['ui-audit'],
      body: uniqLog('pageErrors').join('\n')
    });
  }

  if (uniqLog('requestFailures').length) {
    result.issues.push({
      title: 'Network request failures in local UI session',
      severity: 'medium',
      area: 'network',
      steps_to_reproduce: steps,
      expected: 'Requests should succeed for primary app endpoints.',
      actual: uniqLog('requestFailures').join('\n'),
      labels: ['ui-audit'],
      body: uniqLog('requestFailures').join('\n')
    });
  }

  if (uniqLog('response404').length) {
    result.issues.push({
      title: 'Unexpected 404 responses observed',
      severity: 'low',
      area: 'network',
      steps_to_reproduce: steps,
      expected: 'No unexpected 404 responses in normal interactions.',
      actual: uniqLog('response404').join('\n'),
      labels: ['ui-audit'],
      body: uniqLog('response404').join('\n')
    });
  }

  console.log(JSON.stringify(result));

  await context.close();
  await browser.close();
})();
