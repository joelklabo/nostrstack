import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
const page = await browser.newPage();

page.on('console', msg => {
  const txt = msg.text();
  if (/localhost:3002/i.test(txt) || /bitcoin.status/i.test(txt) || msg.type() === 'error') {
    console.log(`console:${msg.type()}: ${txt}`);
  }
});

page.on('request', req => {
  const url = req.url();
  if (url.includes('/api/bitcoin/status') || url.includes('localhost:3002')) {
    console.log('request:', url);
  }
});

await page.goto('https://localhost:4175/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Browse as guest/i }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);
await browser.close();
