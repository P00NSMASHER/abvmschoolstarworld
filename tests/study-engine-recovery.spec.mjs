import {test, expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('a stalled Study engine exposes retry and recovers without reloading the app', async ({page}, info) => {
  await page.clock.install({time:new Date('2026-11-16T22:00:00Z')});
  let hold = true, attempts = 0;
  const held = [];
  await page.route('**/study-games.js?*', route => {
    attempts++;
    if (hold) held.push(route);
    else return route.continue();
  });
  try {
    await page.goto('/#study', {waitUntil:'domcontentloaded'});
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','loading');
    await expect.poll(() => attempts).toBeGreaterThan(0);
    // A hung request must settle into a usable error state within the existing
    // 8–12 second network deadline used for the app's other Study resources.
    await page.clock.fastForward(12_001);
    await expect(page.getByRole('heading',{name:'Practice could not load'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath('study-stall-retry.png')});

    hold = false;
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15_000});
    expect(attempts).toBe(2);
    await page.locator('[data-game-start="math"]').click();
    await expect(page.locator('.game-question-card')).toBeVisible();
    expect(await page.locator('[data-game-answer]').count()).toBeGreaterThanOrEqual(2);
    await page.screenshot({path:info.outputPath('study-recovered-math.png')});
  } finally {
    for (const route of held) await route.abort().catch(() => {});
  }
});
