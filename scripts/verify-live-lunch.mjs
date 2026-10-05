import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
try {
  const data = await livePack();
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
  await page.locator('.study-games-cta').click();
  for (const label of ['Quick Mix', 'Math Dash', 'Word Power', 'Faith Quest']) {
    await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible({ timeout: 15000 });
  }
  const modeCount = await page.locator('.study-game-tile').count();
  expect([4, 5]).toContain(modeCount);
  receipt.screens.push({ screen: 'Study Games', modeCount });
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
  await page.reload();
  for (const label of ['Quick Mix', 'Math Dash', 'Word Power', 'Faith Quest']) {
    await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible({ timeout: 15000 });
  }
  expect([4, 5]).toContain(await page.locator('.study-game-tile').count());
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
