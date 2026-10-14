import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const TUESDAY=new Date('2026-10-13T21:00:00-04:00');

test('Today puts real teacher homework directly after the hero, without daily routines',async({page})=>{
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
  await page.clock.setFixedTime(TUESDAY);
  await page.goto('/#today');
  const first=page.locator('.today-homework [data-homework-check="0"]');
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.locator('.today-homework [data-homework-check="0"]')).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.locator('.today-homework [data-homework-check="0"]')).toHaveAttribute('aria-pressed','true',{timeout:10000});
  await page.getByRole('button',{name:'Calendar'}).click();
  await page.getByRole('button',{name:'Week'}).click();
  const week=page.locator('.week-homework-card');
  await expect(week).toContainText('Page 22');
  await expect(week).toContainText('Spelling Choice Board activity');
});

test('when teacher data belongs to yesterday or is missing, Today never mislabels it as homework today',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-14T08:00:00-04:00'));
  await page.goto('/#today');
  const card=page.locator('.today-homework');
  await expect(card).toContainText("Homework");
  await expect(card).toContainText(/verification|verified/i);
  await expect(card).not.toContainText('Page 22');
  await expect(card).not.toContainText('Choice Board activity');
  await expect(card.locator('a')).toHaveAttribute('href','https://sites.google.com/view/abvmgr2/homework');
});
