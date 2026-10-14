import {test,expect} from '@playwright/test';
import {HOMEWORK_E2E_NOW,installFreshHomeworkFixture,installHomeworkFixture} from './homework-e2e-fixture.mjs';
test.use({serviceWorkers:'block'});
const TUESDAY=HOMEWORK_E2E_NOW;

test('Today puts real teacher homework directly after the hero, without daily routines',async({page})=>{
  await installFreshHomeworkFixture(page);
  await page.clock.setFixedTime(TUESDAY);
  await page.setViewportSize({width:390,height:852});
  await page.goto('/#today');
  const hero=page.locator('.school-photo-hero'),card=page.locator('.today-homework');
  await expect(card.locator('.homework-task-list .check-item')).toHaveCount(2,{timeout:15000});
  await expect(card).toContainText('Page 22');
  await expect(card).toContainText('Spelling Choice Board activity');
  await expect(card).not.toContainText(/cover books|reading log|behavior chart|return everything|read 20 minutes/i);
  await expect(page.locator('.today-panel .check-item')).toHaveCount(0);
  const order=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    return {heroBottom:rect('.school-photo-hero').bottom,homeworkTop:rect('.today-homework').top,
      homeworkBottom:rect('.today-homework').bottom,schoolSignTop:rect('.school-sign-card').top,
      width:document.querySelector('.today-screen').scrollWidth,client:document.querySelector('.today-screen').clientWidth,
      navTop:rect('.bottom-nav').top};
  });
  expect(order.homeworkTop).toBeGreaterThanOrEqual(order.heroBottom-1);
  expect(order.homeworkBottom).toBeLessThanOrEqual(order.schoolSignTop+1);
  expect(order.homeworkBottom,'all specific homework needs to appear before the bottom nav').toBeLessThan(order.navTop);
  expect(order.width).toBeLessThanOrEqual(order.client+1);
  await page.screenshot({path:test.info().outputPath('today-homework-390.png'),animations:'disabled'});
});

test('homework completion persists on one device without showing routine items',async({page})=>{
  await installFreshHomeworkFixture(page);
  await page.clock.setFixedTime(TUESDAY);
  await page.goto('/#today');
  const first=page.locator('.today-homework [data-homework-check="0"]');
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.locator('.today-homework [data-homework-check="0"]')).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.locator('.today-homework [data-homework-check="0"]')).toHaveAttribute('aria-pressed','true',{timeout:10000});
  await page.getByRole('button',{name:'Calendar'}).click();
  await page.locator('.calendar-segments [data-route="week"]').click();
  const week=page.locator('.week-homework-card');
  await expect(week).toContainText('Page 22');
  await expect(week).toContainText('Spelling Choice Board activity');
});

test('when teacher homework was first seen yesterday, Today never mislabels it as homework today',async({page})=>{
  await installHomeworkFixture(page,{firstObservedAt:'2026-10-14T00:32:53.326Z',checkedAt:'2026-10-14T12:00:00-04:00'});
  await page.clock.setFixedTime(new Date('2026-10-14T08:00:00-04:00'));
  await page.goto('/#today');
  const card=page.locator('.today-homework');
  await expect(card).toContainText("Homework");
  await expect(card).toContainText(/verification|verified/i);
  await expect(card).not.toContainText('Page 22');
  await expect(card).not.toContainText('Choice Board activity');
  await expect(card.locator('a')).toHaveAttribute('href','https://sites.google.com/view/abvmgr2/homework');
});

test('Today remains usable if the independently cached Homework helper cannot load offline',async({page})=>{
  await page.clock.setFixedTime(TUESDAY);
  await page.route('**/homework-feed.js*',route=>route.abort('failed'));
  await page.goto('/#today');
  await expect(page.locator('.today-screen')).toBeVisible({timeout:10000});
  await expect(page.locator('.today-homework')).toContainText('not yet verified');
  await expect(page.locator('.today-panel')).toBeVisible();
  await expect(page.locator('.today-screen > .lunch-card')).toBeVisible();
});

test('unchanged undated Tuesday homework rechecked Wednesday stays out of Today and Week',async({page})=>{
  await installHomeworkFixture(page,{firstObservedAt:'2026-10-14T00:32:53.326Z',
    checkedAt:'2026-10-14T12:00:00-04:00'});
  await page.clock.setFixedTime(new Date('2026-10-14T13:00:00-04:00'));
  await page.goto('/#today');
  const today=page.locator('.today-homework');
  await expect(today).toContainText("Homework needs today's teacher verification");
  await expect(today).not.toContainText(/Page 22|Choice Board activity/);
  await expect(today.locator('.homework-task-list .check-item')).toHaveCount(0);
  await expect(today.locator('a')).toHaveAttribute('href','https://sites.google.com/view/abvmgr2/homework');
  await page.getByRole('button',{name:'Calendar'}).click();
  await page.locator('.calendar-segments [data-route="week"]').click();
  const week=page.locator('.week-homework-card');
  await expect(week).toContainText("Homework needs today's teacher verification");
  await expect(week).not.toContainText(/Page 22|Choice Board activity/);
  await expect(week.locator('.homework-task-list .check-item')).toHaveCount(0);
});
test('new Wednesday teacher posting shows Math and Spelling consistently in Today and Week',async({page})=>{
  await installHomeworkFixture(page,{firstObservedAt:'2026-10-14T09:00:00-04:00',
    checkedAt:'2026-10-14T12:00:00-04:00',contentHash:'b'.repeat(64)});
  await page.clock.setFixedTime(new Date('2026-10-14T13:00:00-04:00'));
  await page.goto('/#today');
  const today=page.locator('.today-homework');
  await expect(today.locator('.homework-task-list .check-item')).toHaveCount(2);
  await expect(today).toContainText('Page 22');
  await expect(today).toContainText('Spelling Choice Board activity');
  await expect(today).not.toContainText(/cover books|reading log|behavior chart|return everything/i);
  await page.getByRole('button',{name:'Calendar'}).click();
  await page.locator('.calendar-segments [data-route="week"]').click();
  const week=page.locator('.week-homework-card');
  await expect(week.locator('.homework-task-list .check-item')).toHaveCount(2);
  await expect(week).toContainText('Page 22');
  await expect(week).toContainText('Spelling Choice Board activity');
});
