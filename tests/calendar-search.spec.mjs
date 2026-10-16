import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
test.use({serviceWorkers:'block'});
const fixed=new Date('2026-10-15T16:00:00-04:00');
async function load(page,route='calendar'){
  await page.clock.setFixedTime(fixed);
  let extraEvents=[];
  // Isolated response copies keep future source changes from retiring test data.
  // These clearly labeled fixtures never alter repository or published events.
  await page.route('**/data/study-pack*.json*',async request=>{
    const file=new URL(request.request().url()).pathname.endsWith('study-pack-runtime.json')?'study-pack-runtime.json':'study-pack.json';
    const data=JSON.parse(readFileSync(new URL('../pages/data/'+file,import.meta.url),'utf8'));
    data.pack.importantDates=[...(data.pack.importantDates||[]),
      {date:'Nov. 21',label:'Search QA fixture: Reading Night',kind:'School event'},
      {date:'Oct. 22',label:'Search QA fixture: Chick-fil-A',kind:'School event'},
      ...extraEvents,
    ];
    await request.fulfill({json:data});
  });
  await page.goto('/#'+route);
  await expect(page.getByRole('searchbox',{name:'Search calendar events'})).toBeVisible();
  return rows=>{extraEvents=rows;};
}
test('event search finds another month and opens the exact event with keyboard focus',async({page})=>{
  await load(page);
  const input=page.getByRole('searchbox',{name:'Search calendar events'});
  await input.fill('readingnight');
  const result=page.locator('[data-cal-search-date="2026-11-21"]');
  await expect(result).toContainText('Search QA fixture: Reading Night');
  await result.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.calendar-month-nav strong')).toHaveText('November 2026');
  const event=page.locator('.calendar-day-card details').filter({hasText:'Search QA fixture: Reading Night'});
  await expect(event).toHaveAttribute('open','');
  await expect(event.locator('summary')).toBeFocused();
  await expect(input).toHaveValue('readingnight');
});
test('Week shares search; clearing and Escape restore the normal calendar without losing focus',async({page})=>{
  await load(page,'week');
  const input=page.getByRole('searchbox',{name:'Search calendar events'});
  await input.fill('chickfila');
  await expect(page.locator('[data-cal-search-date="2026-10-22"]').filter({hasText:'Search QA fixture: Chick-fil-A'})).toContainText('Chick-fil-A');
  await page.locator('[data-cal-search-date="2026-10-22"]').filter({hasText:'Search QA fixture: Chick-fil-A'}).click();
  await expect(page).toHaveURL(/#calendar$/);
  await expect(page.locator('.calendar-day-heading h2')).toHaveText('October 22');
  await page.getByRole('button',{name:'Clear calendar search'}).click();
  await expect(input).toBeFocused();await expect(input).toHaveValue('');
  await input.fill('no-such-event-zzzz');
  await expect(page.locator('#cal-search-status')).toContainText('No matching events');
  await page.keyboard.press('Escape');
  await expect(input).toBeFocused();await expect(input).toHaveValue('');
  await expect(page.locator('#cal-search-results button')).toHaveCount(0);
});
test('search is usable on phone, iPad and desktop without overflow or serious accessibility failures',async({page})=>{
  test.setTimeout(120000);
  for(const width of [320,390,820,1440]){
    await page.setViewportSize({width,height:900});await load(page);
    await page.getByRole('searchbox',{name:'Search calendar events'}).fill('school');
    const box=page.locator('.cal-search');
    expect(await box.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    const input=box.locator('input');
    expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    const controls=await box.locator('button').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().height));
    expect(controls.every(height=>height>=44)).toBe(true);
    const a11y=await new AxeBuilder({page}).include('.cal-search').analyze();
    expect(a11y.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
    await page.screenshot({path:test.info().outputPath('calendar-search-'+width+'.png')});
  }
});
test('loaded calendar search works with the network offline',async({page,context})=>{
  await load(page);await context.setOffline(true);
  await page.getByRole('searchbox',{name:'Search calendar events'}).fill('readingnight');
  await expect(page.locator('[data-cal-search-date="2026-11-21"]')).toBeVisible();
  await page.locator('[data-cal-search-date="2026-11-21"]').click();
  await expect(page.locator('.calendar-day-heading h2')).toHaveText('November 21');
  await context.setOffline(false);
});

test('fresh school data updates a typed search without dismissing its focus or selection',async({page})=>{
  const update=await load(page);
  const input=page.getByRole('searchbox',{name:'Search calendar events'});
  await input.fill('refreshneedle');
  await expect(page.locator('#cal-search-status')).toContainText('No matching events');
  await input.focus();await input.evaluate(el=>el.setSelectionRange(2,5));
  update([{date:'Nov. 22',label:'Search QA fixture: refreshneedle',kind:'School event'}]);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-cal-search-date="2026-11-22"]')).toContainText('refreshneedle');
  await expect(input).toHaveValue('refreshneedle');
  await expect(input).toBeFocused();
  expect(await input.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([2,5]);
});
