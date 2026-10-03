import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const livePack = readFileSync('pages/data/study-pack.json', 'utf8');

test('localhost can load an explicit curriculum preview pack without publication fallback', async ({ page }) => {
  let previewRequests = 0;
  await page.route('**/data/study-pack.characters-preview.json', async route => {
    previewRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: livePack,
    });
  });

  await page.goto('/?pack=./data/study-pack.characters-preview.json#today');
  await expect(page.locator('.screen')).toBeVisible({ timeout:10_000 });
  await expect(page.locator('.freshness')).toContainText('Local preview · not published');
  expect(previewRequests).toBe(1);
});

test('invalid curriculum preview paths cannot override the normal pack', async ({ page }) => {
  await page.goto('/?pack=../study-pack.characters-preview.json#today');
  await expect(page.locator('.screen')).toBeVisible({ timeout:10_000 });
  await expect(page.locator('.freshness')).not.toContainText('Local preview');
});
