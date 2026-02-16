const { chromium } = require('playwright');

(async () => {
  const base = process.env.BASE_URL || 'https://127.0.0.1:4175';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage({ viewport: { width: 1400, height: 1100 } });

  const state = {
    console: [],
    errors: [],
    requestFailed: [],
    actions: []
  };
  page.on('console', (msg) => state.console.push({ type: msg.type(), text: msg.text(), location: msg.location() }));
  page.on('pageerror', (err) => state.errors.push({ message: err.message, stack: err.stack }));
  page.on('requestfailed', (req) => {
    state.requestFailed.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure(),
      resourceType: req.resourceType(),
    });
  });

  async function act(name, fn) {
    try {
      await fn();
      state.actions.push({ name, status: 'ok' });
    } catch (err) {
      state.actions.push({ name, status: 'error', error: String(err && err.message ? err.message : err) });
    }
  }

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await act('load', async () => {
    if (!(await page.getByRole('button', { name: /Browse as guest|Sign in with Nostr browser extension/ }).count())) {
      throw new Error('Login form missing');
    }
  });

  await act('enter guest', async () => {
    await page.getByRole('button', { name: 'Browse as guest' }).click();
    await page.waitForTimeout(500);
  });

  await act('offers tab', async () => {
    await page.getByRole('button', { name: 'Offers' }).click();
    await page.waitForTimeout(600);
  });

  await act('offer empty submit', async () => {
    await page.getByRole('button', { name: 'Create new BOLT12 offer' }).click();
    await page.waitForTimeout(300);
  });

  await act('settings tab', async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(600);
  });

  await act('toggle theme', async () => {
    const themeBtn = await page.getByRole('button', { name: /Switch to dark mode|Switch to light mode/ });
    await themeBtn.click();
    await page.waitForTimeout(200);
  });

  await act('toggle celebration sound', async () => {
    const soundBtn = page.getByRole('button', { name: /Enable celebration sound|Disable celebration sound/ });
    await soundBtn.click();
    await page.waitForTimeout(200);
  });

  await act('find friend tab', async () => {
    await page.getByRole('button', { name: 'Find friend' }).click();
    await page.getByRole('searchbox', { name: 'Search query' }).fill('alice');
    await page.getByRole('button', { name: 'Execute search' }).click();
    await page.waitForTimeout(500);
  });

  await act('open first post', async () => {
    await page.getByRole('button', { name: /^Open post / }).first().click();
    await page.waitForTimeout(500);
  });

  await act('copy link', async () => {
    const c = page.getByRole('button', { name: 'Copy link to post' }).first();
    if (await c.count()) await c.click();
    await page.waitForTimeout(250);
  });

  await act('search posts sort', async () => {
    await page.getByRole('button', { name: 'Search posts and profiles' }).click();
    await page.waitForTimeout(200);
  });

  await act('search trending', async () => {
    await page.getByRole('button', { name: /Show trending posts|Show all posts/ }).click();
    await page.waitForTimeout(200);
  });

  await page.screenshot({ path: '/tmp/nostr-audit-final.png', fullPage: true });

  console.log('SUMMARY_START');
  console.log(JSON.stringify({
    base,
    actions: state.actions,
    console: state.console,
    errors: state.errors,
    requestFailed: state.requestFailed,
  }, null, 2));
  console.log('SUMMARY_END');

  await browser.close();
})();
