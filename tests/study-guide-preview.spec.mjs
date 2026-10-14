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
