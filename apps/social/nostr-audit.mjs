import { chromium } from '@playwright/test';

const url = 'http://localhost:5600/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

const consoleMsgs = [];
page.on('console', (msg) => {
  consoleMsgs.push({ type: msg.type(), text: msg.text() });
});

const reqErrors = [];
page.on('requestfailed', (req) => {
  reqErrors.push({
    url: req.url(),
    method: req.method(),
    failure: req.failure() ? req.failure().errorText : 'unknown',
  });
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(1200);

const buttons = await page.locator('button').all();
const links = await page.locator('a').all();

const summary = {
  buttons: buttons.length,
  links: links.length,
  inputs: await page.locator('input, textarea, select').count(),
};

const labels = [];
for (const b of buttons) {
  const text = (await b.textContent())?.trim() || '[unlabeled]';
  const disabled = await b.isDisabled();
  labels.push(`button:${text}:disabled=${disabled}`);
}

const clickErrors = [];
for (const b of buttons) {
  const text = (await b.textContent())?.trim();
  if (!text) continue;
  if (!(await b.isVisible().catch(() => false))) continue;
  try {
    await b.click({ timeout: 800 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `/tmp/nostrstack-click-${text.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'btn'}.png`, fullPage: true });
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(400);
  } catch (err) {
    clickErrors.push({ text, message: String(err) });
  }
}

await page.screenshot({ path: '/tmp/nostrstack-playwright-final.png', fullPage: true });
await browser.close();

console.log(JSON.stringify({ summary, labels, consoleMsgs, reqErrors, clickErrors }));
