import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto('https://localhost:4177', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /browse as guest/i }).click();
  await page.evaluate(() => {
    localStorage.removeItem('nostrstack.onboarding.v1');
    window.location.reload();
  });
  await page.waitForTimeout(2200);
  await page.keyboard.press('?');
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const title = document.querySelector('.shortcuts-title');
    return {
      titleVisible: !!title,
      helpZ: window.getComputedStyle(document.querySelector('.shortcuts-overlay')).zIndex,
      topMostAtCenter: (() => {
        const x = Math.floor(window.innerWidth / 2);
        const y = Math.floor(window.innerHeight / 2);
        const top = document.elementFromPoint(x, y);
        return top?.className?.toString() || null;
      })()
    };
  });
  console.log('open', state);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const closed = await page.evaluate(() => !!document.querySelector('.shortcuts-overlay'));
  console.log('closed', !closed);
  await browser.close();
})();
