import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
const sizes=[375,390,430,744,820,1024,1440];
const tabs=[['today','Today'],['calendar','Calendar'],['study','Study'],['family','Progress']];

for(const width of sizes){
  test(`consumer product fits ${width}px and preserves primary destinations`,async({page},info)=>{
    await page.setViewportSize({width,height:width>=744?1024:852});
    await page.clock.setFixedTime(new Date('2026-10-07T12:00:00-04:00'));
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/#today');
    const nav=page.getByRole('navigation',{name:'App navigation'});
    await expect(nav.getByRole('button')).toHaveCount(4);
    await expect(nav.locator('[data-tab="calendar"]')).toHaveCount(1);
    await expect(nav.locator('[data-tab="week"]')).toHaveCount(0);
    for(const [id,label] of tabs){
      const button=nav.locator(`[data-tab="${id}"]`);
      await expect(button).toHaveAccessibleName(label);
      await button.click();
      await expect(button).toHaveAttribute('aria-current','page');
      await expect(page.locator('.screen h1')).toBeVisible();
      if(id==='study'){
        await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
        const headingRight=await page.locator('.study-hero-copy h2').evaluate(el=>{
          const range=document.createRange();range.selectNodeContents(el);
          return Math.max(...Array.from(range.getClientRects(),rect=>rect.right));
        });
        const heroArt=await page.locator('.study-hero-art').boundingBox();
        expect(headingRight,'Study greeting stays clear of the eagle artwork').toBeLessThanOrEqual(heroArt.x);
        const prepLauncher=page.locator('[data-open-prep]');
        await expect(prepLauncher).toBeVisible();
        await expect(page.locator('[data-test-select]')).toHaveCount(0);
        for(const tile of await page.locator('.study-game-tile:has(img)').all()){
          await expect.poll(()=>tile.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
          const image=await tile.locator('img').boundingBox(),slot=await tile.locator('.study-game-icon').boundingBox(),copy=await tile.locator('.study-game-copy').boundingBox();
          expect(image.y+image.height,'subject artwork fits its slot').toBeLessThanOrEqual(slot.y+slot.height+1);
          expect(image.y+image.height,'subject artwork stays above its label').toBeLessThanOrEqual(copy.y);
        }
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
    await nav.locator('[data-tab="study"]').click();
    await page.locator('[data-open-prep]').click();
    const choices=page.locator('[data-test-select]');
    expect(await choices.count()).toBeGreaterThan(0);
    for(const choice of await choices.all()){
      await expect(choice).toHaveRole('button');
      const bounds=await choice.boundingBox();expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect((await choice.getAttribute('aria-label')).length).toBeGreaterThan(4);
    }
    await expect(choices.first()).toHaveAttribute('aria-pressed','true');
    if(await choices.count()>1){
      await choices.nth(1).click();await expect(choices.nth(1)).toHaveAttribute('aria-pressed','true');await expect(choices.first()).toHaveAttribute('aria-pressed','false');
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Test Prep document').toBe(true);
    const prepPath=info.outputPath(`consumer-test-prep-${width}.png`);
    await page.screenshot({path:prepPath,animations:'disabled'});await info.attach('Test Prep '+width,{path:prepPath,contentType:'image/png'});
    await page.locator('[data-close-prep]').click();
    await expect(page.locator('.study-game-grid')).toBeVisible();
    await nav.locator('[data-tab="calendar"]').click();
    await expect(page.locator('.calendar-card')).toBeVisible();
    await expect(page.locator('[data-route="calendar"]')).toHaveAttribute('aria-pressed','true');
    await page.locator('[data-route="week"]').click();
    await expect(page.locator('.week-nav')).toBeVisible();
    await expect(page.locator('[data-route="week"]')).toHaveAttribute('aria-pressed','true');
    await expect(nav.locator('[data-tab="calendar"]')).toHaveAttribute('aria-current','page');
    expect(new URL(page.url()).hash).toBe('#week');
    await page.locator('[data-route="calendar"]').click();
    await expect(page.locator('.calendar-card')).toBeVisible();
    await expect(nav.locator('[data-tab="calendar"]')).toHaveAttribute('aria-current','page');
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


for(const viewport of [
  {width:375,height:812},
  {width:390,height:852},
  {width:402,height:874},
  {width:416,height:896},
  {width:430,height:932}
]){
  test(`phone chrome leaves subjects and Test Prep actions reachable at ${viewport.width}px`,async({page},info)=>{
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date('2026-10-07T12:00:00-04:00'));
    await page.goto('/#study');
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
    // Reserve the real status-area and home-indicator space around the app.
    // This models the available canvas while leaving production env() rules intact.
    await page.addStyleTag({content:'.phone-app{height:calc(100dvh - 93px);margin-top:59px}body{padding-bottom:34px}'});
    const nav=page.locator('.bottom-nav');
    const navBox=await nav.boundingBox();
    expect(navBox.y+navBox.height).toBeLessThanOrEqual(viewport.height-34+1);
    for(const mode of ['reading','spelling','math','religion']){
      const tile=page.locator(`[data-game-start="${mode}"]`),label=tile.locator('.study-game-copy > strong');
      await expect(label).toBeVisible();
      const box=await tile.boundingBox();
      expect(box.y+box.height,mode+' complete subject choice is above navigation').toBeLessThanOrEqual(navBox.y+1);
    }
    const launcher=await page.locator('[data-open-prep]').boundingBox();
    expect(launcher.y+launcher.height).toBeLessThanOrEqual(navBox.y+1);
    const menuShot=info.outputPath(`phone-chrome-subjects-${viewport.width}.png`);
    await page.screenshot({path:menuShot,animations:'disabled'});await info.attach('Subjects with phone chrome',{path:menuShot,contentType:'image/png'});
    await page.locator('[data-open-prep]').click();
    await expect(page.locator('[data-study-tests]')).toBeVisible();
    for(const selector of ['[data-test-single]','.prep-sheet > [data-test-guide]']){
      const action=page.locator(selector);await expect(action).toBeVisible();
      const box=await action.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y+box.height,selector+' is above navigation without scrolling').toBeLessThanOrEqual(navBox.y+1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const prepShot=info.outputPath(`phone-chrome-prep-${viewport.width}.png`);
    await page.screenshot({path:prepShot,animations:'disabled'});await info.attach('Test Prep with phone chrome',{path:prepShot,contentType:'image/png'});
  });
}
