import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => {
    localStorage.removeItem('abvm-study-comebacks:v1');
    localStorage.removeItem('abvm-study-learning:v2');
  });
  await page.reload();
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
});

test('Study Games keeps the approved menu, play, and finish interaction contract', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Pick a game and start' })).toBeVisible();
  for (const label of ['Quick Mix', 'Math Dash', 'Word Power', 'Faith Quest']) {
    await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
  }
  await expect(page.getByText('Practice prioritizes verified school skills; private student answers and grades are not used.')).toBeVisible();

  await page.getByRole('button', { name: /Quick Mix/i }).click();
  await expect(page.locator('.game-topbar')).toBeVisible();
  await expect(page.locator('.game-progress')).toBeVisible();
  await expect(page.locator('.game-question-card')).toBeVisible();
  await expect(page.locator('.game-answer')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Need a hint/i })).toBeVisible();

  for (let resolved = 0; resolved < 12; resolved += 1) {
    if (await page.locator('.game-finish').count()) break;
    const prompt = await page.locator('.game-question-card h2').textContent();
    const answer = await page.evaluate(async currentPrompt => {
      const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
      const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
      const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
      return catalog.questions.find(item => item.prompt === currentPrompt)?.answer || null;
    }, prompt);
    expect(answer).not.toBeNull();
    const index = await page.locator('.game-answer strong').evaluateAll((nodes, expected) => nodes.findIndex(node => node.textContent === expected), answer);
    expect(index).toBeGreaterThanOrEqual(0);
    await page.locator('.game-answer').nth(index).click();
    await expect(page.locator('.game-feedback.correct')).toBeVisible();
    await page.locator('[data-game-next]').click();
  }

  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.game-finish-stars')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All study games' })).toBeVisible();
});
