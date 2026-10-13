import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({serviceWorkers:'block'});
const date=new Date('2026-10-12T16:00:00Z');
async function open(page){await page.clock.setFixedTime(date);await page.goto('/#calendar');await expect(page.locator('.calendar-studio')).toBeVisible();}
const day=(page,key)=>page.locator(`[data-cal-day="${key}"]`);

test('reimagined month brings the selected agenda into the first phone screen',async({page},info)=>{
  for(const width of [320,375,390,430,820,1440]){
    await page.setViewportSize({width,height:844});await open(page);
    await day(page,'2026-10-14').click();
    await expect(page.locator('.calendar-day-card')).toContainText('Progress Reports Sent Home');
    await expect(page.getByRole('button',{name:'Jump to today',exact:true})).toBeVisible();
    const geometry=await page.evaluate(()=>{const screen=document.querySelector('.calendar-screen');return{overflow:screen.scrollWidth-screen.clientWidth,top:document.querySelector('.calendar-day-heading').getBoundingClientRect().top,nav:document.querySelector('.bottom-nav').getBoundingClientRect().top};});
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    if(width>=375&&width<=430)expect(geometry.top).toBeLessThan(geometry.nav-80);
    await page.screenshot({path:info.outputPath(`calendar-reimagined-${width}.png`),animations:'disabled'});
  }
});
test('picker, month ends and Today retain a valid selected date',async({page})=>{
  await open(page);await page.locator('[data-cal-picker-toggle]').click();
  await expect(page.locator('#cal-month-picker')).toBeVisible();
  await page.locator('[data-cal-month="2026-12-01"]').click();
  await day(page,'2026-12-31').click();await page.getByRole('button',{name:'Next month',exact:true}).click();
  await expect(day(page,'2027-01-31')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  await expect(day(page,'2027-02-28')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Jump to today',exact:true}).click();
  await expect(day(page,'2026-10-12')).toHaveAttribute('aria-pressed','true');
  await expect(day(page,'2026-10-12')).toHaveAttribute('aria-current','date');
});
test('keyboard arrows cross months and keep a single focusable date',async({page})=>{
  await open(page);await day(page,'2026-10-31').click();await page.keyboard.press('ArrowRight');
  await expect(day(page,'2026-11-01')).toBeFocused();await page.keyboard.press('ArrowDown');
  await expect(day(page,'2026-11-08')).toBeFocused();await page.keyboard.press('PageUp');
  await expect(day(page,'2026-10-08')).toBeFocused();
  await expect(page.locator('.calendar-grid button[tabindex="0"]')).toHaveCount(1);
  await page.locator('[data-cal-picker-toggle]').click();await page.keyboard.press('Escape');
  await expect(page.locator('#cal-month-picker')).toBeHidden();await expect(page.locator('[data-cal-picker-toggle]')).toBeFocused();
});
test('horizontal swipe changes month while a vertical gesture does not',async({page})=>{
  await open(page);const grid=page.locator('.calendar-grid');
  await grid.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:250,clientY:300});
  await grid.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',clientX:120,clientY:305});
  await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
  await grid.dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',clientX:220,clientY:300});
  await grid.dispatchEvent('pointerup',{pointerId:2,pointerType:'touch',clientX:210,clientY:450});
  await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
});
test('busy events disclose original source details and unknown times honestly',async({page})=>{
  await open(page);await day(page,'2026-10-14').click();
  const event=page.locator('.cal-event').filter({hasText:'Progress Reports Sent Home'});
  await event.locator('summary').click();
  await expect(event).toContainText('Reviewed school notice');await expect(event).toContainText('Time not listed');
  await expect(event.locator('.cal-event-provenance')).toBeVisible();
  await day(page,'2026-10-20').click();await expect(page.locator('.calendar-day-card')).toContainText('No school lunch');
});
test('enlarged text, focus, contrast and touch targets remain usable',async({page})=>{
  await page.setViewportSize({width:375,height:812});await open(page);
  const audit=await new AxeBuilder({page}).include('.calendar-studio').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  const boxes=await page.locator('.cal-header button,.calendar-month-nav button,.calendar-grid button').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
  for(const b of boxes){expect(b.w).toBeGreaterThanOrEqual(32);expect(b.h).toBeGreaterThanOrEqual(44);}
  await page.evaluate(()=>document.documentElement.style.fontSize='34px');
  expect(await page.locator('.calendar-studio').evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
  await page.locator('[data-cal-picker-toggle]').click();
  expect(await page.locator('.calendar-studio').evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
});

test('school dates stay fixed across timezones and the daylight-saving boundary',async({browser,baseURL})=>{
  for(const timezoneId of ['America/New_York','Pacific/Honolulu','Asia/Tokyo']){
    const context=await browser.newContext({baseURL,timezoneId,serviceWorkers:'block',viewport:{width:390,height:844}});
    const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-11-01T03:30:00Z'));
    await page.goto('/#calendar');await expect(day(page,'2026-10-31')).toHaveAttribute('aria-current','date');
    await page.getByRole('button',{name:'Next month',exact:true}).click();await day(page,'2026-11-01').click();
    await expect(page.locator('.calendar-day-heading')).toContainText('November 1');
    await expect(day(page,'2026-11-01')).toHaveAttribute('aria-pressed','true');await context.close();
  }
});
test('new calendar loads offline and still navigates the cached school plan',async({browser,browserName,baseURL})=>{
  test.skip(browserName==='webkit','Playwright service-worker navigation is Chromium-only: https://playwright.dev/docs/service-workers. In-session offline navigation is tested separately on WebKit.');
  const context=await browser.newContext({baseURL,serviceWorkers:'allow',viewport:{width:390,height:844}});
  const page=await context.newPage();await page.clock.setFixedTime(date);await page.goto('/#calendar');
  await expect(page.locator('.calendar-studio')).toBeVisible();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await context.setOffline(true);await page.reload();await expect(page.locator('.calendar-studio')).toBeVisible();
  await day(page,'2026-10-14').click();await expect(page.locator('.calendar-day-card')).toContainText('Progress Reports Sent Home');
  await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
  await context.close();
});

test('month picker has no year controls and returns focus after month selection',async({page})=>{
  await open(page);await page.locator('[data-cal-picker-toggle]').click();
  await expect(page.locator('[data-cal-year]')).toHaveCount(0);
  await expect(page.locator('[data-cal-month]')).toHaveCount(12);
  await expect(page.locator('[data-cal-month="2026-10-01"]')).toBeFocused();
  await page.locator('[data-cal-month="2026-11-01"]').click();
  await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
  await expect(page.locator('[data-cal-picker-toggle]')).toBeFocused();
  await expect(page.locator('#cal-month-picker')).toBeHidden();
});
test('leap February remains available through month navigation alone',async({page})=>{
  await page.clock.setFixedTime(new Date('2028-01-31T17:00:00Z'));await page.goto('/#calendar');
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  await expect(day(page,'2028-02-29')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-cal-day]')).toHaveCount(29);
});

test('important short labels stay fully readable rather than ellipsized on phones',async({page})=>{
  for(const width of [320,375,390]){
    await page.setViewportSize({width,height:844});await open(page);
    for(const key of ['2026-10-12','2026-10-13','2026-10-20']){
      const label=day(page,key).locator('.cal-cell-note');
      const size=await label.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
      expect(size.scroll,`${width}px ${key} text width`).toBeLessThanOrEqual(size.width+1);
      expect(size.scrollHeight,`${width}px ${key} text height`).toBeLessThanOrEqual(size.height+1);
    }
  }
});

test('loaded calendar remains usable during a network outage',async({page,context})=>{
  await open(page);await context.setOffline(true);
  await day(page,'2026-10-14').click();await expect(page.locator('.calendar-day-card')).toContainText('Progress Reports Sent Home');
  await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
  await page.getByRole('button',{name:'Jump to today',exact:true}).click();await expect(day(page,'2026-10-12')).toHaveAttribute('aria-pressed','true');
});
