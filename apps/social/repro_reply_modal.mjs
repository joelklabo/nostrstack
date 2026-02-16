import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:5300';
const TEST_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
await page.setViewportSize({ width: 1400, height: 900 });

const loginBtn = page.getByRole('button', { name: /(Enter nsec manually|Enter private key manually)/i });
if ((await loginBtn.count()) > 0) {
  await loginBtn.click().catch(() => {});
  const input = page.getByPlaceholder('nsec1...');
  if ((await input.count()) > 0) {
    await input.fill(TEST_NSEC);
    await page.getByRole('button', { name: 'Sign in' }).click().catch(() => {});
  }
}

await page.waitForTimeout(2000);

const bodyText = await page.textContent('body');
console.log('HAS_WRITE_FIRST', !!/Write your first post/i.test(bodyText || ''));
console.log('HAS_COPY_LINK', !!/Copy link/i.test(bodyText || ''));
console.log('HAS_REPLY', !!/Reply/i.test(bodyText || ''));
console.log('HAS_THREAD', !!/Thread/i.test(bodyText || ''));
console.log('HAS_LOGOUT', !!/Log out/i.test(bodyText || ''));

const candidates = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button'))
    .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim())
    .filter((t) => t)
    .slice(0, 80);
});
console.log('buttons', candidates.join(' | '));

console.log('socialEventCards', await page.locator('[data-testid="social-event-card"]').count());
console.log('noteCards', await page.locator('[data-testid="social-event-copy-link"]').count());

await page.screenshot({ path: '/tmp/reply_state.png', fullPage: true });
await browser.close();
