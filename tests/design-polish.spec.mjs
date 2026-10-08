import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('Today prioritizes the next school event before studying without changing the badge model', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00-04:00'));
  await page.goto('/#today');
  await expect(page.locator('.today-primary > .priority-card')).toHaveCount(1);
  await expect(page.locator('.today-primary > .study-invitation')).toHaveCount(1);
  const priorityFirst = await page.locator('.today-primary').evaluate(el =>
    el.firstElementChild?.classList.contains('priority-card'));
  expect(priorityFirst).toBe(true);
  await expect(page.locator('.school-photo-hero')).toBeVisible();
  await expect(page.locator('.study-badge-latest')).toBeVisible();
  expect(await page.locator('.screen').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const goldBorder = await page.locator('.study-badge-latest').evaluate(el => getComputedStyle(el).borderTopWidth);
  expect(parseFloat(goldBorder)).toBeGreaterThanOrEqual(1);
});

test('iPhone navigation and named calendar markers remain readable and fit', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/#today');
  const fontSize = await page.locator('.bottom-nav button b').first().evaluate(el =>
    parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(12);
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.calendar-card')).toBeVisible();
  const marks = page.locator('.calendar-dots .calendar-mark');
  await expect(marks.first()).toBeVisible();
  const marker = await marks.first().evaluate(el => {
    const box = el.getBoundingClientRect(), style = getComputedStyle(el);
    return { width: box.width, height: box.height, font: parseFloat(style.fontSize) };
  });
  expect(marker.width).toBeGreaterThanOrEqual(14);
  expect(marker.font).toBeGreaterThanOrEqual(10);
  expect(await page.locator('.screen').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('Study uses consistent navy-readable subject colors without changing five available modes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state', 'ready', { timeout: 15000 });
  const tiles = page.locator('.study-game-tile[data-game-start]');
  await expect(tiles).toHaveCount(5);
  const backgrounds = await tiles.evaluateAll(elements => Object.fromEntries(
    elements.map(el => [el.dataset.gameStart, getComputedStyle(el).backgroundColor])
  ));
  expect(backgrounds).toMatchObject({
    reading: 'rgb(229, 243, 255)',
    spelling: 'rgb(255, 239, 172)',
    math: 'rgb(223, 241, 232)',
    religion: 'rgb(230, 214, 255)',
    mix: 'rgb(238, 243, 255)'
  });
  const labels = await tiles.locator('.study-game-copy strong').allTextContents();
  expect(labels).toHaveLength(5);
  expect(await page.locator('.screen').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
