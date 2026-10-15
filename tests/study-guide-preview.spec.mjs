import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const FIXED_TIME=new Date('2026-10-08T12:00:00-04:00');
async function openStudy(page,width=390) {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.setViewportSize({width,height:852});
  await page.goto('/#study',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
}

test('View study guide opens an in-app preview that can be closed on iPhones',async({context})=>{
  test.setTimeout(120000);
  for(const width of [320,390,430]) {
    const page=await context.newPage();
    await openStudy(page,width);
    await page.locator('[data-open-prep]').click();
    await page.evaluate(()=>{
      window.__unexpectedGuidePopups=0;
      window.open=()=>{window.__unexpectedGuidePopups++;return null};
    });
    const trigger=page.locator('.prep-guide[data-test-guide]');
    await trigger.click();
    const modal=page.locator('dialog[data-study-guide-dialog]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-guide-close]')).toBeFocused();
    await expect(modal.locator('[data-guide-print]')).toBeEnabled();
    const preview=modal.frameLocator('.study-guide-frame');
    await expect(preview.locator('main.sheet h1')).not.toBeEmpty();
    const overflow=await preview.locator('body').evaluate(node=>node.scrollWidth-node.clientWidth);
    expect(overflow,'preview must fit the phone').toBeLessThanOrEqual(1);
    expect(await page.evaluate(()=>window.__unexpectedGuidePopups)).toBe(0);
    await modal.locator('[data-guide-close]').click();
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.close();
  }
});


test('every announced test has separate study-guide and practice-worksheet previews without automatic printing',async({page})=>{
  await openStudy(page,390);
  await page.locator('[data-open-prep]').click();
  const pair=page.locator('.prep-material-actions');
  await expect(pair.locator('[data-test-guide]')).toHaveCount(1);
  await expect(pair.locator('[data-test-worksheet]')).toHaveCount(1);
  await page.evaluate(()=>{window.__unexpectedPrints=0;window.print=()=>{window.__unexpectedPrints++;};});
  const worksheet=pair.locator('[data-test-worksheet]');
  await worksheet.click();
  const modal=page.locator('dialog[data-study-guide-dialog]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('#study-guide-modal-title')).toContainText('Worksheet:');
  await expect(modal.frameLocator('.study-guide-frame').locator('main.sheet')).toBeVisible();
  await expect(modal.frameLocator('.study-guide-frame').locator('main.sheet h1')).toContainText(/Practice|Dictation|Worksheet/);
  await expect(modal.locator('[data-guide-print]')).toBeEnabled();
  expect(await page.evaluate(()=>window.__unexpectedPrints)).toBe(0);
  await modal.locator('[data-guide-close]').click();
  await expect(worksheet).toBeFocused();
  await pair.locator('[data-test-guide]').click();
  await expect(modal).toBeVisible();
  await expect(modal.locator('#study-guide-modal-title')).toContainText('Study guide:');
  await expect(modal.frameLocator('.study-guide-frame').locator('main.sheet h1')).toContainText(/Study Guide|Spelling Word Study/);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(pair.locator('[data-test-guide]')).toBeFocused();
  const history=page.locator('details[data-study-test-options]');
  // Back to the Study home where the historical list lives.
  await page.locator('[data-close-prep]').click();
  await history.locator(':scope > summary').click();
  const cards=history.locator('.study-material-pair');
  await expect(cards.first().locator('[data-test-guide]')).toBeVisible();
  await expect(cards.first().locator('[data-test-worksheet]')).toBeVisible();
});

test('Historical guides preview first and print only on an explicit tap',async({page})=>{
  await openStudy(page);
  const history=page.locator('details[data-study-test-options]');
  await history.locator(':scope > summary').click();
  const trigger=history.locator('[data-test-guide]').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const modal=page.locator('dialog[data-study-guide-dialog]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-guide-print]')).toBeEnabled();
  await page.evaluate(()=>{
    window.__guideExplicitPrints=0;
    document.querySelector('.study-guide-frame').contentWindow.print=()=>{window.__guideExplicitPrints++};
  });
  expect(await page.evaluate(()=>window.__guideExplicitPrints)).toBe(0);
  await modal.locator('[data-guide-print]').click();
  expect(await page.evaluate(()=>window.__guideExplicitPrints)).toBe(1);
  await modal.locator('[data-guide-close]').click();
  await expect(modal).toHaveCount(0);
  await expect(history).toHaveAttribute('open','');
  await expect(trigger).toBeFocused();
});
