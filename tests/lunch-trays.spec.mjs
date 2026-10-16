import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({serviceWorkers:'block'});
const when=new Date('2026-10-15T16:00:00-04:00');
async function open(page,tab='today',date='2026-10-15'){
 await page.clock.setFixedTime(when);await page.goto('/#'+tab);
 await expect(page.locator('.screen')).toBeVisible();
 if(tab==='calendar')await page.locator('[data-cal-day="'+date+'"]').click();
}
test('reviewed photoreal tray and complete menu remain readable across phone, iPad and desktop',async({page},info)=>{
 test.setTimeout(90000);
 for(const width of [375,390,430,744,820,1024,1440]){
  await page.setViewportSize({width,height:900});await open(page);
  const card=page.locator('.today-screen > .lunch-card');
  await expect(card).toContainText('Chicken patty on a roll');
  await expect(card).toContainText('French fries, Mixed vegetables, and Fruit');
  const art=card.locator('.lunch-art-tray'),image=art.locator('img');
  await expect(image).toHaveAttribute('src','assets/lunch-art/tray-2026-10-15-v1.webp');
  await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>=1200)).toBe(true);
  const dimensions=await image.evaluate(img=>({width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height,natural:img.naturalWidth}));
  expect(dimensions.natural).toBeGreaterThanOrEqual(dimensions.width*2);
  expect(dimensions.width/dimensions.height).toBeCloseTo(1.5,1);
  await expect(image).toHaveAttribute('alt', /^Illustration of/);
  await expect(art.locator('figcaption')).toHaveCount(0);
  expect(await card.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  if(width===390||width===820){await card.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('lunch-trays-'+width+'.png')});}
 }
});
test('lunch image footnotes stay absent on Today, Week and Calendar',async({page})=>{
 for(const tab of ['today','week','calendar']){
  await open(page,tab);
  const cards=page.locator(tab==='calendar'?'.calendar-day-card .agenda-lunch':tab==='today'?'.today-screen > .lunch-card':'.week-rail .lunch-card');
  const card=cards.filter({hasText:'Chicken patty on a roll'}).first();
  await expect(card.locator('.lunch-art-tray img')).toHaveAttribute('alt',/^Illustration of/);
  await expect(card.locator('.lunch-art figcaption')).toHaveCount(0);
 }
});
test('failed image requests preserve the exact menu on Today, Week and Calendar',async({page})=>{
 await page.route('**/assets/lunch-art/tray-2026-10-15-v1.webp',route=>route.abort());
 for(const tab of ['today','week','calendar']){
  await open(page,tab);
  const card=page.locator(tab==='calendar'?'.calendar-day-card .agenda-lunch':'.'+(tab==='today'?'today-screen >':'week-rail')+' .lunch-card');
  await expect(card).toContainText('Chicken patty on a roll');await expect(card).toContainText('French fries');
  await expect(card.locator('.lunch-art')).toHaveCount(0);
 }
});
test('unknown fillings remain unpictured and no-school precedence still suppresses food imagery',async({page})=>{
 await open(page,'calendar','2026-10-27');
 const card=page.locator('.calendar-day-card .agenda-lunch');
 await expect(card).toContainText('Taco Tuesday & chips');
 const image=card.locator('.lunch-art-tray img');
 await expect(image).toHaveAttribute('alt', /^Illustration of/);
 await expect(image).not.toHaveAttribute('alt', /beef|chicken/i);
 await expect(card.locator('.lunch-art-tray figcaption')).toHaveCount(0);
 await page.locator('[data-cal-day="2026-10-20"]').click();
 await expect(card).toContainText('No school lunch');await expect(card.locator('.lunch-art')).toHaveCount(0);
});
test('loaded tray remains available offline and its accessible description has no serious accessibility findings',async({page,context})=>{
 await open(page);const art=page.locator('.today-screen .lunch-art-tray');
 await expect.poll(()=>art.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await context.setOffline(true);await expect(art).toBeVisible();
 await expect(page.locator('.today-screen > .lunch-card')).toContainText('Fruit');
 const a11y=await new AxeBuilder({page}).include('.lunch-art-tray').analyze();
 expect(a11y.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
 await context.setOffline(false);
});

test('an already-open app picks up newly published reviewed artwork without a reload',async({page})=>{
 const {readFileSync}=await import('node:fs');
 const data=JSON.parse(readFileSync(new URL('../pages/data/lunch-art-current.json',import.meta.url),'utf8'));
 const script=readFileSync(new URL('../pages/lunch-art.js',import.meta.url),'utf8');let published=false;
 // Isolated prior-release response copies, never edits to published school data.
 await page.route('**/lunch-art.js*',route=>route.fulfill({contentType:'text/javascript',body:script.replace(/\ninstallLunchArtwork\([^\n]+\);/,'\ninstallLunchArtwork({},globalThis);')}));
 await page.route('**/data/lunch-art-current.json*',route=>route.fulfill({json:published?data:{schemaVersion:1,approved:{}}}));
 await open(page);await expect(page.locator('.today-screen > .lunch-card')).toContainText('Chicken patty on a roll');
 await expect(page.locator('.today-screen .lunch-art')).toHaveCount(0);
 published=true;await page.clock.setFixedTime(new Date(when.getTime()+360000));
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 const image=page.locator('.today-screen .lunch-art-tray img');
 await expect(image).toHaveAttribute('src','assets/lunch-art/tray-2026-10-15-v1.webp');
 await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>=1200)).toBe(true);
});
