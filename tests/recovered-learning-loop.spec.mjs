import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => localStorage.clear());
});

test('third miss model answer automatically queues a different same-skill Comeback', async ({ page }) => {
  await page.getByRole('button', { name: /Quick Mix/i }).click();
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


test('Comeback stays hidden until two later resolved transitions make it due', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
    const current = catalog.questions.find(item =>
      item.tier === 'material' &&
      item.skill &&
      catalog.questions.some(other => other.skill === item.skill && other.id !== item.id)
    );
    if (!current) return null;

    const scheduled = window.ABVMStudyGames.scheduleComeback(catalog, current, {
      sourceKey,
      remaining: 3,
      seed: 'delay-proof',
    });
    if (!scheduled) return null;

    // Leaving the failed origin question consumes the first transition.
    window.ABVMStudyGames.tickComebacks(sourceKey);
    const afterOrigin = JSON.parse(localStorage.getItem('abvm-study-comebacks:v1') || '[]')[0]?.remaining;
    const dueAfterOrigin = window.ABVMStudyGames.dueComeback(catalog, sourceKey);

    // First later resolved question.
    window.ABVMStudyGames.tickComebacks(sourceKey);
    const afterOneLater = JSON.parse(localStorage.getItem('abvm-study-comebacks:v1') || '[]')[0]?.remaining;
    const dueAfterOneLater = window.ABVMStudyGames.dueComeback(catalog, sourceKey);

    // Second later resolved question.
    window.ABVMStudyGames.tickComebacks(sourceKey);
    const afterTwoLater = JSON.parse(localStorage.getItem('abvm-study-comebacks:v1') || '[]')[0]?.remaining;
    const dueAfterTwoLater = window.ABVMStudyGames.dueComeback(catalog, sourceKey);

    return {
      currentId: current.id,
      siblingId: scheduled.question.id,
      skill: current.skill,
      siblingSkill: scheduled.question.skill,
      afterOrigin,
      afterOneLater,
      afterTwoLater,
      dueAfterOrigin: dueAfterOrigin?.question?.id || null,
      dueAfterOneLater: dueAfterOneLater?.question?.id || null,
      dueAfterTwoLater: dueAfterTwoLater?.question?.id || null,
    };
  });

  expect(result).not.toBeNull();
  expect(result.siblingId).not.toBe(result.currentId);
  expect(result.siblingSkill).toBe(result.skill);
  expect(result.afterOrigin).toBe(2);
  expect(result.dueAfterOrigin).toBeNull();
  expect(result.afterOneLater).toBe(1);
  expect(result.dueAfterOneLater).toBeNull();
  expect(result.afterTwoLater).toBe(0);
  expect(result.dueAfterTwoLater).toBe(result.siblingId);
});

test('unfinished Comeback persists as due work for the next session', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
    const current = catalog.questions.find(item =>
      item.tier === 'material' &&
      item.skill &&
      catalog.questions.some(other => other.skill === item.skill && other.id !== item.id)
    );
    if (!current) return null;

    const scheduled = window.ABVMStudyGames.scheduleComeback(catalog, current, {
      sourceKey,
      remaining: 4,
      seed: 'next-session-proof',
    });
    if (!scheduled) return null;

    window.ABVMStudyGames.deferComebacksToNextSession(sourceKey);
    const stored = JSON.parse(localStorage.getItem('abvm-study-comebacks:v1') || '[]')[0] || null;
    const due = window.ABVMStudyGames.dueComeback(catalog, sourceKey);
    return {
      siblingId: scheduled.question.id,
      storedRemaining: stored?.remaining,
      dueId: due?.question?.id || null,
    };
  });

  expect(result).not.toBeNull();
  expect(result.storedRemaining).toBe(0);
  expect(result.dueId).toBe(result.siblingId);
});

test('independent success breaks the failure streak before Teach Card eligibility', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const question = {
      id: 'teach-streak-proof',
      skill: 'subtraction-within-12',
      difficulty: 2,
    };
    const firstFailure = engine.recordLearning(question, false, {
      attemptCount: 3,
      incorrectCount: 3,
      hintCount: 0,
    });
    const independentSuccess = engine.recordLearning(question, true, {
      attemptCount: 1,
      incorrectCount: 0,
      hintCount: 0,
    });
    const laterFailure = engine.recordLearning(question, false, {
      attemptCount: 3,
      incorrectCount: 3,
      hintCount: 0,
    });
    return {
      firstWrongStreak: firstFailure.ConsecutiveWrong,
      independentCorrect: independentSuccess.IndependentCorrect,
      afterSuccessWrongStreak: independentSuccess.ConsecutiveWrong,
      laterWrongStreak: laterFailure.ConsecutiveWrong,
      teachEligibleAfterLaterFailure: (laterFailure.ConsecutiveWrong || 0) >= 2,
    };
  });

  expect(result.firstWrongStreak).toBe(1);
  expect(result.independentCorrect).toBe(1);
  expect(result.afterSuccessWrongStreak).toBe(0);
  expect(result.laterWrongStreak).toBe(1);
  expect(result.teachEligibleAfterLaterFailure).toBe(false);
});
