import { chromium } from '@playwright/test';

const BASE_URL = process.env.GALLERY_BASE_URL || 'https://localhost:4183';
const SK = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByText('Enter nsec manually').click();
  await page.getByPlaceholder('nsec1...').fill(SK);
  await page.getByRole('button', { name: 'Sign in with private key' }).click();
  await page.waitForSelector('main[role="main"]', { timeout: 12000 });
}

function layerProbe(points) {
  return points.map((p) => {
    const el = document.elementFromPoint(p.x, p.y);
    const style = el ? getComputedStyle(el) : null;
    return {
      ...p,
      tag: el?.tagName ?? null,
      cls: el?.className ?? null,
      pointerEvents: style?.pointerEvents ?? null
    };
  });
}

async function stateSnapshot(page) {
  return page.evaluate(() => {
    const feed = document.querySelector('.feed-container');
    const menu = document.querySelector('.hamburger-btn');
    const header = document.querySelector('.feed-header');
    const filter = document.querySelector('button[aria-label*="Latest posts"]');
    const layout = document.querySelector('.social-layout');
    const overlay = document.querySelector('.sidebar-overlay');

    const rowNodes = Array.from(document.querySelectorAll('.virtualized-row[data-virtualized-item]')).slice(0, 12);
    const rows = rowNodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        key: node.getAttribute('data-virtualized-item'),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height)
      };
    });

    return {
      scrollTop: feed?.scrollTop ?? -1,
      scrollHeight: feed?.scrollHeight ?? -1,
      clientHeight: feed?.clientHeight ?? -1,
      layoutClass: layout?.className ?? '',
      menuPointerEvents: menu ? getComputedStyle(menu).pointerEvents : '',
      menuOpacity: menu ? getComputedStyle(menu).opacity : '',
      headerPointerEvents: header ? getComputedStyle(header).pointerEvents : '',
      filterVisible: filter
        ? getComputedStyle(filter).display !== 'none' &&
          getComputedStyle(filter).visibility !== 'hidden' &&
          filter.offsetParent !== null
        : false,
      overlayVisible: overlay ? getComputedStyle(overlay).opacity !== '0' : false,
      overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : '',
      rows
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await login(page);

    const canScroll = await page.$eval('.feed-container', (el) => el.scrollHeight > el.clientHeight + 20);
    console.log('CAN_SCROLL', canScroll);

    const initialState = await stateSnapshot(page);
    const initialLayers = await page.evaluate(
      layerProbe,
      [
        { name: 'content-center', x: 195, y: 380 },
        { name: 'left-edge', x: 20, y: 380 },
        { name: 'right-edge', x: 370, y: 380 },
        { name: 'hamburger', x: 22, y: 28 },
        { name: 'feed-filter', x: 320, y: 200 }
      ]
    );

    console.log('INITIAL', JSON.stringify({ state: initialState, layers: initialLayers }));

    if (canScroll) {
      const steps = [180, 360, 540, 720, 900];
      for (const top of steps) {
        await page.$eval('.feed-container', (el, t) => {
          el.scrollTop = t;
        }, top);
        await page.waitForTimeout(180);
        const state = await stateSnapshot(page);
        const layers = await page.evaluate(
          layerProbe,
          [
            { name: 'content-center', x: 195, y: 380 },
            { name: 'left-edge', x: 20, y: 380 },
            { name: 'right-edge', x: 370, y: 380 },
            { name: 'hamburger', x: 22, y: 28 },
            { name: 'feed-filter', x: 320, y: 200 }
          ]
        );
        console.log(`SCROLL_${top}`, JSON.stringify({ state, layers }));
      }

      await page.$eval('.feed-container', (el) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(140);
      const returnState = await stateSnapshot(page);
      console.log('RETURN', JSON.stringify(returnState));
    }

    const finalRows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.virtualized-row[data-virtualized-item]')).slice(0, 12).map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          key: node.getAttribute('data-virtualized-item'),
          top: Math.round(rect.top),
          height: Math.round(rect.height)
        };
      })
    );
    console.log('FINAL_ROWS', JSON.stringify(finalRows));
  } catch (err) {
    console.error('PROBE_ERROR', err?.stack || String(err));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
