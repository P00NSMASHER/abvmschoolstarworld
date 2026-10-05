import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({serviceWorkers:'block'});
async function room(page){
  await page.goto('/#study');
  await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','ready');
}
async function game(page){
  await page.goto('/#games');
  await page.getByRole('button',{name:/Math Dash/}).click();
  await expect(page.locator('.game-question-card')).toBeVisible();
}
async function answerKey(page){
  const prompt=await page.locator('.game-question-card > h2').innerText();
  return page.evaluate(async prompt=>{
    const envelope=await fetch('./data/study-pack.json').then(r=>r.json());
    const e=window.ABVMStudyGames,c=e.buildCatalog(envelope.pack,{sourceKey:e.sourceKeyFromEnvelope(envelope.pack,envelope)});
    const q=c.questions.find(q=>q.prompt===prompt);
    if(!q)throw Error('Presented question is not in its source catalog');
    return {answer:q.answer,prompt:q.prompt,skill:q.skill};
  },prompt);
}
for(const size of [{width:393,height:852},{width:768,height:1024},{width:320,height:740},{width:852,height:393}]){
 test(`child-first Study geometry at ${size.width}x${size.height}`,async({page},info)=>{
    await page.setViewportSize(size);await room(page);
    const cards=page.locator('.room-subject-grid > .study-accordion');await expect(cards).toHaveCount(6);
    const geometry=await page.evaluate(()=>{
      const box=s=>document.querySelector(s).getBoundingClientRect().toJSON(),screen=document.querySelector('.screen');
      return {first:box('.room-subject-grid > .study-accordion'),daily:box('.room-daily'),grid:box('.room-subject-grid'),nav:box('.bottom-nav'),overflow:screen.scrollWidth>screen.clientWidth+1};
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.nav.bottom).toBeLessThanOrEqual(size.height+1);
    expect(Math.abs(geometry.daily.width-geometry.grid.width)).toBeLessThan(2);
    if(size.width===393)expect(geometry.first.bottom).toBeLessThanOrEqual(geometry.nav.top);
    const small=await page.locator('.screen button:visible').evaluateAll(bs=>bs.filter(b=>b.getBoundingClientRect().height<43.5).map(b=>b.textContent));
    expect(small).toEqual([]);
    await expect(page.getByRole('button',{name:'Practice now',exact:true})).toBeVisible();
    await info.attach('home',{body:await page.screenshot(),contentType:'image/png'});
 });
}
test('disclosed parent history and primary navigation are keyboard operable',async({page})=>{
  await room(page);
  for(const key of ['cumulative','star','games','weekly']){
    const tab=page.locator(`.hub-tabs [data-tab="${key}"]`);await tab.focus();await page.keyboard.press('Enter');
    await expect(tab).toHaveAttribute('aria-pressed','true');await expect(tab).toBeFocused();
  }
  const drawer=page.locator('.room-adults');await expect(drawer).not.toHaveAttribute('open','');
  await drawer.locator(':scope > summary').focus();await page.keyboard.press('Enter');await expect(drawer).toHaveAttribute('open','');
  await expect(page.locator('[data-learning-panel]')).toContainText('No answered practice');
});
test('expanded notes retain readable content at 200 percent zoom with reduced motion',async({page})=>{
  await page.setViewportSize({width:393,height:852});await page.emulateMedia({reducedMotion:'reduce'});await room(page);
  await page.locator('#study-reading > summary').click();const before=await page.locator('.room-daily button').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  await page.evaluate(()=>document.documentElement.style.fontSize=(parseFloat(getComputedStyle(document.documentElement).fontSize)*2)+'px');
  const after=await page.locator('.room-daily button').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  expect(after).toBeGreaterThanOrEqual(before*2);
  await expect(page.locator('.room-daily button')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await page.locator('.screen').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await expect(page.locator('#study-reading')).toHaveAttribute('open','');
});
test('game answers and hints are readable and rejected choices cannot be retried',async({page})=>{
  await game(page);
  const progress=page.getByRole('progressbar',{name:'Game progress'});
  await expect(progress).toHaveAttribute('aria-valuenow','13');
  await expect(progress).toHaveAttribute('aria-valuemin','0');
  await expect(progress).toHaveAttribute('aria-valuemax','100');
  const q=await answerKey(page),texts=await page.locator('.game-answer strong').allTextContents();
  const wrongs=texts.map((s,i)=>s===q.answer?-1:i).filter(i=>i>=0);expect(wrongs.length).toBeGreaterThanOrEqual(2);
  await page.locator('[data-game-hint]').click();
  expect(await page.locator('.game-answer strong').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.locator('.game-hint').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  const first=page.locator('.game-answer').nth(wrongs[0]);await first.click();await expect(first).toBeDisabled();
  await expect(page.locator('.game-answer:not(:disabled)').first()).toBeFocused();
  expect(await page.locator('.game-answer:not(:disabled)').first().evaluate(e=>e.tabIndex)).toBe(0);
  await first.evaluate(b=>b.click());await expect(page.locator('[data-game-next]')).toHaveCount(0);
  await page.locator('.game-answer').nth(wrongs[1]).click();await expect(page.locator('[data-game-next]')).toBeVisible();
  const row=await page.evaluate(skill=>JSON.parse(localStorage.getItem('abvm-study-learning:v2'))[skill],q.skill);
  expect(row.Attempts).toBe(2);expect(row.IncorrectAttempts).toBe(2);expect(row.LastResolution.independent).toBe(false);
  await expect(page.locator('.game-streak')).toHaveCount(0);
});
test('three complete Math games offer twenty-four distinct questions',async({page})=>{
  test.setTimeout(60000);await page.goto('/#games');const prompts=[];
  for(let round=0;round<3;round++){
    await page.getByRole('button',{name:/Math Dash/}).click();
    for(let i=0;i<8;i++){
      await expect(page.locator('.game-question-card')).toBeVisible();const q=await answerKey(page);prompts.push(q.prompt);
      const texts=await page.locator('.game-answer strong').allTextContents();await page.locator('.game-answer').nth(texts.indexOf(q.answer)).click();
      await page.locator('[data-game-next]').click();
    }
    await expect(page.locator('.game-finish')).toBeVisible();await expect(page.locator('.game-finish')).toContainText('counts are skills');
    if(round<2)await page.locator('[data-game-home]').last().click();
  }
  expect(new Set(prompts).size).toBe(24);
});
test('new Study and game surfaces have no serious automated accessibility findings',async({page})=>{
  await room(page);const errors=[];
  for(const tab of ['weekly','cumulative','star','games']){
    await page.locator(`.hub-tabs [data-tab="${tab}"]`).click();
    const result=await new AxeBuilder({page}).analyze();errors.push(...result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({tab,id:v.id})));
  }
  await game(page);await page.locator('[data-game-hint]').click();
  const result=await new AxeBuilder({page}).analyze();errors.push(...result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({tab:'Math Dash',id:v.id})));
  expect(errors).toEqual([]);
});

for(const [name,payload] of [['schoolwork.json',{lessons:'broken'}],['study-archive.json',{notes:'broken'}]]){
 test(`malformed ${name} offers recovery without hiding current notes`,async({page})=>{
  let broken=true;
  await page.route('**/data/'+name,route=>broken?route.fulfill({json:payload}):route.continue());
  await page.goto('/#study');
  await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','error');
  await expect(page.locator('[data-retry]')).toBeVisible();
  await expect(page.locator('.room-subject-grid > .study-accordion')).toHaveCount(6);
  broken=false;await page.locator('[data-retry]').click();
  await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','ready');
  await expect(page.locator('[data-test]')).toBeVisible();
 });
}
test('test completion storage failure leaves the next test recoverable',async({page})=>{
 await room(page);
 const before=await page.locator('.hub-prep h3').innerText();
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='abvm-completed-tests')throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};});
 await page.locator('.room-test-options > summary').click();await page.locator('[data-complete-test]').click();
 await expect(page.locator('.hub-prep h3')).toHaveText(before);
 await expect(page.locator('.hub-undo')).toContainText('Could not save');
 await expect(page.locator('[data-test]')).toBeVisible();
});

test('Undo returns keyboard focus to visible test practice',async({page})=>{
 await room(page);await page.locator('.room-test-options > summary').click();
 await page.locator('[data-complete-test]').click();
 const undo=page.locator('[data-undo-test]');await expect(undo).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('[data-test]')).toBeFocused();await expect(page.locator('[data-test]')).toBeVisible();
});
