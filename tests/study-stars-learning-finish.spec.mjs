import { test, expect } from '@playwright/test';

async function clearStarLedger(page){
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase('abvm-study-stars-v1');
    request.onsuccess=()=>resolve();
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Study Star DB delete blocked'));
  }));
}

async function resolveRenderedQuestion(page){
  const card=page.locator('.game-question-card');
  await expect(card).toBeVisible();
  const prompt=(await card.locator('h2').innerText()).trim();
  const choices=(await card.locator('[data-game-answer] strong').allTextContents()).map(x=>x.trim());
  return await page.evaluate(async ({prompt,choices})=>{
    const envelope=await fetch('./data/study-pack.json',{cache:'no-store'}).then(r=>r.json());
    const engine=window.ABVMStudyGames;
    const sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey});
    const question=catalog.questions.find(q=>q.prompt===prompt&&q.choices.length===choices.length&&q.choices.every((choice,index)=>choice===choices[index]));
    if(!question)throw new Error('Could not resolve rendered question');
    return {answerIndex:question.choices.indexOf(question.answer),skill:question.skill};
  },{prompt,choices});
}

async function answerPerfectRound(page){
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  for(let i=0;i<8;i++){
    const q=await resolveRenderedQuestion(page);
    expect(q.answerIndex).toBeGreaterThanOrEqual(0);
    await page.locator('.game-question-card [data-game-answer]').nth(q.answerIndex).click();
    await page.locator('[data-game-next]').click();
  }
}

test.beforeEach(async ({page})=>{
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
  await clearStarLedger(page);
  await page.evaluate(()=>{
    localStorage.removeItem('abvm-study-stars-goal:v1');
    localStorage.removeItem('abvm-study-learning:v2');
    for(const key of Object.keys(localStorage)){
      if(key.startsWith('abvm-study-games-session:'))localStorage.removeItem(key);
    }
  });
});

test('learning-first summary counts only independent normal work as Strong today',async({page})=>{
  const summary=await page.evaluate(()=>window.ABVMStudyGames.learningFirstSummary([
    {skill:'math-strong',kind:'normal',correct:true,independent:true},
    {skill:'retry-skill',kind:'normal',correct:true,independent:false},
    {skill:'support-only',kind:'support',correct:true,independent:false},
    {skill:'remember-skill',kind:'normal',correct:false,independent:false},
    {skill:'remember-skill',kind:'comeback',correct:true,independent:false},
  ]));
  expect(summary).toEqual({strong:1,remembered:1,practice:1,total:3});
});

test('learning-first summary keeps strongest valid evidence for each skill regardless of event order',async({page})=>{
  const summary=await page.evaluate(()=>window.ABVMStudyGames.learningFirstSummary([
    {skill:'recover-later',kind:'normal',correct:false,independent:false},
    {skill:'recover-later',kind:'normal',correct:true,independent:true},
    {skill:'stay-strong',kind:'normal',correct:true,independent:true},
    {skill:'stay-strong',kind:'normal',correct:false,independent:false},
    {skill:'remember-only',kind:'normal',correct:false,independent:false},
    {skill:'remember-only',kind:'comeback',correct:true,independent:false},
  ]));
  expect(summary).toEqual({strong:2,remembered:1,practice:0,total:3});
});

test('learning-first finish puts learning evidence before secondary rewards',async({page})=>{
  const html=await page.evaluate(()=>window.ABVMStudyGameView.finish({
    mode:{id:'quick',title:'Quick Mix'},
    state:{questions:Array(8).fill({}),score:6},
    record:{best:7},
    summary:{strong:3,remembered:1,practice:2,total:6},
    reward:{status:'done',awardedAmount:12,currency:'Study Stars',balance:32}
  }));
  expect(html).toContain('What you learned');
  expect(html).toContain('Strong today');
  expect(html).toContain('Remembered later');
  expect(html).toContain('We’ll practice again');
  expect(html).toContain('Round score 6 of 8');
  expect(html).toContain('+12 Study Stars');
  expect(html.indexOf('learning-summary')).toBeLessThan(html.indexOf('game-finish-stars'));
  expect(html.indexOf('learning-summary')).toBeLessThan(html.indexOf('study-star-earned'));
});

test('secondary reward summary stays visually separated and readable',async({page})=>{
  const html=await page.evaluate(()=>window.ABVMStudyGameView.finish({
    mode:{id:'quick',title:'Quick Mix'},
    state:{questions:Array(8).fill({}),score:8},
    record:{best:8},
    summary:{strong:4,remembered:0,practice:0,total:4},
    reward:{status:'done',awardedAmount:10,currency:'Study Stars',balance:10}
  }));
  await page.locator('#app-content').evaluate((node,markup)=>{node.innerHTML=markup},html);
  const reward=page.locator('.study-star-earned.secondary');
  await expect(reward).toBeVisible();
  expect(await reward.evaluate(node=>getComputedStyle(node).borderStyle)).toBe('solid');
  for(const selector of ['span','strong','small']){
    expect(await reward.locator(selector).evaluate(node=>getComputedStyle(node).display)).toBe('block');
  }
});

test('learning-first reward summary cannot display a second currency',async({page})=>{
  const html=await page.evaluate(()=>window.ABVMStudyGameView.finish({
    mode:{id:'quick',title:'Quick Mix'},
    state:{questions:Array(8).fill({}),score:6},
    record:{best:7},
    summary:{strong:3,remembered:1,practice:2,total:6},
    reward:{status:'done',awardedAmount:12,currency:'Coins',balance:32}
  }));
  expect(html).toContain('+12 Study Stars');
  expect(html).not.toContain('Coins');
});

test('question retry and hint evidence resets before the next question',async({page})=>{
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  const first=await resolveRenderedQuestion(page);
  const wrong=(first.answerIndex+1)%3;
  await page.locator('.game-question-card [data-game-answer]').nth(wrong).click();
  await page.locator('.game-question-card [data-game-answer]').nth(first.answerIndex).click();
  await page.locator('[data-game-next]').click();

  const second=await resolveRenderedQuestion(page);
  await page.locator('.game-question-card [data-game-answer]').nth(second.answerIndex).click();
  const row=await page.evaluate(skill=>window.ABVMStudyGames.loadLearning()[skill],second.skill);
  expect(row.LastResolution).toEqual(expect.objectContaining({
    independent:true,attemptCount:1,incorrectCount:0,hintCount:0
  }));
});

test('perfect round auto-saves one completion reward, survives rerender, and removes reduced-motion reveal',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await answerPerfectRound(page);
  await expect(page.getByRole('heading',{name:'What you learned'})).toBeVisible();
  await expect(page.locator('.study-star-earned')).toContainText('+10 Study Stars');
  expect(await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance())).toBe(10);

  const goalButton=page.locator('[data-study-star-goal]');
  await expect(goalButton).toBeVisible();
  await goalButton.click();
  await expect(page.locator('.adaptive-note')).toContainText(/Goal selected|Unlocked/);
  expect(await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance())).toBe(10);

  await page.waitForTimeout(1350);
  await expect(page.locator('[data-reward-reveal]')).toHaveCount(0);
});

test('Step 9 freezes reward identity and advances all PWA assets together',async({page})=>{
  const [app,index,sw]=await Promise.all([
    page.request.get('/app.js').then(r=>r.text()),
    page.request.get('/index.html').then(r=>r.text()),
    page.request.get('/sw.js').then(r=>r.text())
  ]);
  expect(app).toContain('sourceKey=currentGameSourceKey(),sessionSeed=engine.nextSessionSeed');
  expect(app).toContain('sourceKey,sessionSeed,learningEvents');
  expect(app).toContain('studyStarRoundId({sourcePack:sourceKey,mode:g.mode,sessionSeed:g.sessionSeed})');
  expect(app).toContain('commitStudyStarRewards({sourcePack:sourceKey,mode:g.mode,sessionSeed:g.sessionSeed,roundId,completed:true,comebackSucceeded:!!g.comebackSucceeded})');
  expect(app).toContain('tries:0,misses:0,hints:0,retry:0,lastWrong:null');
  expect(app).toContain('./study-games.js?v=92');
  expect(app).toContain('./study-games-view.js?v=6');
  expect(index).toContain('./styles.css?v=96');
  expect(index).toContain('abvm-sw-reloaded-v103');
  expect(index).toContain('./weekly-learning.js?v=2');
  expect(index).toContain('./app.js?v=103');
  expect(sw).toContain('v103-star-gap-fallback');
  expect(sw).toContain('./weekly-learning.js?v=2');
  expect(sw).toContain('./study-games.js?v=92');
  expect(sw).toContain('./study-games-view.js?v=6');
});
