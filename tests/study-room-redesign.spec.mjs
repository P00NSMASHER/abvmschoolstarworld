import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
async function openStudy(page,hash='study'){
  await page.goto('/#'+hash);
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(5);
}
async function capture(page,info,name){
  const path=info.outputPath(name+'.png');await page.screenshot({animations:"disabled",path,fullPage:true});await info.attach(name,{path,contentType:'image/png'});
}
async function visibleAnswer(page){
  const prompt=await page.locator('.game-question-card > h2').textContent();
  return page.evaluate(async prompt=>{
    const [envelope,work,archive]=await Promise.all(['study-pack-runtime.json','schoolwork.json','study-archive.json'].map(name=>fetch('./data/'+name).then(r=>r.json())));
    const engine=window.ABVMStudyGames;
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)});
    const {buildStarBank}=await import('./star-practice.mjs');
    const choices=[...document.querySelectorAll('[data-game-answer] strong')].map(b=>b.textContent.trim());
    const q=[...catalog.questions,...buildStarBank(),...work.lessons.flatMap(l=>l.questions||[]),...archive.questions].find(item=>item.prompt===prompt&&item.choices.length===choices.length&&item.choices.every(c=>choices.includes(c)));
    return q?{answer:q.answer,choices,skill:q.skill}:null;
  },prompt);
}
async function controlledTests(page,events,{emptyBanks=false}={}){
  const fixture=structuredClone(await (await page.request.get('/data/study-pack.json')).json());fixture.pack.importantDates=events;
  if(emptyBanks){
    fixture.pack.questions=[];fixture.pack.contentPipeline={...fixture.pack.contentPipeline,skills:[],questions:[]};fixture.pack.recentReviewPipeline={...fixture.pack.recentReviewPipeline,skills:[],questions:[]};
    await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{lessons:[],uploadedPhotoCount:0}}));
    await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{questions:[],notes:[],vocabulary:[]}}));
  }
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00Z'));
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:fixture}));
}
for(const [width,height] of [[393,852],[768,1024]]){
  test(`five subject choices integrate current notes and preserve learning at ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height});
    await page.addInitScript(()=>localStorage.setItem('abvm-study-learning:v2',JSON.stringify({'place-value':{Attempts:5,Correct:3,LastSeenAt:Date.now()-3*86400000}})));
    await openStudy(page);const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));
    await expect(page.locator('.bottom-nav [data-tab="study"]')).toHaveCount(1);
    await expect(page.locator('[data-study-source],.daily-practice,[data-game-start="daily"],.review-skill-chip,input[type="file"]')).toHaveCount(0);
    for(const [id,label] of [['reading','Reading'],['spelling','Spelling'],['math','Math'],['religion','Religion'],['mix','Mix']])await expect(page.locator(`.study-game-grid [data-game-start="${id}"]`)).toContainText(label);
    await expect(page.locator('.study-game-grid [data-game-start="reading"]')).toHaveAccessibleName('Reading / ELA');
    await expect(page.locator('[data-study-notes]')).not.toHaveAttribute('open','');
    const geometry=await page.locator('.study-game-tile').evaluateAll(nodes=>({smallest:Math.min(...nodes.map(el=>el.getBoundingClientRect().height)),overflow:document.documentElement.scrollWidth>innerWidth+2}));
    expect(geometry.smallest).toBeGreaterThanOrEqual(44);expect(geometry.overflow).toBe(false);await capture(page,info,`study-home-${width}`);
    await page.locator('[data-study-notes] > summary').click();await page.locator('.game-material-lesson').first().locator('summary').click();
    await page.locator('[data-study-test-options] > summary').click();await capture(page,info,`study-notes-guides-${width}`);
    await page.evaluate(()=>document.documentElement.style.zoom='2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
    await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.study-game-tile').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
    expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);await page.evaluate(()=>document.documentElement.style.zoom='');await openStudy(page,'games');
  });
}
test('all five subjects and the native test chooser are keyboard operable',async({page})=>{
  await openStudy(page);
  const select=page.locator('[data-test-select]');await select.focus();await page.keyboard.press('End');await page.keyboard.press('Enter');await expect(select).toBeFocused();
  for(const id of ['reading','spelling','math','religion','mix']){
    const button=page.locator(`[data-game-start="${id}"]`);await expect(button).toBeEnabled();await button.focus();await page.keyboard.press('Enter');
    await expect(page.locator('.game-question-card')).toBeVisible();await expect(page.locator('[data-game-answer]').first()).toBeVisible();await page.locator('[data-game-home]').click();
  }
});
test('read-aloud never records an answer and cancels when leaving practice',async({page},info)=>{
  await page.addInitScript(()=>{window.__speech={spoken:[],cancelled:0};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){window.__speech.cancelled++;},speak(u){window.__speech.spoken.push(u.text);}}});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};});
  await openStudy(page);await page.locator('[data-game-start="math"]').click();const prompt=await page.locator('.game-question-card > h2').textContent();
  const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));await page.getByRole('button',{name:'Read to me',exact:true}).click();
  expect(await page.evaluate(()=>window.__speech.spoken)).toHaveLength(1);expect(await page.evaluate(()=>window.__speech.spoken[0])).toContain(prompt);
  expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);await expect(page.locator('.game-feedback')).toHaveCount(0);
  const q=await visibleAnswer(page);expect(q).not.toBeNull();await page.locator('[data-game-answer]').nth(q.choices.indexOf(q.answer)).click();await expect(page.locator('.game-feedback.correct')).toBeVisible();
  await capture(page,info,'study-question');await page.locator('[data-game-home]').click();expect(await page.evaluate(()=>window.__speech.cancelled)).toBeGreaterThanOrEqual(2);
});
test('loading saved material keeps current questions playable without replacing an active round',async({page})=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});await page.route('**/data/schoolwork.json*',async route=>{await pending;await route.continue();});
  await page.goto('/#study');try{
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','loading');await expect(page.locator('.game-material-status[role="status"]')).toContainText('Loading saved materials');
    await page.locator('[data-game-start="math"]').click();await expect(page.locator('.game-question-card')).toBeVisible();const prompt=await page.locator('.game-question-card > h2').innerText();release();
    await expect(page.locator('.game-question-card > h2')).toHaveText(prompt);await page.locator('[data-game-home]').click();await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  }finally{release();}
});
test('wrong choices stay rejected and cannot consume a second attempt',async({page})=>{
  await openStudy(page);await page.locator('[data-game-start="math"]').click();const q=await visibleAnswer(page);expect(q).not.toBeNull();
  const wrong=q.choices.findIndex(c=>c!==q.answer),first=page.locator('[data-game-answer]').nth(wrong);await first.click();await expect(first).toBeDisabled();await expect(first).toHaveClass(/wrong/);await expect(page.locator('.game-feedback.retry')).toBeVisible();
  await expect(page.locator('[data-game-next]')).toHaveCount(0);await expect(page.locator('[data-game-answer]:not(:disabled)').first()).toBeFocused();await first.evaluate(b=>b.click());await expect(page.locator('[data-game-next]')).toHaveCount(0);
  await page.locator('[data-game-answer]').nth(q.choices.indexOf(q.answer)).click();await expect(page.locator('.game-feedback.correct')).toBeVisible();
  const rows=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('abvm-study-learning:v2'))).filter(r=>r.Attempts>0));expect(rows).toHaveLength(1);expect(rows[0].Attempts).toBe(2);expect(rows[0].IncorrectAttempts).toBe(1);expect(rows[0].LastResolution.independent).toBe(false);
});
test('test completion can be undone immediately or restored after reload',async({page})=>{
  await controlledTests(page,[{date:'Wednesday, Oct. 7',label:'Reading',kind:'test'},{date:'Friday, Oct. 9',label:'Grammar (subject & predicate)',kind:'test'}]);await openStudy(page);
  const prep=page.locator('[data-study-tests]');await expect(prep).toContainText('Reading');await page.locator('[data-study-test-options] > summary').click();await page.locator('[data-complete-test]').click();await expect(page.locator('[data-undo-test]')).toBeVisible();
  await expect(prep).toContainText('Grammar (subject & predicate)');await page.locator('[data-undo-test]').click();await expect(prep).toContainText('Reading');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abvm-completed-tests')))).toEqual([]);
  if(!await page.locator('[data-study-test-options]').evaluate(el=>el.open))await page.locator('[data-study-test-options] > summary').click();await page.locator('[data-complete-test]').click();await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');await expect(prep).toContainText('Grammar (subject & predicate)');await page.locator('[data-study-test-options] > summary').click();await page.locator('[data-restore-test]').first().click();await expect(prep).toContainText('Reading');
});
test('selected test discloses fallback while unsupported same-day tests fail closed',async({page})=>{
  await controlledTests(page,[{date:'Friday, Oct. 9',label:'Spelling (short i / long i)',kind:'test'},{date:'Friday, Oct. 9',label:'History',kind:'test'}],{emptyBanks:true});await openStudy(page);
  const prep=page.locator('[data-study-tests]');await page.locator('[data-test-select]').selectOption({label:'Spelling (short i / long i) - Fri, Oct 9'});await expect(prep.locator('h3')).toHaveText('Spelling (short i / long i)');await expect(prep.locator('[data-test-fallback]')).toContainText('original Grade 2 skill practice');
  await page.locator('[data-test-single]').click();await expect(page.locator('.game-question-card')).toBeVisible();const prompt=await page.locator('.game-question-card > h2').textContent();
  expect(await page.evaluate(async text=>{const {buildStarBank}=await import('./star-practice.mjs');const {questionsForTest}=await import('./study-hub-core.mjs');return questionsForTest({label:'Spelling (short i / long i)'},buildStarBank()).some(q=>q.prompt===text);},prompt)).toBe(true);
  await page.locator('[data-game-home]').click();await page.locator('[data-test-select]').selectOption({label:'History - Fri, Oct 9'});await expect(prep.locator('h3')).toHaveText('History');await expect(prep.locator('[data-test-missing]')).toContainText('No verified questions match');await expect(page.locator('[data-test-single]')).toBeDisabled();
});
