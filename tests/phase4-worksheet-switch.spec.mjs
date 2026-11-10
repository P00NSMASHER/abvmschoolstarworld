import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {buildRuntimePack} from '../scripts/build-runtime-pack.mjs';
test.use({serviceWorkers:'block'});

test('the Nov 12 and Nov 13 original worksheets open consecutively with the correct scope',async({page})=>{
  test.setTimeout(90_000);
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00-05:00'));
  // Historical, public-source scope fixture; never assume a teacher still
  // assigns these topics when this regression runs after November 2026.
  const source=JSON.parse(readFileSync(new URL('./fixtures/abvm-source-snapshot-2026-11-09.json',import.meta.url),'utf8'));
  const runtime=buildRuntimePack(source);
  await page.route('**/data/study-pack*.json*',route=>route.fulfill({
    json:route.request().url().includes('study-pack-runtime.json')?runtime:source,
  }));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15_000});
  await page.locator('[data-open-prep]').click();
  for(const expected of [/singular.*plural nouns/i,/3 letter blends/i]){
    const option=page.locator('[data-test-select]').and(page.getByRole('button',{name:expected}));
    await expect(option).toHaveCount(1);
    const key=await option.getAttribute('data-test-key');
    await option.click();
    const worksheet=page.locator('[data-test-worksheet][data-guide-upcoming="true"]');
    await expect(worksheet).toHaveAttribute('data-test-key',key);
    await worksheet.click();
    const dialog=page.locator('[data-study-guide-dialog]');
    await expect(dialog).toBeVisible({timeout:20_000});
    await expect(dialog).toHaveAttribute('data-guide-test-key',key);
    await expect(dialog).toHaveAttribute('data-guide-practice-count','8');
    const frame=page.frameLocator('[data-study-guide-dialog] iframe');
    await expect(frame.locator('.student-test .problem')).toHaveCount(6,{timeout:20_000});
    await expect(frame.locator('.adult-key .key-list li')).toHaveCount(6);
    await dialog.locator('[data-guide-close]').click();
    await expect(dialog).toHaveCount(0);
  }
});
