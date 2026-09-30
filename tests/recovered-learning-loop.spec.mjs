import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => localStorage.clear());
});

test('third miss model answer automatically queues a different same-skill Comeback', async ({ page }) => {
  await page.getByRole('button', { name: /Math Dash/i }).click();
  await expect(page.locator('.game-question-card')).toBeVisible();

  const prompt = await page.locator('.game-question-card h2').textContent();
  const current = await page.evaluate(async currentPrompt => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
    const question = catalog.questions.find(item => item.prompt === currentPrompt);
    return question ? {
      id: question.id,
      skill: question.skill,
      answer: question.answer,
      choices: question.choices,
      sourceKey,
      siblingIds: catalog.questions.filter(item => item.skill === question.skill && item.id !== question.id).map(item => item.id),
    } : null;
  }, prompt);

  expect(current).not.toBeNull();
  expect(current.siblingIds.length).toBeGreaterThan(0);

  const wrongIndex = current.choices.findIndex(choice => choice !== current.answer);
  expect(wrongIndex).toBeGreaterThanOrEqual(0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator('.game-answer').nth(wrongIndex).click();
  }

  await expect(page.locator('.game-feedback.retry')).toContainText('model answer');
  await expect(page.locator('[data-game-next]')).toBeVisible();
  await page.locator('[data-game-next]').click();

  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('abvm-study-comebacks:v1') || '[]'));
  expect(queue).toHaveLength(1);
  expect(queue[0].originQuestionId).toBe(current.id);
  expect(queue[0].questionId).not.toBe(current.id);
  expect(current.siblingIds).toContain(queue[0].questionId);
  expect(queue[0].skill).toBe(current.skill);
  expect(queue[0].sourceKey).toBe(current.sourceKey);
  // scheduleGameComeback starts at 3; advancing past the failed item ticks it to 2,
  // leaving two resolved-question transitions before the Comeback becomes due.
  expect(queue[0].remaining).toBe(2);
});

test('Comeback queue deduplicates the same failed origin question', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
    const current = catalog.questions.find(item => item.tier === 'material' && catalog.questions.some(other => other.skill === item.skill && other.id !== item.id));
    if (!current) return null;
    const first = window.ABVMStudyGames.scheduleComeback(catalog, current, { sourceKey, remaining: 3, seed: 'dedupe-a' });
    const second = window.ABVMStudyGames.scheduleComeback(catalog, current, { sourceKey, remaining: 3, seed: 'dedupe-b' });
    return {
      currentId: current.id,
      first: first?.row || null,
      second,
      queue: JSON.parse(localStorage.getItem('abvm-study-comebacks:v1') || '[]'),
    };
  });

  expect(result).not.toBeNull();
  expect(result.first?.originQuestionId).toBe(result.currentId);
  expect(result.second).toBeNull();
  expect(result.queue).toHaveLength(1);
});
