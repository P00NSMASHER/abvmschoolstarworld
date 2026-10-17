import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const onPhone=async(page,route)=>{
 await page.clock.setFixedTime(new Date('2026-10-16T12:00:00-04:00'));
 await page.setViewportSize({width:390,height:852});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#'+route);
};
const before=async(page,left,right)=>page.locator(left).evaluate((node,selector)=>Boolean(node.compareDocumentPosition(document.querySelector(selector))&Node.DOCUMENT_POSITION_FOLLOWING),right);

test('Today keeps daily plan before the school sign; no source-backed information is removed',async({page})=>{
 await onPhone(page,'today');
 await expect(page.locator('.today-screen .priority-card')).toBeVisible();
 await expect(page.locator('.today-screen .today-panel')).toBeVisible();
 await expect(page.locator('.today-screen .school-sign-photo')).toHaveAttribute('src','./assets/school/abvm-school-sign.webp');
 expect(await before(page,'.today-screen .today-panel','.today-screen .school-sign-card')).toBe(true);
 expect(await page.locator('.today-screen').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});

test('Study resources take priority over stars and Test Prep has a fully visible two-column test selector',async({page})=>{
 await onPhone(page,'study');
 await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state',/ready|partial/,{timeout:15000});
 await expect(page.locator('[data-study-notes]')).toBeVisible();
 await expect(page.locator('.study-badge-tracker')).toBeVisible();
 expect(await before(page,'.games-screen .study-tools','.games-screen .study-badge-surface')).toBe(true);
 await page.locator('[data-open-prep]').click();
 const tests=page.locator('.prep-test-choice');
 await expect.poll(()=>tests.count()).toBeGreaterThan(1);
 const dimensions=await page.locator('.prep-test-choices').evaluate(node=>({
  scroll:node.scrollWidth,client:node.clientWidth,
  columns:getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length
 }));
 expect(dimensions.columns).toBe(2);
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
 await tests.nth(1).click();
 await expect(page.locator('.prep-test-choice').nth(1)).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.prep-material-actions [data-test-guide]')).toBeVisible();
 await expect(page.locator('.prep-material-actions [data-test-worksheet]')).toBeVisible();
});

test('Guides and worksheets are grouped by test, with separately collapsible completion history',async({page})=>{
 await onPhone(page,'study');
 await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state',/ready|partial/,{timeout:15000});
 const resources=page.locator('[data-study-test-options]');
 await resources.locator(':scope > summary').click();
 await expect(resources.locator('.study-material-upcoming')).toBeVisible();
 const pairs=resources.locator('.study-material-pair');
 await expect(pairs.first().locator('[data-test-guide]')).toBeVisible();
 await expect(pairs.first().locator('[data-test-worksheet]')).toBeVisible();
 const history=resources.locator('details.study-test-history');
 await expect(history).not.toHaveAttribute('open','');
 await history.locator('summary').click();
 await expect(history).toHaveAttribute('open','');
 await expect(history.locator('[data-complete-test]')).toBeVisible();
 expect(await page.locator('.games-screen').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});

test('Progress leads with actual learning and keeps the full rank ladder expandable',async({page})=>{
 await onPhone(page,'family');
 await expect(page.locator('.progress-screen [data-badge-collection]')).toBeVisible({timeout:15000});
 expect(await before(page,'.progress-screen .progress-empty','.progress-screen .progress-achievements')).toBe(true);
 expect(await before(page,'.progress-screen .learning-library','.progress-screen .progress-achievements')).toBe(true);
 const disclosure=page.locator('.progress-screen .progress-achievements');
 await disclosure.locator(':scope > summary').click();
 await expect(disclosure).not.toHaveAttribute('open','');
 await disclosure.locator(':scope > summary').click();
 await expect(disclosure.locator('.study-badge-grid>li')).toHaveCount(21);
 expect(await page.locator('.progress-screen').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});
