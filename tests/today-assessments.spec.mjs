import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test.use({serviceWorkers:'block'});
async function fixture(page){
 await page.clock.install({time:new Date('2026-10-15T14:59:50-04:00')});
 await page.route('**/data/study-pack*.json*',async route=>{
  const file=new URL(route.request().url()).pathname.endsWith('study-pack-runtime.json')?'study-pack-runtime.json':'study-pack.json';
  const data=JSON.parse(readFileSync(new URL('../pages/data/'+file,import.meta.url),'utf8'));
  // Isolated QA response: never publish synthetic teacher content.
  data.pack.importantDates=(data.pack.importantDates||[]).filter(item=>item.kind!=='test');
  data.pack.importantDates.push(...[
   ['Oct. 15','QA fixture: Thursday Math'],['Oct. 16','QA fixture: Friday Spelling'],
   ['Oct. 16','QA fixture: Friday Religion'],['Oct. 19','QA fixture: Monday Reading']
  ].map(([date,label])=>({date,label,kind:'test'})));
  await route.fulfill({json:data});
 });
 await page.goto('/#today');
 await expect(page.locator('.priority-card h3')).toHaveText('QA fixture: Thursday Math');
}
test('all next-day tests replace today at 3pm without reloading, including offline',async({page,context},info)=>{
 await fixture(page);await context.setOffline(true);
 await page.clock.fastForward(10000);
 await expect(page.locator('.priority-card .assessment-title')).toHaveText(['QA fixture: Friday Spelling','QA fixture: Friday Religion']);
 await expect(page.locator('.priority-card p')).toHaveText('NEXT TESTS');
 await expect(page.locator('.study-invitation')).toHaveCount(0);
 // Offline assertions precede an online reload for complete visual evidence.
 await context.setOffline(false);await page.reload();
 await expect(page.locator('.priority-card .assessment-title')).toHaveText(['QA fixture: Friday Spelling','QA fixture: Friday Religion']);
 await expect(page.locator('.study-badge-latest img')).toBeVisible();
 await expect.poll(()=>page.locator('img').evaluateAll(images=>images.filter(img=>img.loading!=='lazy').every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
 for(const width of [375,390,430,744,820,1024,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.locator('.today-screen').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.priority-card .assessment-title').last()).toBeVisible();
  if(width===390||width===820)await page.screenshot({path:info.outputPath('today-assessments-'+width+'.png')});
 }
 await context.setOffline(false);
 await page.getByRole('navigation',{name:'App navigation'}).getByRole('button',{name:'Study'}).click();
 await expect(page.locator('.games-screen')).toBeVisible();
 await context.setOffline(false);
});
test('resuming a suspended tab refreshes the test date even when source fetches fail',async({page})=>{
 await fixture(page);
 await page.clock.setSystemTime(new Date('2026-10-16T15:05:00-04:00'));
 await page.route('**/data/*.json*',route=>route.abort());
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('.priority-card h3')).toHaveText('QA fixture: Monday Reading');
});
