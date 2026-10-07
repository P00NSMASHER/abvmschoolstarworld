import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
const sizes=[375,390,430,744,820,1024,1440];
const tabs=[['today','Today'],['week','Week'],['study','Study'],['family','Progress']];

for(const width of sizes){
  test(`consumer product fits ${width}px and preserves primary destinations`,async({page},info)=>{
    await page.setViewportSize({width,height:width>=744?1024:852});
    await page.clock.setFixedTime(new Date('2026-10-07T12:00:00-04:00'));
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/#today');
    const nav=page.getByRole('navigation',{name:'App navigation'});
    await expect(nav.getByRole('button')).toHaveCount(4);
    await expect(nav.locator('[data-tab="calendar"]')).toHaveCount(0);
    for(const [id,label] of tabs){
      const button=nav.locator(`[data-tab="${id}"]`);
      await expect(button).toHaveAccessibleName(label);
      await button.click();
      await expect(button).toHaveAttribute('aria-current','page');
      await expect(page.locator('.screen h1')).toBeVisible();
      if(id==='study'){
        await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
        const picker=page.locator("[data-test-select]");
        await expect(picker).toBeVisible();
        expect(await picker.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),"native selector avoids iOS focus zoom").toBeGreaterThanOrEqual(16);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' document').toBe(true);
      expect(await page.locator('.screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1),label+' content').toBe(true);
      for(const target of await nav.locator('button').all()){
        const box=await target.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);
      }
      const path=info.outputPath(`consumer-${id}-${width}.png`);
      await page.screenshot({path,animations:'disabled'});
      await info.attach(label+' '+width,{path,contentType:'image/png'});
    }
    await nav.locator('[data-tab="week"]').click();
    await page.getByRole('button',{name:'Calendar',exact:true}).click();
    await expect(page.locator('.calendar-card')).toBeVisible();
    await expect(nav.locator('[data-tab="week"]')).toHaveAttribute('aria-current','page');
    expect(errors).toEqual([]);
  });
}

test('Today school photograph reserves dimensions and uses the reviewed local source',async({page})=>{
  await page.goto('/#today');
  const photo=page.locator('.hero-photo');
  await expect(photo).toHaveAttribute('src','./assets/school/abvm-school-hero.webp');
  await expect(photo).toHaveAttribute('alt',/Assumption BVM School/);
  expect(Number(await photo.getAttribute('width'))).toBeGreaterThan(0);
  expect(Number(await photo.getAttribute('height'))).toBeGreaterThan(0);
  await expect.poll(()=>photo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
});

test('Progress has an honest empty state and keeps evidence on the device',async({page})=>{
  await page.addInitScript(()=>localStorage.removeItem('abvm-study-learning:v2'));
  await page.goto('/#progress');
  await expect(page.getByRole('region',{name:'Learning progress'})).toBeVisible();
  await expect(page.locator('.progress-empty')).toContainText('After a few practice rounds');
  await expect(page.locator('.device-note')).toContainText('not school grades');
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator('.learning-library')).toBeVisible();
});

test('Progress shows recent independent, recalled and reinforcement evidence without changing history',async({page},info)=>{
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  const skills=envelope.pack.contentPipeline.skills.slice(0,3);
  expect(skills).toHaveLength(3);
  const now=Date.parse('2026-10-07T12:00:00-04:00');
  await page.clock.setFixedTime(new Date(now));
  const evidence={
    [skills[0].id]:{LastSeenAt:now-300000,LastIndependentCorrectAt:now-300000,LastResolution:{correct:true,independent:true,resolvedAt:now-300000}},
    [skills[1].id]:{LastSeenAt:now-600000,LastComebackAt:now-600000,LastComebackCorrectAt:now-600000,RememberedLater:1},
    [skills[2].id]:{LastSeenAt:now-900000,LastResolution:{correct:false,independent:false,resolvedAt:now-900000}},
  };
  await page.addInitScript(evidence=>localStorage.setItem('abvm-study-learning:v2',JSON.stringify(evidence)),evidence);
  await page.goto('/#progress');
  await expect(page.locator('.progress-empty')).toHaveCount(0);
  const panel=page.locator('section[aria-labelledby="weekly-learning-title"]');
  await expect(panel).toBeVisible();
  for(const skill of skills)await expect(panel).toContainText(skill.label||skill.id);
  for(const width of [390,820,1440]){
    await page.setViewportSize({width,height:width===390?852:1024});
    expect(await page.locator('.screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    const path=info.outputPath(`consumer-progress-evidence-${width}.png`);
    await page.screenshot({path,animations:'disabled'});await info.attach('Progress with evidence '+width,{path,contentType:'image/png'});
  }
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abvm-study-learning:v2')))).toEqual(evidence);
});
