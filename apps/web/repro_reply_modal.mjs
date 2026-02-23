import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:5300';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
await page.setViewportSize({ width: 1400, height: 900 });

const guestBtn = page.getByRole('button', { name: 'Browse as Guest' });
if ((await guestBtn.count()) > 0) {
  await guestBtn.click();
}
await page.waitForTimeout(2000);

console.log('url', page.url());
const bodyText = await page.textContent('body');
console.log('hasFeedStream', !!(await page.locator('.feed-stream').count()));
console.log('cards', await page.locator('[data-testid="web-event-card"]').count());
console.log('replyBtnCount', await page.getByTestId('web-event-reply').count());
console.log('copyBtnCount', await page.getByTestId('web-event-copy-link').count());
console.log('threadBtnCount', await page.getByTestId('web-event-thread').count());
console.log('text preview', (bodyText || '').slice(0, 500));
await page.screenshot({ path: '/tmp/reply_state3.png', fullPage: true });
await browser.close();
