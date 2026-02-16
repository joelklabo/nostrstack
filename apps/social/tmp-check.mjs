import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('https://localhost:4173', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /(Enter nsec manually|Enter private key manually)/i }).first().click();
  await page.getByPlaceholder('nsec1...').fill('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('.feed-stream').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);

  const onboardingVisible = await page.locator('[data-testid="onboarding-card"]').isVisible().catch(() => false);
  console.log('onboardingVisible', onboardingVisible);

  const menu = page.locator('.hamburger-btn');
  await menu.click({ timeout: 10000 });

  const overlay = page.locator('.sidebar-overlay').first();
  await overlay.waitFor({ state: 'visible', timeout: 8000 });
  const styles = await overlay.evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      className: el.className,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      visibility: cs.visibility,
      display: cs.display,
      disabled: el.disabled
    };
  });
  const target = await overlay.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.max(24, r.width - 24), y: r.top + 24 };
  });
  const topElement = await page.evaluate(({x,y}) => {
    const el = document.elementFromPoint(x, y);
    return el ? { tag: el.tagName, id: el.id, className: el.className, text: el.textContent?.slice(0,40) } : null;
  }, target);
  const onboardPe = await page.evaluate(() => {
    const card = document.querySelector('.onboarding-card');
    const dismiss = document.querySelector('.onboarding-dismiss');
    const ov = document.querySelector('.onboarding-overlay');
    const sp = document.querySelector('.onboarding-spotlight');
    return {
      bodyClass: document.body.className,
      cardClass: card?.className,
      cardPe: card ? getComputedStyle(card).pointerEvents : null,
      dismissPe: dismiss ? getComputedStyle(dismiss).pointerEvents : null,
      ovPe: ov ? getComputedStyle(ov).pointerEvents : null,
      spPe: sp ? getComputedStyle(sp).pointerEvents : null
    };
  });
  console.log('styles', styles);
  console.log('target', target, 'topElement', topElement);
  console.log('onboarding pointer events', onboardPe);

  const clickResult = await overlay
    .click({ timeout: 2500, position: target, force: true })
    .then(() => ({ ok: true }))
    .catch((error) => ({ ok: false, message: error.message }));
  console.log('clickResult', clickResult);

  const sidebarOpen = await page.locator('.sidebar-nav').evaluate((el) => el.classList.contains('is-open'));
  console.log('sidebarOpenAfter', sidebarOpen, 'menuExp', await menu.getAttribute('aria-expanded'));
  await browser.close();
})();
