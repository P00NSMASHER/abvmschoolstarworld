import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {installHomeworkFixture} from './homework-e2e-fixture.mjs';

test.use({serviceWorkers:'block'});

test('Today keeps an ongoing assessment window after the first-day dismissal, including offline',async({page,context},info)=>{
  await page.clock.install({time:new Date('2027-01-12T14:59:50-05:00')});
  await page.route('**/data/study-pack*.json*',async route=>{
    const name=new URL(route.request().url()).pathname.endsWith('study-pack-runtime.json')?'study-pack-runtime.json':'study-pack.json';
    const data=JSON.parse(readFileSync(new URL('../pages/data/'+name,import.meta.url),'utf8'));
    // Synthetic HTTP-only events; never write fixture dates into source data.
    data.pack.importantDates=[
      {date:'Tuesday–Friday, Jan. 12–22',label:'QA fixture: Assessment window',kind:'assessment'},
      {date:'Monday, Feb. 1',label:'QA fixture: Later assessment',kind:'test'}
    ];
    await route.fulfill({json:data});
  });
  await page.goto('/#today');
  await expect(page.locator('.priority-card h3')).toHaveText('QA fixture: Assessment window');
  await context.setOffline(true);
  await page.clock.fastForward(10000);
  await page.screenshot({path:info.outputPath('assessment-window-after-dismissal.png'),animations:'disabled'});
  await expect(page.locator('.priority-card h3')).toHaveText('QA fixture: Assessment window');
  await expect(page.locator('.priority-card')).toContainText('Wednesday, January 13');
  await page.clock.setSystemTime(new Date('2027-01-22T15:01:00-05:00'));
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
  await expect(page.locator('.priority-card h3')).toHaveText('QA fixture: Later assessment');
});

test('Week removes yesterday\'s actionable homework at midnight without a reload or network',async({page,context},info)=>{
  await page.clock.install({time:new Date('2026-11-16T23:59:50-05:00')});
  await installHomeworkFixture(page,{
    checkedAt:'2026-11-16T20:00:00-05:00',
    firstObservedAt:'2026-11-16T20:00:00-05:00',
    contentChangedAt:'2026-11-16T20:00:00-05:00',
    assignments:[{subject:'Math',task:'QA fixture: Monday homework'}]
  });
  await page.goto('/#week');
  const homework=page.locator('.week-homework-card');
  await expect(homework.locator('[data-homework-check]')).toHaveCount(1);
  await context.setOffline(true);
  await page.clock.fastForward(10000);
  await page.screenshot({path:info.outputPath('week-homework-after-midnight.png'),animations:'disabled'});
  await expect(homework.locator('[data-homework-check]')).toHaveCount(0);
  await expect(homework).toContainText("only today's verified posting is shown");
  await expect(homework).not.toContainText('QA fixture: Monday homework');
});

test('Calendar keeps a selected future date when the month changes overnight',async({page,context})=>{
  await page.clock.install({time:new Date('2026-11-30T23:59:50-05:00')});
  await page.goto('/#calendar');
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  await page.locator('[data-cal-day="2026-12-10"]').click();
  await expect(page.locator('.calendar-day-heading h2')).toHaveText('December 10');
  await context.setOffline(true);
  await page.clock.fastForward(10000);
  await expect(page.locator('.calendar-day-heading h2')).toHaveText('December 10');
  await expect(page.locator('.cal-month-title strong')).toHaveText('December 2026');
});

test('Week keeps a selected future day when Friday rolls into the weekend',async({page,context})=>{
  await page.clock.install({time:new Date('2026-11-20T23:59:50-05:00')});
  await page.goto('/#week');
  await page.getByRole('button',{name:'Next week',exact:true}).click();
  await page.locator('[data-day="2026-11-25"]').click();
  await expect(page.locator('.day-detail-title h2')).toHaveText('Wednesday, November 25');
  await context.setOffline(true);
  await page.clock.fastForward(10000);
  await expect(page.locator('.day-detail-title h2')).toHaveText('Wednesday, November 25');
  await expect(page.locator('.week-nav strong')).toHaveText('Nov 23 – 27');
});
