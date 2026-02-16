import { expect, test } from '@playwright/test';

test.describe('Rich Media Rendering', () => {
  test('media CSS classes are available', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Verify that the media container styles are loaded in the browser
    const mediaStyle = await page.evaluate(() => {
      const div = document.createElement('div');
      div.className = 'nostr-media-container';
      document.body.appendChild(div);
      const computed = window.getComputedStyle(div);
      const result = {
        borderRadius: computed.borderRadius,
        overflow: computed.overflow
      };
      document.body.removeChild(div);
      return result;
    });

    expect(mediaStyle.borderRadius).not.toBe('0px'); // Should be 8px from CSS
    expect(mediaStyle.overflow).toBe('hidden');
  });

  test('media image styles are correct', async ({ page }) => {
    await page.goto('/');
    const imgStyle = await page.evaluate(() => {
      const img = document.createElement('img');
      img.className = 'nostr-media-img';
      document.body.appendChild(img);
      const computed = window.getComputedStyle(img);
      const result = {
        maxWidth: computed.maxWidth,
        display: computed.display
      };
      document.body.removeChild(img);
      return result;
    });

    expect(imgStyle.maxWidth).toBe('100%');
    expect(imgStyle.display).toBe('block');
  });

  test('markdown-rendered images reserve stable aspect and sizing', async ({ page }) => {
    await page.goto('/');
    const imageStyle = await page.evaluate(() => {
      const img = document.createElement('img');
      img.className = 'ns-content__image';
      document.body.appendChild(img);
      const computed = window.getComputedStyle(img);
      const result = {
        display: computed.display,
        width: computed.width,
        maxWidth: computed.maxWidth,
        aspectRatio: computed.getPropertyValue('aspect-ratio')
      };
      document.body.removeChild(img);
      return result;
    });

    expect(imageStyle.display).toBe('block');
    expect(imageStyle.maxWidth).toBe('100%');
    expect(imageStyle.width).toBe('100%');
    expect(imageStyle.aspectRatio).toContain('16 / 9');
  });

  test('visual regression check', async ({ page }) => {
    await page.goto('/');

    // Inject a mock post with media to take a screenshot
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.className = 'post-card';
      container.innerHTML = `
            <div class="post-content">
                <p>Check out this image:</p>
                <div class="nostr-media-container">
                    <img src="https://picsum.photos/400/300" class="nostr-media-img" alt="Test Image" />
                </div>
            </div>
        `;
      // Insert at top of feed
      const feed = document.querySelector('.feed-container');
      if (feed) feed.prepend(container);
      else document.body.prepend(container);
    });

    // Wait for image to load
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'docs/screenshots/social/media-embed.png', fullPage: false });
  });
});
