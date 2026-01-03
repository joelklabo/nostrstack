import { expect, type Page, test } from '@playwright/test';
import { nip19 } from 'nostr-tools';

import { buildNostrEventResponse, mockNostrEventApi } from './helpers';

const testNsec =
  process.env.TEST_NSEC || 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

async function loginWithNsec(page: Page) {
  await page.goto('/');
  // If we are already logged in (reused state), we might see Live Feed
  if (await page.getByText('Live Feed').isVisible()) return;

  // Sometimes we land on welcome screen
  const manual = page.getByText('Enter nsec manually');
  if (await manual.isVisible()) {
    await manual.click();
    await page.getByPlaceholder('nsec1...').fill(testNsec);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });
  } else {
    // Maybe we are on login page but "Enter nsec manually" is inside a details/button?
    // Let's assume standard flow.
    // If we can't find it, maybe we should just try to go to /
    // Use the one from find-friend-tip.spec.ts
    await page.getByText('Enter nsec manually').click();
    await page.getByPlaceholder('nsec1...').fill(testNsec);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Live Feed')).toBeVisible({ timeout: 15000 });
  }
}

test('search result fetches and displays profile metadata', async ({ page }) => {
  const pubkey = 'd'.repeat(64);
  const npub = nip19.npubEncode(pubkey);

  const fixture = buildNostrEventResponse({
    id: npub,
    pubkey: pubkey,
    kind: 0,
    content: JSON.stringify({ name: 'Alice Wonderland', about: 'Down the rabbit hole' }),
    authorProfile: { name: 'Alice Wonderland' },
    targetType: 'profile'
  });
  // Add about to authorProfile in fixture manually as helper might only put name
  fixture.author.profile = { name: 'Alice Wonderland', about: 'Down the rabbit hole', picture: 'https://example.com/alice.jpg' };

  await mockNostrEventApi(page, {
    [npub]: fixture
  });

  await loginWithNsec(page);

  await page.getByRole('navigation').getByRole('button', { name: 'Find friend' }).click();

  await page.getByLabel('Friend identifier').fill(npub);
  await page.getByRole('button', { name: 'Search' }).click();

  // "Search result" card should appear.
  // We expect "Alice Wonderland" to appear in the card.
  await expect(page.locator('.search-result-card')).toContainText('Alice Wonderland');
  await expect(page.locator('.search-result-card')).toContainText('Down the rabbit hole');
  
  // Verify avatar is present
  const avatar = page.locator('.search-result-card img');
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute('src', 'https://example.com/alice.jpg');
});
