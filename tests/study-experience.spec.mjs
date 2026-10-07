import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
async function room(page){
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
}
async function game(page){
  await page.goto('/#games');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await page.locator('[data-game-start="math"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
}
async function placeValueGame(page){
  await page.goto('/#games');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  const source=await page.evaluate(async()=>{
    const [envelope,schoolwork]=await Promise.all([
      fetch('./data/study-pack-runtime.json').then(response=>response.json()),
      fetch('./data/schoolwork.json').then(response=>response.json())
    ]);
    const engine=window.ABVMStudyGames,sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    const questions=engine.buildCatalog(envelope.pack,{sourceKey}).questions
      .filter(q=>q.subject==='Math'&&q.skill==='place-value'&&q.richContent?.kind==='place-value').slice(0,5);
    return {envelope,schoolwork,questions};
  });
  expect(source.questions).toHaveLength(5);
  // Reuse the real original-practice questions, including their validated blank
  // charts, in an isolated saved bank. Saved items lead the round before fallback.
  for(const key of ['contentPipeline','recentReviewPipeline']){
    source.envelope.pack[key]={...source.envelope.pack[key],
      skills:source.envelope.pack[key].skills.filter(row=>row.subject!=='Math'),
      questions:source.envelope.pack[key].questions.filter(row=>row.subject!=='Math')};
  }
  const lesson={id:'public-place-value-practice',title:'Original place-value practice',subject:'Math',
    sources:[],skills:['place-value'],notes:[],studiedOn:null,dateStatus:'undated',questions:source.questions};
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:source.envelope}));
  await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{notes:[],vocabulary:[],questions:[]}}));
  await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{...source.schoolwork,lessons:[lesson]}}));
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await page.locator('[data-game-start="math"]').click();
  await expect(page.locator('.game-topbar > div > strong')).toHaveText('1 of 8');
  return source.questions;
}
async function answerKey(page){
  const prompt=await page.locator('.game-question-card > h2').innerText();
  return page.evaluate(async prompt=>{
    const envelope=await fetch('./data/study-pack-runtime.json').then(r=>r.json());
    const e=window.ABVMStudyGames,c=e.buildCatalog(envelope.pack,{sourceKey:e.sourceKeyFromEnvelope(envelope.pack,envelope)});
    const q=c.questions.find(q=>q.prompt===prompt);
    if(!q)throw Error('Presented question is not in its source catalog');
    return {answer:q.answer,prompt:q.prompt,skill:q.skill};
  },prompt);
}
async function richTextMetrics(page){
  return page.locator('.rich-place-value small,.rich-place-value figcaption').evaluateAll(nodes=>nodes.map(node=>({
    text:node.textContent.trim(),fontSize:parseFloat(getComputedStyle(node).fontSize),
    clipped:node.clientWidth>0&&node.scrollWidth>node.clientWidth+1
  })));
}
for(const size of [{width:393,height:852},{width:768,height:1024},{width:320,height:740},{width:852,height:393}]){
 test(`integrated Games geometry at ${size.width}x${size.height}`,async({page},info)=>{
    await page.setViewportSize(size);await room(page);
    const cards=page.locator('.study-game-grid > .study-game-tile');await expect(cards).toHaveCount(5);
    const tileFonts=await cards.locator('.study-game-copy > strong').evaluateAll(titles=>titles.map(title=>({label:title.textContent.trim(),fontSize:parseFloat(getComputedStyle(title).fontSize)})));
    expect(tileFonts).toHaveLength(5);
    for(const title of tileFonts)expect(title.fontSize,`${title.label} title is at least 16px`).toBeGreaterThanOrEqual(16);
    const metricsPath=info.outputPath('games-home-text-metrics.json');
    await writeFile(metricsPath,JSON.stringify({viewport:size,titles:tileFonts},null,2));
    await info.attach('Games tile text metrics',{path:metricsPath,contentType:'application/json'});
    const geometry=await page.evaluate(()=>{
      const box=s=>document.querySelector(s).getBoundingClientRect().toJSON(),screen=document.querySelector('.screen');
      return {first:box('.study-test-primary'),grid:box('.study-game-grid'),nav:box('.bottom-nav'),overflow:screen.scrollWidth>screen.clientWidth+1};
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.nav.bottom).toBeLessThanOrEqual(size.height+1);
    if(size.width===393)expect(geometry.first.bottom).toBeLessThanOrEqual(geometry.nav.top);
    const small=await page.locator('.screen button:visible').evaluateAll(bs=>bs.filter(b=>b.getBoundingClientRect().height<43.5).map(b=>b.textContent));
    expect(small).toEqual([]);
    await expect(page.locator('[data-study-source],[data-game-start="daily"]')).toHaveCount(0);
    const path=info.outputPath(`games-home-${size.width}x${size.height}.png`);
    await page.screenshot({animations:"disabled",path});await info.attach('home',{path,contentType:'image/png'});
 });
}
test('material selection, notes and test management are keyboard operable',async({page})=>{
  await room(page);
  for(const selector of ['[data-study-notes]','[data-study-test-options]']){
    const drawer=page.locator(selector);await expect(drawer).not.toHaveAttribute('open','');
    const summary=drawer.locator(':scope > summary');
    await summary.focus();await page.keyboard.press('Enter');await expect(drawer).toHaveAttribute('open','');
    await expect(summary).toBeFocused();
  }
  await expect(page.locator('[data-learning-panel]')).toHaveCount(0);
});
test('expanded notes reflow at 200 percent text size with reduced motion',async({page},info)=>{
  await page.setViewportSize({width:393,height:852});await page.emulateMedia({reducedMotion:'reduce'});await room(page);
  await page.locator('[data-study-notes] > summary').click();
  const lesson=page.locator('.game-material-lesson').first();await lesson.locator('summary').click();
  const title=page.locator('.study-game-copy strong').first();
  const before=await title.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  await page.evaluate(()=>document.documentElement.style.fontSize=(parseFloat(getComputedStyle(document.documentElement).fontSize)*2)+'px');
  expect(await title.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(before*2-.1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const reflow=await page.locator('.screen').evaluate(e=>({content:e.scrollWidth,available:e.clientWidth}));
  expect(reflow.content,'expanded notes at 200 percent text size').toBeLessThanOrEqual(reflow.available+1);
  await expect(lesson).toHaveAttribute('open','');await expect(lesson.locator('li').first()).toBeVisible();
  await page.screenshot({animations:"disabled",path:info.outputPath('study-notes-200-percent-iphone.png')});
});
test('game answers and hints are readable and rejected choices cannot be retried',async({page},info)=>{
  await page.setViewportSize({width:393,height:852});
  const questions=await placeValueGame(page);
  const progress=page.getByRole('progressbar',{name:'Game progress'});
  await expect(progress).toHaveAttribute('aria-valuenow','13');
  await expect(progress).toHaveAttribute('aria-valuemin','0');
  await expect(progress).toHaveAttribute('aria-valuemax','100');
  const prompt=await page.locator('.game-question-card > h2').innerText();
  const q=questions.find(question=>question.prompt===prompt);
  expect(q,'the displayed question comes from the real place-value bank').toBeTruthy();
  const figure=page.locator('.rich-place-value');await expect(figure).toBeVisible();
  await expect(figure.locator('small')).toHaveText(['Hundreds','Tens','Ones']);
  await expect(figure.locator('figcaption')).toHaveText('Use the number in the question to fill the chart');
  const texts=await page.locator('.game-answer strong').allTextContents();
  const wrongs=texts.map((s,i)=>s===q.answer?-1:i).filter(i=>i>=0);expect(wrongs.length).toBeGreaterThanOrEqual(2);
  await page.locator('[data-game-hint]').click();
  expect(await page.locator('.game-answer strong').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.locator('.game-hint').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  const first=page.locator('.game-answer').nth(wrongs[0]);await first.click();await expect(first).toBeDisabled();
  await expect(page.locator('.game-answer:not(:disabled)').first()).toBeFocused();
  expect(await page.locator('.game-answer:not(:disabled)').first().evaluate(e=>e.tabIndex)).toBe(0);
  const normalTriedSize=await first.evaluate(el=>parseFloat(getComputedStyle(el,'::after').fontSize));
  expect(normalTriedSize).toBeGreaterThanOrEqual(14);
  const normalRich=await richTextMetrics(page);
  expect(normalRich).toHaveLength(4);
  for(const row of normalRich){expect(row.fontSize,row.text+' is readable').toBeGreaterThanOrEqual(16);expect(row.clipped).toBe(false);}
  const previousFont=await page.evaluate(()=>{
    const root=document.documentElement,previous=root.style.fontSize;
    root.style.fontSize=(parseFloat(getComputedStyle(root).fontSize)*2)+'px';return previous;
  });
  try{
    await expect(first).toBeDisabled();
    await expect(page.locator('.game-feedback.retry')).toBeVisible();
    const tried=await first.evaluate(el=>{
      const style=getComputedStyle(el,'::after'),context=document.createElement('canvas').getContext('2d');
      context.font=style.font||`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text=style.content.replace(/^["']|["']$/g,'');
      return {text,fontSize:parseFloat(style.fontSize),textWidth:context.measureText(text).width,availableWidth:parseFloat(style.width)};
    });
    expect(tried.text).toBe('Tried');expect(tried.fontSize).toBeGreaterThanOrEqual(normalTriedSize*2-.1);
    expect(tried.textWidth,'Tried fits on one line at doubled text size').toBeLessThanOrEqual(tried.availableWidth+1);
    const displayedRich=await richTextMetrics(page);
    expect(displayedRich.map(row=>row.text)).toEqual(normalRich.map(row=>row.text));
    for(let i=0;i<displayedRich.length;i++){
      expect(displayedRich[i].fontSize,displayedRich[i].text+' follows the root text size').toBeGreaterThanOrEqual(normalRich[i].fontSize*2-.1);
      expect(displayedRich[i].clipped,displayedRich[i].text+' is not clipped').toBe(false);
    }
    const metricsPath=info.outputPath('games-retry-text-metrics.json');
    await writeFile(metricsPath,JSON.stringify({viewport:{width:393,height:852},scale:2,prompt:q.prompt,tried,normalRich,displayedRich},null,2));
    await info.attach('Retry and figure text metrics',{path:metricsPath,contentType:'application/json'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator('.games-screen').evaluate(el=>{el.scrollTop=0;});
    let path=info.outputPath('games-retry-200-percent-iphone-top.png');
    await page.screenshot({animations:"disabled",path});await info.attach('Doubled-text retry question',{path,contentType:'image/png'});
    const retry=page.locator('.game-feedback.retry');
    if(await retry.evaluate(el=>el.getBoundingClientRect().bottom>innerHeight-document.querySelector('.bottom-nav').getBoundingClientRect().height)){
      await retry.scrollIntoViewIfNeeded();
      path=info.outputPath('games-retry-200-percent-iphone-controls.png');
      await page.screenshot({animations:"disabled",path});await info.attach('Doubled-text retry controls',{path,contentType:'image/png'});
    }
  }finally{await page.evaluate(font=>{document.documentElement.style.fontSize=font;},previousFont);}
  await first.evaluate(b=>b.click());await expect(page.locator('[data-game-next]')).toHaveCount(0);
  await page.locator('.game-answer').nth(wrongs[1]).click();await expect(page.locator('[data-game-next]')).toBeVisible();
  const row=await page.evaluate(skill=>JSON.parse(localStorage.getItem('abvm-study-learning:v2'))[skill],q.skill);
  expect(row.Attempts).toBe(2);expect(row.IncorrectAttempts).toBe(2);expect(row.LastResolution.independent).toBe(false);
  await expect(page.locator('.game-streak')).toContainText('Miss streak 1');
  await expect(page.locator('.game-streak')).toContainText('-1');
});
test('three complete Math rounds rotate through the available current material',async({page})=>{
  test.setTimeout(60000);await page.goto('/#games');await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');const prompts=[];
  const pool=await page.evaluate(async()=>{
    const envelope=await fetch('./data/study-pack-runtime.json').then(r=>r.json()),engine=window.ABVMStudyGames;
    return engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)}).questions.filter(q=>q.subject==='Math'&&q.tier==='material').map(q=>q.prompt);
  });
  expect(pool.length).toBeGreaterThanOrEqual(8);
  for(let round=0;round<3;round++){
    await page.locator('[data-game-start="math"]').click();
    const roundPrompts=[];
    for(let i=0;i<8;i++){
      await expect(page.locator('.game-question-card')).toBeVisible();const q=await answerKey(page);prompts.push(q.prompt);roundPrompts.push(q.prompt);expect(pool).toContain(q.prompt);
      const texts=await page.locator('.game-answer strong').allTextContents();await page.locator('.game-answer').nth(texts.indexOf(q.answer)).click();
      await page.locator('[data-game-next]').click();
    }
    expect(new Set(roundPrompts).size).toBe(8);
    if(round===1&&pool.length>8)expect(new Set(prompts).size).toBeGreaterThan(8);
    await expect(page.locator('.game-finish')).toBeVisible();await expect(page.locator('.game-finish')).toContainText('counts are skills');
    if(round<2)await page.locator('[data-game-home]').last().click();
  }
  expect(new Set(prompts).size).toBe(Math.min(24,pool.length));
});
test('new Study and game surfaces have no serious automated accessibility findings',async({page})=>{
  // Contrast belongs to the visible resting surface. Wait for finite navigation
  // and disclosure transitions without disabling motion or ignoring any rule.
  const settle=()=>page.locator('.screen').evaluate(async screen=>{
    await Promise.all(screen.getAnimations({subtree:true}).filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
  });
  await room(page);const errors=[];
  await page.locator('[data-study-notes] > summary').click();
  await page.locator('[data-study-test-options] > summary').click();
  await settle();const homeResult=await new AxeBuilder({page}).analyze();
  errors.push(...homeResult.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({surface:'Study',id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))})));
  await game(page);await page.locator('[data-game-hint]').click();await settle();
  const result=await new AxeBuilder({page}).analyze();errors.push(...result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({surface:'Math',id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))})));
  expect(errors).toEqual([]);
});

for(const [name,payload] of [['schoolwork.json',{lessons:'broken'}],['study-archive.json',{notes:'broken'}]]){
 test(`malformed ${name} offers recovery without hiding current notes`,async({page})=>{
  let broken=true;
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
  await page.route('**/data/'+name+'*',route=>broken?route.fulfill({json:payload}):route.continue());
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','partial');
  await expect(page.locator('[data-study-retry]')).toBeVisible();
  await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(5);
  await page.locator('[data-study-notes] > summary').click();
  await expect(page.locator('[data-study-notes]')).toContainText('Reading / ELA');
  broken=false;await page.locator('[data-study-retry]').click();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await expect(page.locator('[data-test-single]')).toBeVisible();
 });
}
test('test completion storage failure leaves the next test recoverable',async({page})=>{
 await room(page);
 const before=await page.locator('[data-study-tests]').innerText();
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='abvm-completed-tests')throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};});
 await page.locator('[data-study-test-options] > summary').click();await page.locator('[data-complete-test]').click();
 await expect(page.locator('[data-study-tests]')).toHaveText(before,{useInnerText:true});
 await expect(page.locator('.game-test-status')).toContainText('Could not save');
 await expect(page.locator('[data-test-single]')).toBeVisible();
});

test('Undo returns keyboard focus to visible test practice',async({page})=>{
 await room(page);await page.locator('[data-study-test-options] > summary').click();
 await page.locator('[data-complete-test]').click();
 const undo=page.locator('[data-undo-test]');await expect(undo).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('[data-test-single]')).toBeFocused();await expect(page.locator('[data-test-single]')).toBeVisible();
});
