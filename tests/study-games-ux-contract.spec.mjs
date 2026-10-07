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
  await expect(page.getByRole('heading', { name: 'Study one thing at a time' })).toBeVisible();
  for (const label of ['Quick Mix', 'Math Dash', 'Word Power', 'Faith Quest']) {
    await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
  }
  await expect(page.getByText('Practice uses reviewed school skills first. STAR-style items are original Grade 2 practice; private student answers and grades are not used.')).toBeVisible();

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


test('Study home is test-first, compact, and keeps secondary tools collapsed', async ({ page }, testInfo) => {
  const priority=page.locator('.study-priority');
  const source=page.locator('.study-source-card');
  const games=page.locator('.study-game-section');
  const daily=page.locator('.study-daily-card');
  const tools=page.locator('.study-tools');

  for(const node of [priority,source,games,daily,tools]) await expect(node).toBeVisible();

  const boxes=await page.evaluate(() => {
    const box=selector => {
      const r=document.querySelector(selector)?.getBoundingClientRect();
      return r?{top:r.top,bottom:r.bottom,height:r.height}:null;
    };
    return {
      priority:box('.study-priority'),
      source:box('.study-source-card'),
      games:box('.study-game-section'),
      daily:box('.study-daily-card'),
      tools:box('.study-tools'),
    };
  });
  expect(boxes.priority.bottom).toBeLessThanOrEqual(boxes.source.top+4);
  expect(boxes.source.bottom).toBeLessThanOrEqual(boxes.games.top+4);
  expect(boxes.games.bottom).toBeLessThanOrEqual(boxes.daily.top+4);
  expect(boxes.daily.bottom).toBeLessThanOrEqual(boxes.tools.top+4);

  const tiles=page.locator('.study-game-tile');
  await expect(tiles).toHaveCount(4);
  const heights=await tiles.evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().height)));
  expect(Math.max(...heights)).toBeLessThanOrEqual(120);

  await expect(page.locator('[data-study-notes]')).not.toHaveAttribute('open','');
  await expect(page.locator('[data-study-test-options]')).not.toHaveAttribute('open','');

  const overflow=await page.locator('.games-screen').evaluate(el=>el.scrollWidth>el.clientWidth+1);
  expect(overflow).toBeFalsy();

  const shot=testInfo.outputPath('study-cleanup-home.png');
  await page.screenshot({path:shot,fullPage:true});
  await testInfo.attach('Study cleanup home',{path:shot,contentType:'image/png'});
});

test('every upcoming printable guide keeps a valid test index in the collapsed tools', async ({ page }) => {
  const tools=page.locator('[data-study-test-options]');
  await tools.locator(':scope > summary').click();
  const guides=tools.locator('[data-test-guide]');
  expect(await guides.count()).toBeGreaterThan(0);
  const indexes=await guides.evaluateAll(nodes=>nodes.map(node=>node.dataset.testGuide));
  expect(indexes.every(value=>/^\d+$/.test(value))).toBe(true);
  expect(new Set(indexes).size).toBe(indexes.length);
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

test('tried-wrong answers stay rejected and two distinct misses resolve to remediation', async ({ page }) => {
  for (const viewport of [{ width: 393, height: 852 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/?wrong-choice-fixture='+viewport.width+'#games');
    await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Quick Mix/i }).click();
    await expect(page.locator('.game-question-card')).toBeVisible();

    const prompt = await page.locator('.game-question-card h2').textContent();
    const row = await page.evaluate(async currentPrompt => {
      const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
      const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
      const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
      const q = catalog.questions.find(item => item.prompt === currentPrompt);
      return q ? { answer:q.answer, choices:q.choices } : null;
    }, prompt);
    expect(row).not.toBeNull();
    const wrongs=row.choices.map((choice,index)=>choice!==row.answer?index:-1).filter(index=>index>=0);
    expect(wrongs.length).toBeGreaterThanOrEqual(2);

    const firstWrong=page.locator('.game-answer').nth(wrongs[0]);
    await firstWrong.click();
    await expect(firstWrong).toBeDisabled();
    await expect(firstWrong).toHaveClass(/wrong/);
    await expect(page.locator('.game-feedback.retry strong')).toContainText('Incorrect. Try again.');

    await firstWrong.evaluate(button=>button.click());
    await expect(page.locator('[data-game-next]')).toHaveCount(0);
    await expect(page.locator('.game-feedback.retry strong')).toContainText('Incorrect. Try again.');

    const secondWrong=page.locator('.game-answer').nth(wrongs[1]);
    await secondWrong.focus();
    await page.keyboard.press('Enter');
    await expect(firstWrong).toBeDisabled();
    await expect(secondWrong).toBeDisabled();
    await expect(page.locator('.game-feedback.retry strong')).toContainText('Incorrect. The correct answer is');
    await expect(page.locator('[data-game-next]')).toBeVisible();

    await page.locator('[data-game-next]').click();
    await expect(page.locator('.game-question-card')).toBeVisible();
    for (const answerButton of await page.locator('.game-answer').all()) await expect(answerButton).toBeEnabled();
  }
});

