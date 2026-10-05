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
  await expect(page.getByText('Practice prioritizes verified school skills. STAR-style fallback uses original Grade 2 practice, not copied STAR test items; private student answers and grades are not used.')).toBeVisible();

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


test('Study Games support text remains readable on phone and tablet', async ({ page }) => {
  for (const viewport of [{ width: 393, height: 852 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/#games');
    await page.reload();
    await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });

    const privacy = page.locator('.game-privacy-note');
    if (await privacy.count()) {
      const size = await privacy.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(11);
    }

    await page.getByRole('button', { name: /Quick Mix/i }).click();
    await expect(page.locator('.game-question-card')).toBeVisible();

    const metaSizes = await page.locator('.game-question-meta span,.game-question-meta b').evaluateAll(nodes =>
      nodes.map(el => parseFloat(getComputedStyle(el).fontSize))
    );
    expect(metaSizes.length).toBeGreaterThan(0);
    expect(Math.min(...metaSizes)).toBeGreaterThanOrEqual(12);

    await page.getByRole('button', { name: /Need a hint/i }).click();
    await expect(page.locator('.game-hint')).toBeVisible();
    expect(await page.locator('.game-hint').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);

    await page.locator('.game-answer').first().click();
    await expect(page.locator('.game-feedback')).toBeVisible();
    expect(await page.locator('.game-feedback strong').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);
    expect(await page.locator('.game-feedback p').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);

    const adaptiveSize = await page.locator('.game-question-card').evaluate(card => {
      const sample = document.createElement('small');
      sample.className = 'adaptive-note';
      sample.textContent = 'Support step';
      card.append(sample);
      const size = parseFloat(getComputedStyle(sample).fontSize);
      sample.remove();
      return size;
    });
    expect(adaptiveSize).toBeGreaterThanOrEqual(12);

    const overflow = await page.locator('.games-screen').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBeFalsy();
  }
});
