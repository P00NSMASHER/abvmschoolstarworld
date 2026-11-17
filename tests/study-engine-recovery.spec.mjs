import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const engineSource = readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8');

test.use({serviceWorkers:'block'});

test('a stalled Study engine exposes retry and recovers without reloading the app', async ({page}, info) => {
  await page.clock.install({time:new Date('2026-11-16T22:00:00Z')});
  let hold = true, attempts = 0;
  const held = [], requestUrls = [];
  await page.route('**/study-games.js?*', route => {
    attempts++;
    requestUrls.push(route.request().url());
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
    // A delayed idle warm-up must preserve this failure. Otherwise it starts
    // another held request before the user restores the connection and retries.
    await page.clock.fastForward(2500);
    expect(attempts).toBe(1);
    await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();

    hold = false;
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15_000});
    expect(attempts).toBe(2);
    const originalUrl = new URL(requestUrls[0]), retryUrl = new URL(requestUrls[1]);
    expect(retryUrl.href).not.toBe(originalUrl.href);
    expect(retryUrl.pathname).toBe(originalUrl.pathname);
    expect(retryUrl.searchParams.get('v')).toBe(originalUrl.searchParams.get('v'));
    await page.locator('[data-game-start="math"]').click();
    await expect(page.locator('.game-question-card')).toBeVisible();
    expect(await page.locator('[data-game-answer]').count()).toBeGreaterThanOrEqual(2);
    await page.screenshot({path:info.outputPath('study-recovered-math.png')});

    const engine = await page.evaluateHandle(() => window.ABVMStudyGames);
    await page.locator('[data-game-answer]').first().click();
    await expect(page.locator('.game-feedback')).toBeVisible();
    const feedback = await page.locator('.game-feedback strong').first().textContent();
    const question = await page.locator('.game-question-card h2').textContent();
    const score = await page.locator('.game-live-score').textContent();
    // Keep the original unresolved until recovery and an actual answer. Some
    // browsers still execute it after removal; others discard it. Both must
    // retain the recovered engine and the learner's current answer.
    await held[0].fulfill({contentType:'application/javascript',body:engineSource+'\nwindow.__abvmLateEngineExecuted=true;'});
    await page.clock.runFor(100);
    expect(await page.evaluate(value => value === window.ABVMStudyGames,engine)).toBe(true);
    await expect(page.locator('.game-question-card h2')).toHaveText(question);
    await expect(page.locator('.game-feedback strong').first()).toHaveText(feedback);
    await expect(page.locator('.game-live-score')).toHaveText(score);
    await info.attach('study-late-response-behavior',{body:JSON.stringify({lateExecutionObserved:await page.evaluate(() => !!window.__abvmLateEngineExecuted)}),contentType:'application/json'});
    await page.screenshot({path:info.outputPath('study-late-response-preserved.png')});
    await engine.dispose();
  } finally {
    for (const route of held) await route.abort().catch(() => {});
  }
});
