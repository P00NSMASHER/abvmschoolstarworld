import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const fixedTime = new Date('2026-10-08T12:00:00-04:00');

async function ready(page, route, width, height=852) {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(fixedTime);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#' + route);
  await expect(page.locator(route === 'calendar' ? '.calendar-screen' : '.week-screen')).toBeVisible();
}
async function noOverflow(page) {
  expect(await page.locator('.screen').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}
async function fullCapture(page, info, name) {
  await page.addStyleTag({ content: '.phone-app{display:block!important;height:auto!important;min-height:100vh!important;overflow:visible!important}.screen-stack,.screen{height:auto!important;overflow:visible!important}.bottom-nav{display:none!important}' });
  await page.screenshot({ path: info.outputPath(name), fullPage: true, animations: 'disabled' });
}

test('premium Month: readable seven-column dates, semantic dots and iPhone screenshots', async ({page}, info) => {
  for(const width of [375,390,402,430]){
    await ready(page, 'calendar', width);
    const dates=page.locator('.calendar-grid button[data-cal-day]');
    await expect(dates).toHaveCount(31);
    await expect(page.locator('.calendar-segments [aria-pressed="true"]')).toHaveText('Month');
    await expect(page.locator('.calendar-month-nav strong')).toContainText('October 2026');
    await expect(page.locator('.calendar-grid button[aria-pressed="true"]')).toContainText('8');
    await expect(page.locator('.calendar-day-card')).toContainText('Progress Reports Issued');
    await expect(page.locator('.calendar-legend')).toContainText('No school');
    await expect(page.locator('.calendar-legend')).toContainText('Test');
    await expect(page.locator('.specials-card')).toContainText('Library');
    const bounds=await dates.evaluateAll(nodes=>nodes.map(node=>({
      width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,
      label:node.getAttribute('aria-label')||''
    })));
    for(const box of bounds){
      expect(box.width, 'date button must remain 44px wide').toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.label.length).toBeGreaterThan(10);
    }
    const dot=page.locator('.calendar-mark.test').first();
    await expect(dot).toBeVisible();
    expect(await dot.evaluate(node=>getComputedStyle(node,'::before').content)).toBe('none');
    const header=await page.locator('.calendar-screen .app-header').boundingBox();
    expect(header.height).toBeGreaterThanOrEqual(110);
    expect(header.height).toBeLessThanOrEqual(190);
    await noOverflow(page);
    if(width===390){
      await page.screenshot({path:info.outputPath('calendar-month-390-first-viewport.png'),animations:'disabled'});
      await fullCapture(page,info,'calendar-month-390-full-page.png');
    }
  }
});

test('Month selection and paging retain source-backed tests, closures and lunch',async({page})=>{
  await ready(page,'calendar',390);
  const current=page.locator('.calendar-day-card');
  await expect(page.locator('.calendar-grid button.active')).toContainText('8');
  const thursday=page.locator('.calendar-grid button[data-cal-day]').filter({hasText:/^8$/});
  await expect(thursday).toHaveAttribute('aria-label',/lunch menu available/);
  await page.locator('.calendar-grid button[data-cal-day]').filter({hasText:/^9$/}).click();
  await expect(current).toContainText('Spelling');
  await expect(current).toContainText('Grammar');
  await page.locator('.calendar-grid button[data-cal-day]').filter({hasText:/^12$/}).click();
  await expect(current).toContainText('No School');
  await expect(current).toContainText('Columbus Day');
  await expect(current).toContainText('No school lunch');
  await page.getByRole('button',{name:'Next month'}).click();
  await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
  await expect(page.locator('.calendar-grid button[data-cal-day]')).toHaveCount(30);
  await page.getByRole('button',{name:'Previous month'}).click();
  await expect(page.locator('.calendar-month-nav strong')).toHaveText('October 2026');
  await noOverflow(page);
});

test('premium Week keeps five lunches, verified tests and selected homework',async({page},info)=>{
  for(const width of [375,390,402,430]){
    await ready(page,'week',width);
    await expect(page.locator('.calendar-segments [aria-pressed="true"]')).toHaveText('Week');
    await expect(page.locator('.week-nav strong')).toContainText('Oct 5');
    await expect(page.locator('.day-picker button')).toHaveCount(5);
    await expect(page.locator('.day-picker .active')).toContainText('8');
    await expect(page.locator('.day-detail')).toContainText('Progress Reports Issued');
    await expect(page.locator('.day-detail')).toContainText('Read');
    await expect(page.locator('.week-overview .week-lunches .week-overview-row')).toHaveCount(5);
    await expect(page.locator('.week-overview .week-tests')).toContainText('Spelling');
    await expect(page.locator('.week-overview .week-lunches')).toContainText('No lunch');
    const boxes=await page.locator('.day-picker button').evaluateAll(nodes=>nodes.map(node=>({
      width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height
    })));
    for(const box of boxes){
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await noOverflow(page);
    if(width===390){
      await page.screenshot({path:info.outputPath('calendar-week-390-first-viewport.png'),animations:'disabled'});
      await fullCapture(page,info,'calendar-week-390-full-page.png');
    }
  }
});

test('Calendar and Week withstand larger type, reduced motion and tablet widths',async({page},info)=>{
  for(const width of [375,820,1440]){
    await ready(page,'calendar',width,width===820?1180:900);
    await page.evaluate(()=>{document.documentElement.style.fontSize=(parseFloat(getComputedStyle(document.documentElement).fontSize)*2)+'px'});
    await noOverflow(page);
    await expect(page.locator('.calendar-day-card')).toBeVisible();
    await page.evaluate(()=>{document.documentElement.style.fontSize=''});
    if(width===820)await page.screenshot({path:info.outputPath('calendar-month-tablet-820.png'),animations:'disabled'});
    await page.goto('/#week');
    await expect(page.locator('.week-screen')).toBeVisible();
    await noOverflow(page);
    await expect(page.locator('.week-overview .week-lunches .week-overview-row')).toHaveCount(5);
    if(width===820)await page.screenshot({path:info.outputPath('calendar-week-tablet-820.png'),animations:'disabled'});
  }
});
