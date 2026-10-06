import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
async function openGames(page,hash='study'){
  await page.goto('/#'+hash);
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
}
async function capture(page,info,name){
  const path=info.outputPath(name+'.png');
  await page.screenshot({path,fullPage:true});
  await info.attach(name,{path,contentType:'image/png'});
}

for(const [width,height] of [[393,852],[768,1024]]){
  test(`the existing Games home integrates material and reflows at ${width}x${height}`,async({page},info)=>{
    await page.setViewportSize({width,height});
    await page.addInitScript(()=>localStorage.setItem('abvm-study-learning:v2',JSON.stringify({
      'place-value':{Attempts:5,Correct:3,LastSeenAt:Date.now()-3*86400000,LastResolution:{correct:false,independent:false,resolvedAt:Date.now()-3*86400000}}
    })));
    await openGames(page);
    const learning=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));
    await expect(page.locator('.bottom-nav [data-tab="study"]')).toHaveCount(1);
    await expect(page.locator('.study-room-v2,#study-hub,.study-games-cta')).toHaveCount(0);
    await expect(page.locator('[data-learning-panel],.daily-practice,.review-skill-chip')).toHaveCount(0);
    await expect(page.locator('.games-screen')).not.toContainText('Learning on this device');
    expect(await page.locator('.games-screen').innerText()).not.toMatch(/Place value|Study room/i);
    expect(await page.locator('select[data-study-source] option').evaluateAll(options=>options.map(option=>option.value))).toEqual(['weekly','saved','star','mix']);
    await expect(page.locator('.study-game-grid [data-game-start]')).toHaveCount(4);
    for(const [id,label] of [['quick','Quick Mix'],['math','Math Dash'],['words','Word Power'],['faith','Faith Quest']]){
      await expect(page.locator(`.study-game-grid [data-game-start="${id}"]`)).toContainText(label);
    }
    await expect(page.locator('[data-study-notes]')).not.toHaveAttribute('open','');
    await expect(page.locator('[data-study-test-options]')).not.toHaveAttribute('open','');
    const geometry=await page.evaluate(()=>{
      const grid=document.querySelector('.study-game-grid').getBoundingClientRect();
      const source=document.querySelector('[data-study-source]').getBoundingClientRect();
      const daily=document.querySelector('[data-game-start="daily"]').getBoundingClientRect();
      const controls=[...document.querySelectorAll('.study-game-grid button,[data-study-source],[data-game-start="daily"],[data-study-notes] > summary,[data-study-test-options] > summary')];
      return {sourceBeforeGrid:source.bottom<=grid.top+1,dailyAfterGrid:daily.top>=grid.bottom-1,
        smallest:Math.min(...controls.map(el=>el.getBoundingClientRect().height)),
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2};
    });
    expect(geometry.sourceBeforeGrid).toBe(true);
    expect(geometry.dailyAfterGrid).toBe(true);
    expect(geometry.smallest).toBeGreaterThanOrEqual(44);
    expect(geometry.overflow).toBe(false);
    await capture(page,info,`games-home-${width}`);
    await page.locator('[data-study-source]').selectOption('saved');
    await page.locator('[data-study-notes] > summary').click();
    await expect(page.locator('[data-study-notes]')).toHaveAttribute('open','');
    await page.locator('.game-material-lesson').first().locator('summary').click();
    await page.locator('[data-study-notes] > summary').scrollIntoViewIfNeeded();
    await capture(page,info,`games-saved-notes-${width}`);
    await page.locator('[data-study-test-options] > summary').click();
    await capture(page,info,`games-notes-test-management-${width}`);
    await page.evaluate(()=>document.documentElement.style.zoom='2');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2)).toBe(false);
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await page.locator('.study-game-tile').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
    expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(learning);
    await page.evaluate(()=>document.documentElement.style.zoom='');
    await openGames(page,'games');
    await expect(page.locator('.study-room-v2,#study-hub,.study-games-cta')).toHaveCount(0);
  });
}

test('the native source chooser and existing four game controls are keyboard operable',async({page})=>{
  await openGames(page);
  const source=page.locator('select[data-study-source]');
  await source.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(source).toHaveValue('mix');
  await expect(source).toBeFocused();
  await expect(page.locator('[data-study-mix]')).toBeVisible();
  const saved=page.locator('[data-study-pick="saved"]');
  const selected=await saved.isChecked();
  await saved.focus();await page.keyboard.press('Space');
  expect(await saved.isChecked()).toBe(!selected);
  await expect(saved).toBeFocused();
  await source.selectOption('weekly');
  for(const id of ['quick','math','words','faith']){
    const button=page.locator(`.study-game-grid [data-game-start="${id}"]`);
    await button.focus();await page.keyboard.press('Enter');
    await expect(page.locator('.game-question-card')).toBeVisible();
    await expect(page.locator('[data-game-answer]').first()).toBeVisible();
    await page.locator('[data-game-home]').click();
    await expect(page.locator('.study-game-grid')).toBeVisible();
  }
});

test('the existing question player supports explicit read-aloud without recording an answer',async({page},info)=>{
  await page.addInitScript(()=>{
    window.__gamesSpeech={spoken:[],cancelled:0};
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      cancel(){window.__gamesSpeech.cancelled++;},
      speak(utterance){window.__gamesSpeech.spoken.push(utterance.text);}
    }});
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  });
  await page.setViewportSize({width:393,height:852});
  await openGames(page);
  await page.locator('[data-study-source]').selectOption('star');
  await page.locator('[data-game-start="math"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  await expect(page.locator('.study-game-grid')).toHaveCount(0);
  await expect(page.locator('.hub-round')).toHaveCount(0);
  const prompt=await page.locator('.game-question-card > h2').textContent();
  const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));
  await page.getByRole('button',{name:'Read to me',exact:true}).click();
  expect(await page.evaluate(()=>window.__gamesSpeech.spoken)).toHaveLength(1);
  expect(await page.evaluate(()=>window.__gamesSpeech.spoken[0])).toContain(prompt);
  expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);
  await expect(page.locator('.game-feedback')).toHaveCount(0);
  const answer=await visibleAnswer(page);
  expect(answer).not.toBeNull();
  const correctIndex=answer.choices.indexOf(answer.answer);
  expect(correctIndex).toBeGreaterThanOrEqual(0);
  await page.locator('[data-game-answer]').nth(correctIndex).click();
  await expect(page.locator('.game-feedback.correct')).toBeVisible();
  await expect(page.locator('[data-game-next]')).toBeVisible();
  await capture(page,info,'games-question-iphone');
  await page.locator('[data-game-home]').click();
  await expect(page.locator('.study-game-grid')).toBeVisible();
  expect(await page.evaluate(()=>window.__gamesSpeech.cancelled)).toBeGreaterThanOrEqual(2);
});

test('slow saved-material loading does not move the four primary game controls or replace a round',async({page},info)=>{
  await page.setViewportSize({width:393,height:852});
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route('**/data/schoolwork.json*',async route=>{await pending;await route.continue();});
  await page.goto('/#study');
  try{
    await expect(page.locator('.study-game-grid')).toBeVisible();
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','loading');
    await expect(page.locator('[data-study-source]')).toBeDisabled();
    await expect(page.locator('.game-material-status[role="status"]')).toContainText('Loading saved materials');
    await capture(page,info,'games-materials-loading-iphone');
    const scroll=await page.locator('.games-screen').evaluate(el=>el.scrollTop);
    const status=page.locator('.game-material-status[role="status"]');
    await status.scrollIntoViewIfNeeded();
    await expect(status).toBeInViewport({ratio:1});
    await capture(page,info,'games-materials-loading-iphone-status');
    await page.locator('.games-screen').evaluate((el,top)=>{el.scrollTop=top;},scroll);
    const before=await page.locator('.study-game-grid').boundingBox();
    expect(before).not.toBeNull();
    await page.locator('[data-game-start="math"]').click();
    await expect(page.locator('.game-question-card')).toBeVisible();
    const prompt=await page.locator('.game-question-card > h2').innerText();
    release();
    await expect(page.locator('.game-question-card > h2')).toHaveText(prompt);
    await page.locator('[data-game-home]').click();
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
    const after=await page.locator('.study-game-grid').boundingBox();
    expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(8);
    await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
  }finally{release();}
});

test('saved-material failure retains current notes and playable games without an uploader',async({page},info)=>{
  await page.setViewportSize({width:393,height:852});
  await page.route('**/data/schoolwork.json*',route=>route.abort());
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','partial');
  await expect(page.locator('[data-game-start="daily"]')).toBeVisible();
  await expect(page.locator('[data-study-retry]')).toBeVisible();
  await capture(page,info,'games-materials-error-iphone');
  const retry=page.locator('[data-study-retry]');
  await retry.scrollIntoViewIfNeeded();
  await expect(retry).toBeInViewport({ratio:1});
  await capture(page,info,'games-materials-error-iphone-retry');
  await page.locator('[data-study-notes] > summary').click();
  await expect(page.locator('[data-study-notes]')).toContainText('subject');
  await expect(page.locator('[data-study-retry]')).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.locator('[data-game-start="math"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
});

// Public source banks and rendered choices provide the answer, never private
// controller state or an assumed option position.
async function visibleAnswer(page){
  const prompt=await page.locator('.game-question-card > h2').textContent();
  return page.evaluate(async currentPrompt=>{
    const envelope=await fetch('./data/study-pack-runtime.json',{cache:'no-store'}).then(r=>r.json());
    const engine=window.ABVMStudyGames;
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)});
    const {buildStarBank}=await import('./star-practice.mjs');
    const choices=[...document.querySelectorAll('[data-game-answer] strong')].map(b=>b.textContent.trim());
    const q=[...catalog.questions,...buildStarBank()]
      .find(item=>item.prompt===currentPrompt&&item.choices.length===choices.length&&item.choices.every(c=>choices.includes(c)));
    return q?{answer:q.answer,choices,skill:q.skill}:null;
  },prompt);
}

async function controlledTests(page,events,{emptyBanks=false}={}){
  const source=await (await page.request.get('/data/study-pack.json')).json();
  const fixture=structuredClone(source);
  fixture.pack.importantDates=events;
  if(emptyBanks){
    fixture.pack.contentPipeline={...fixture.pack.contentPipeline,skills:[],questions:[]};
    fixture.pack.recentReviewPipeline={...fixture.pack.recentReviewPipeline,skills:[],questions:[]};
    const work=await (await page.request.get('/data/schoolwork.json')).json();
    const archive=await (await page.request.get('/data/study-archive.json')).json();
    await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{...work,lessons:[],uploadedPhotoCount:0}}));
    await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{...archive,questions:[],notes:[],vocabulary:[]}}));
  }
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00Z'));
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:fixture}));
}

test('wrong answers stay rejected in source-selected Games and cannot consume another attempt',async({page})=>{
  await openGames(page);
  await page.locator('[data-study-source]').selectOption('star');
  await page.locator('[data-game-start="math"]').click();
  const row=await visibleAnswer(page);
  expect(row).not.toBeNull();
  const wrongs=row.choices.map((choice,index)=>choice!==row.answer?index:-1).filter(index=>index>=0);
  const correct=row.choices.indexOf(row.answer);
  expect(wrongs.length).toBeGreaterThanOrEqual(1);
  const firstWrong=page.locator('[data-game-answer]').nth(wrongs[0]);
  await firstWrong.click();
  await expect(firstWrong).toBeDisabled();
  await expect(firstWrong).toHaveClass(/wrong/);
  await expect(page.locator('.game-feedback.incorrect')).toBeVisible();
  await expect(page.locator('[data-game-next]')).toHaveCount(0);
  const focusedAfterWrong=await page.evaluate(()=>({
    answer:document.activeElement?.getAttribute('data-game-answer'),disabled:document.activeElement?.disabled===true
  }));
  expect(focusedAfterWrong.answer).not.toBeNull();
  expect(focusedAfterWrong.disabled).toBe(false);
  await firstWrong.evaluate(button=>button.click());
  await expect(page.locator('[data-game-next]')).toHaveCount(0);
  await page.locator('[data-game-answer]').nth(correct).click();
  await expect(page.locator('.game-feedback.correct')).toBeVisible();
  await expect(page.locator('[data-game-next]')).toBeVisible();
  await expect(firstWrong).toBeDisabled();
  const learning=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('abvm-study-learning:v2'))).filter(row=>row.Attempts>0));
  expect(learning).toHaveLength(1);
  expect(learning[0].Attempts).toBe(2);
  expect(learning[0].IncorrectAttempts).toBe(1);
  expect(learning[0].LastResolution.independent).toBe(false);
});

test('test completion has immediate Undo and survives reload with an on-demand restore control',async({page})=>{
  await controlledTests(page,[
    {date:'Wednesday, Oct. 7',label:'Reading',kind:'test'},
    {date:'Friday, Oct. 9',label:'Grammar (subject & predicate)',kind:'test'}
  ]);
  await openGames(page);
  const prep=page.locator('[data-study-tests]');
  await expect(prep).toContainText('Reading');
  await page.locator('[data-study-test-options] > summary').click();
  await page.locator('[data-complete-test]').click();
  await expect(page.locator('[data-undo-test]')).toBeVisible();
  await expect(prep).toContainText('Grammar (subject & predicate)');
  await page.locator('[data-undo-test]').click();
  await expect(prep).toContainText('Reading');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abvm-completed-tests')))).toEqual([]);
  if(!await page.locator('[data-study-test-options]').evaluate(el=>el.open))await page.locator('[data-study-test-options] > summary').click();
  await page.locator('[data-complete-test]').click();
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await expect(prep).toContainText('Grammar (subject & predicate)');
  await page.locator('[data-study-test-options] > summary').click();
  await expect(page.locator('[data-restore-test]').first()).toBeVisible();
  await page.locator('[data-restore-test]').first().click();
  await expect(prep).toContainText('Reading');
});

test('named fallback is disclosed and never hides another unsupported same-day test',async({page})=>{
  await controlledTests(page,[
    {date:'Friday, Oct. 9',label:'Spelling (short i / long i)',kind:'test'},
    {date:'Friday, Oct. 9',label:'History',kind:'test'}
  ],{emptyBanks:true});
  await openGames(page);
  await expect(page.locator('[data-study-tests]')).toContainText('Spelling (short i / long i)');
  await expect(page.locator('[data-study-tests]')).toContainText('Original Grade 2 skill practice');
  await expect(page.locator('[data-study-tests]')).toContainText('History');
  await expect(page.locator('[data-study-tests]')).toContainText(/teacher notes/i);
  await expect(page.locator('[data-test-single]')).toHaveCount(1);
  await expect(page.locator('[data-test-single]')).toContainText('Spelling (short i / long i)');
  await expect(page.locator('[data-test]')).toHaveCount(0);
  await page.locator('[data-test-single]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  const prompt=await page.locator('.game-question-card > h2').textContent();
  const matched=await page.evaluate(async text=>{
    const {buildStarBank}=await import('./star-practice.mjs');
    const {questionsForTest}=await import('./study-hub-core.mjs');
    return questionsForTest({label:'Spelling (short i / long i)'},buildStarBank()).some(q=>q.prompt===text);
  },prompt);
  expect(matched).toBe(true);
  await expect(page.locator('.game-topbar')).not.toContainText('History');
});
