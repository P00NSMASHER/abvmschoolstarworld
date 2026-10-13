import {test, expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
const fixed=new Date('2026-10-13T12:00:00-04:00');
async function load(page) {
  await page.clock.setFixedTime(fixed);
  await page.goto('/#calendar');
  await expect(page.locator('.calendar-studio')).toBeVisible();
}

test('tap October shortcut to reveal and focus the complete source-backed agenda',async({page})=>{
  await page.setViewportSize({width:390,height:844});await load(page);
  const date=page.locator('.current-month-summary [data-cal-open-date="2026-10-14"]');
  await expect(date).toHaveAttribute('aria-label','View October 14 agenda');
  await date.click();
  await expect(page.locator('.calendar-day-heading h2')).toHaveText('October 14');
  await expect(page.locator('.calendar-day-heading h2')).toBeFocused();
  await expect(page.locator('.calendar-day-card')).toContainText('Progress Reports Sent Home — Sign & Return');
  await expect(page.locator('[data-cal-day="2026-10-14"]')).toHaveAttribute('aria-pressed','true');
  const top=await page.locator('.calendar-day-card').evaluate(el=>el.getBoundingClientRect().top);
  const nav=await page.locator('.bottom-nav').evaluate(el=>el.getBoundingClientRect().top);
  expect(top).toBeLessThan(nav-20);
});

test('jump to a November date crosses months without shifting the civil day',async({page})=>{
  await load(page);
  await page.locator('.next-month-card [data-cal-open-date="2026-11-03"]').click();
  await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
  await expect(page.locator('[data-cal-day="2026-11-03"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.calendar-day-heading h2')).toHaveText('November 3');
  await expect(page.locator('.calendar-day-heading h2')).toBeFocused();
});

test('shortcuts are keyboard-operable, reachable and unclipped on narrow phones',async({page})=>{
  for(const width of [320,375,390]){
    await page.setViewportSize({width,height:844});await load(page);
    const rows=page.locator('.current-month-summary [data-cal-open-date]');
    await expect(rows).toHaveCount(5);
    const rects=await rows.evaluateAll(items=>items.map(el=>el.getBoundingClientRect().toJSON()));
    for(const rect of rects){expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);}
    await page.locator('.current-month-summary [data-cal-open-date="2026-10-15"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.calendar-day-heading h2')).toHaveText('October 15');
    await expect(page.locator('.calendar-day-heading h2')).toBeFocused();
    expect(await page.locator('.calendar-screen').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  }
});
