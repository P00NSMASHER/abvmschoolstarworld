import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function openSpeechRound(page) {
  await page.addInitScript(() => {
    window.__roomSpeech = { utterances: [], cancelled: 0 };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() { window.__roomSpeech.cancelled++; },
        speak(utterance) { window.__roomSpeech.utterances.push(utterance); },
      },
    });
    window.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };
  });
  await page.goto('/#study');
  await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state', 'ready', { timeout: 15000 });
  await page.locator('.hub-tabs [data-tab="star"]').click();
  await page.locator('[data-star="Math"]').click();
  await expect(page.getByRole('button', { name: 'Read to me', exact: true })).toBeVisible();
}

for (const event of ['onend', 'onerror']) {
  test(`late speech ${event} cannot prevent Close from stopping the current reading`, async ({ page }) => {
    await openSpeechRound(page);
    const before = await page.evaluate(() => localStorage.getItem('abvm-study-learning:v2'));
    const read = page.getByRole('button', { name: 'Read to me', exact: true });
    await read.click();
    await page.evaluate(key => { window.__lateSpeechCallback = window.__roomSpeech.utterances[0][key]; }, event);
    await read.click();
    await page.evaluate(() => window.__lateSpeechCallback());
    const beforeClose = await page.evaluate(() => window.__roomSpeech.cancelled);
    await page.locator('[data-end]').click();
    await expect(page.locator('.hub-tabs')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__roomSpeech.cancelled)).toBe(beforeClose + 1);
    expect(await page.evaluate(() => localStorage.getItem('abvm-study-learning:v2'))).toBe(before);
  });
}

test('leaving Study disposes the active reading without recording an answer', async ({ page }) => {
  await openSpeechRound(page);
  const before = await page.evaluate(() => localStorage.getItem('abvm-study-learning:v2'));
  await page.getByRole('button', { name: 'Read to me', exact: true }).click();
  const beforeLeave = await page.evaluate(() => window.__roomSpeech.cancelled);
  await page.getByRole('button', { name: 'Family', exact: true }).click();
  await expect(page.locator('.family-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__roomSpeech.cancelled)).toBe(beforeLeave + 1);
  expect(await page.evaluate(() => localStorage.getItem('abvm-study-learning:v2'))).toBe(before);
});

test('optional speech failure leaves hints and Close usable', async ({ page }) => {
  await openSpeechRound(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => { window.speechSynthesis.speak = () => { throw new Error('Speech temporarily unavailable'); }; });
  await page.getByRole('button', { name: 'Read to me', exact: true }).click();
  await expect(page.locator('.hub-round')).toBeVisible();
  await page.locator('[data-hint]').click();
  await expect(page.locator('[data-end]')).toBeVisible();
  await page.locator('[data-end]').click();
  await expect(page.locator('.hub-tabs')).toBeVisible();
  expect(errors).toEqual([]);
});
