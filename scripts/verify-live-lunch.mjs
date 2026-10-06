import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { publishedMealForDate } from './published-meal.mjs';

const base = process.env.ABVM_LIVE_URL || 'https://p00nsmasher.github.io/abvmschoolstarworld/';
const expected = JSON.parse(readFileSync(new URL('../pages/data/study-pack.json', import.meta.url), 'utf8'));
const out = 'live-lunch-proof';
mkdirSync(out, { recursive: true });
const receipt = {
  verified: false,
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  base,
  expectedLunchHash: expected.pack.lunchMenuHash,
  screens: [],
  consoleErrors: [],
};
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function livePack() {
  const deadline = Date.now() + 180000;
  let detail = '';
  while (Date.now() < deadline) {
    try {
      const r = await fetch(new URL('data/study-pack.json?lunch-proof=' + Date.now(), base), {
        headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(12000),
      });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('Live pack is not JSON: ' + r.status);
      const data = await r.json();
      if (data.pack?.lunchMenuHash === expected.pack.lunchMenuHash && data.pack?.sourceHash === expected.pack.sourceHash && data.sourceLastCheckedAt === expected.sourceLastCheckedAt) return data;
      detail = 'CDN has not served the exact deployed source and lunch hashes yet';
    } catch (error) { detail = error.message; }
    await sleep(5000);
  }
  throw new Error(detail);
}
function eastToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
async function liveStudyAssets() {
  const assets = ['index.html', 'app.js', 'study-games.js', 'study-games-view.js', 'study-materials.mjs', 'study-games-materials-view.mjs', 'study-games-materials.css', 'sw.js'];
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  return Promise.all(assets.map(async path => {
    const expectedBytes = readFileSync(new URL('../pages/' + path, import.meta.url));
    const expectedHash = digest(expectedBytes), deadline = Date.now() + 180000;
    let detail = 'Live asset has not matched the deployed checkout: ' + path;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(new URL(path + '?study-proof=' + Date.now(), base), {
          headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
        const bytes = Buffer.from(await response.arrayBuffer()), actualHash = digest(bytes);
        if (actualHash === expectedHash) return { path, sha256: actualHash, bytes: bytes.length, status: response.status };
        detail = path + ': expected ' + expectedHash + ', received ' + actualHash;
      } catch (error) { detail = error.message; }
      await sleep(5000);
    }
    throw new Error(detail);
  }));
}
try {
  const data = await livePack();
  receipt.studyAssets = await liveStudyAssets();
  writeFileSync(`${out}/deployed-pack.json`, JSON.stringify(data, null, 2));
  receipt.actualLunchHash = data.pack.lunchMenuHash;
  receipt.sourceCheckedAt = data.sourceLastCheckedAt;
  receipt.lunchCheckedAt = data.pack.lunchMenuSource.checkedAt;
  receipt.missingDates = data.pack.lunchMenuSource.missingDates;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  const page = await context.newPage();
  page.on('pageerror', error => receipt.consoleErrors.push(error.message));
  await page.goto(base + '?lunch-proof=' + Date.now() + '#today');
  await expect(page.locator('.screen')).toBeVisible({ timeout: 20000 });
  const today = eastToday();
  const todayMeal = publishedMealForDate(data.pack, today);
  if (todayMeal?.items.length) {
    for (const item of todayMeal.items) await expect(page.locator('.lunch-card')).toContainText(item);
  } else if (![0, 6].includes(new Date(today + 'T12:00:00Z').getUTCDay())) {
    await expect(page.locator('.lunch-card')).toContainText(/No school lunch|Lunch menu not yet verified/);
  }
  if (await page.locator('.lunch-card').count()) await page.locator('.lunch-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/today.png` });
  receipt.screens.push({ screen: 'Today', date: today, lunch: await page.locator('.lunch-card').allTextContents() });

  await page.getByRole('button', { name: 'Week', exact: true }).click();
  async function selectWeekDate(date) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const target = page.locator(`[data-day^="${date}"]`);
      if (await target.count()) { await target.click(); return; }
      const firstDate = (await page.locator('[data-day]').first().getAttribute('data-day')).slice(0, 10);
      await page.getByRole('button', { name: firstDate < date ? 'Next week' : 'Previous week', exact: true }).click();
    }
    throw new Error('Could not reach published lunch date in Week: ' + date);
  }
  for (const meal of data.pack.lunchMenu) {
    await selectWeekDate(meal.date);
    for (const item of meal.items) await expect(page.locator('.lunch-card')).toContainText(item);
    receipt.screens.push({ screen: 'Week', date: meal.date, lunch: await page.locator('.lunch-card').textContent() });
  }
  await page.locator('.lunch-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/week.png` });
  for (const date of data.pack.lunchMenuSource.missingDates) {
    await selectWeekDate(date);
    await expect(page.locator('.lunch-card')).toContainText(/Lunch menu not yet verified|No school lunch/);
    receipt.screens.push({ screen: 'Week gap', date, text: await page.locator('.lunch-card').textContent() });
  }

  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  for (const meal of data.pack.lunchMenu) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const displayedMonth = (await page.locator('[data-cal-day]').first().getAttribute('data-cal-day')).slice(0, 7);
      const targetMonth = meal.date.slice(0, 7);
      if (displayedMonth === targetMonth) break;
      await page.getByRole('button', { name: displayedMonth < targetMonth ? 'Next month' : 'Previous month', exact: true }).click();
    }
    await page.locator(`[data-cal-day^="${meal.date}"]`).click();
    for (const item of meal.items) await expect(page.locator('.calendar-day-card .agenda-lunch')).toContainText(item);
    receipt.screens.push({ screen: 'Calendar', date: meal.date, lunch: await page.locator('.calendar-day-card .agenda-lunch').textContent() });
  }
  await page.locator('.calendar-day-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/calendar.png` });
  await page.getByRole('button', { name: 'Study', exact: true }).click();
  for (const label of ['Quick Mix', 'Math Dash', 'Word Power', 'Faith Quest']) {
    await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible({ timeout: 15000 });
  }
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state', 'ready', { timeout: 15000 });
  await expect(page.locator('[data-study-source]')).toBeEnabled();
  const sourceOptions = await page.locator('[data-study-source] option').evaluateAll(options => options.map(option => option.value));
  expect(sourceOptions).toEqual(['weekly', 'saved', 'star', 'mix']);
  await expect(page.locator('.study-games-cta, .study-at-a-glance, [data-learning-panel]')).toHaveCount(0);
  const modeCount = await page.locator('.study-game-tile').count();
  expect(modeCount).toBe(4);
  await page.screenshot({ path: `${out}/study-games.png` });
  receipt.screens.push({ screen: 'Study Games', modeCount, sourceOptions });
  await page.locator('[data-game-start="quick"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  expect([3, 4]).toContain(await page.locator('.game-answer').count());
  await page.screenshot({ path: `${out}/study-quick-question.png` });
  await page.getByRole('button', { name: 'Back to study games', exact: true }).click();
  await expect(page.locator('.study-game-tile')).toHaveCount(4);
  const studySource = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack-runtime.json').then(response => response.json());
    const engine = window.ABVMStudyGames;
    const catalog = engine.buildCatalog(envelope.pack, { sourceKey: engine.sourceKeyFromEnvelope(envelope.pack, envelope) });
    const { loadStudyMaterials } = await import('./study-materials.mjs');
    const materials = await loadStudyMaterials({ pack: envelope.pack, catalog, engine });
    const scope = materials.forMode('math', { source: 'weekly' });
    return { questions: scope.catalog.questions.filter(question => scope.eligibleIds.includes(question.id)), total: Math.min(8, scope.count) };
  });
  expect(studySource.total).toBeGreaterThan(0);
  await page.locator('[data-game-start="math"]').click();
  const playedQuestions = [];
  for (let index = 0; index < studySource.total; index++) {
    await expect(page.locator('.game-topbar')).toContainText(`${index + 1} of ${studySource.total}`);
    const prompt = await page.locator('.game-question-card > h2').innerText();
    const choices = await page.locator('[data-game-answer] strong').allTextContents();
    expect([3, 4]).toContain(choices.length);
    const question = studySource.questions.find(row => row.prompt === prompt && row.choices.length === choices.length && row.choices.every(choice => choices.includes(choice)));
    expect(question, 'live question belongs to the selected weekly source').toBeTruthy();
    const correct = choices.indexOf(question.answer);
    expect(correct).toBeGreaterThanOrEqual(0);
    if (index === 0) {
      await page.screenshot({ path: `${out}/study-question.png` });
      await page.locator('[data-game-hint]').click();
      await expect(page.locator('.game-hint')).toBeVisible();
      const wrong = choices.findIndex(choice => choice !== question.answer);
      await page.locator('[data-game-answer]').nth(wrong).click();
      await expect(page.locator('[data-game-answer]').nth(wrong)).toBeDisabled();
      await expect(page.locator('.game-feedback.retry')).toBeVisible();
      await expect(page.locator('[data-game-next]')).toHaveCount(0);
      await page.screenshot({ path: `${out}/study-retry.png` });
    }
    await page.locator('[data-game-answer]').nth(correct).click();
    await expect(page.locator('.game-feedback.correct')).toBeVisible();
    if (index === 0) {
      receipt.firstStudyResolution = await page.evaluate(skill => window.ABVMStudyGames.loadLearning()[skill].LastResolution, question.skill);
      expect(receipt.firstStudyResolution).toEqual(expect.objectContaining({ independent: false, attemptCount: 2, incorrectCount: 1, hintCount: 1 }));
      await page.screenshot({ path: `${out}/study-correct.png` });
    }
    playedQuestions.push(question.id);
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.study-star-earned')).toContainText('+10 Study Stars');
  await page.screenshot({ path: `${out}/study-result.png` });
  receipt.studyWalkthrough = { mode: 'math', source: 'weekly', questions: playedQuestions, hint: true, retry: true, correct: true, completed: true, earned: await page.locator('.study-star-earned').innerText() };
  await page.getByRole('button', { name: 'All study games', exact: true }).click();
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
  await page.reload();
  for (const label of ['Quick Mix', 'Math Dash', 'Word Power', 'Faith Quest']) {
    await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible({ timeout: 15000 });
  }
  await expect(page.locator('.study-game-tile')).toHaveCount(4);
  await expect(page.locator('[data-study-source]')).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('[data-game-start="math"]')).toContainText(`Best ${studySource.total} / ${studySource.total}`);
  receipt.studyWalkthrough.returnedAndRecordSurvivedReload = true;
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  if (todayMeal?.items.length) for (const item of todayMeal.items) await expect(page.locator('.lunch-card')).toContainText(item);
  receipt.cacheReloadVerified = true;
  expect(receipt.consoleErrors).toEqual([]);
  receipt.verified = true;
} catch (error) {
  receipt.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  receipt.completedAt = new Date().toISOString();
  writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}
