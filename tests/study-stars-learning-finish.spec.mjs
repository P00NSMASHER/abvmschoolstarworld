import { test, expect } from '@playwright/test';

async function clearStarLedger(page){
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase('abvm-study-stars-v1');
    request.onsuccess=()=>resolve();
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Study Star DB delete blocked'));
  }));
}

async function answerPerfectRound(page){
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  for(let i=0;i<8;i++){
    const card=page.locator('.game-question-card');
    await expect(card).toBeVisible();
    const prompt=(await card.locator('h2').innerText()).trim();
    const choices=(await card.locator('[data-game-answer] strong').allTextContents()).map(x=>x.trim());
    const answerIndex=await page.evaluate(async ({prompt,choices})=>{
      const envelope=await fetch('./data/study-pack.json',{cache:'no-store'}).then(r=>r.json());
      const engine=window.ABVMStudyGames;
      const sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
      const catalog=engine.buildCatalog(envelope.pack,{sourceKey});
      const question=catalog.questions.find(q=>q.prompt===prompt&&q.choices.length===choices.length&&q.choices.every((choice,index)=>choice===choices[index]));
      if(!question)throw new Error('Could not resolve rendered question');
      return question.choices.indexOf(question.answer);
    },{prompt,choices});
    expect(answerIndex).toBeGreaterThanOrEqual(0);
    await card.locator('[data-game-answer]').nth(answerIndex).click();
    await page.locator('[data-game-next]').click();
  }
}

test.beforeEach(async ({page})=>{
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
  await clearStarLedger(page);
  await page.evaluate(()=>{
    localStorage.removeItem('abvm-study-stars-goal:v1');
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

test('learning-first summary keeps the strongest valid evidence for each skill regardless of event order',async({page})=>{
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
  expect(html).toContain('game-finish-stars');
  expect(html.indexOf('learning-summary')).toBeLessThan(html.indexOf('game-finish-stars'));
  expect(html.indexOf('learning-summary')).toBeLessThan(html.indexOf('study-star-earned'));
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

test('perfect round auto-saves one completion reward, survives rerender, and removes reduced-motion reveal',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await answerPerfectRound(page);
  await expect(page.getByRole('heading',{name:'What you learned'})).toBeVisible();
  await expect(page.locator('.study-star-earned')).toContainText('+10 Study Stars');
  const firstBalance=await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance());
  expect(firstBalance).toBe(10);

  const goalButton=page.locator('[data-study-star-goal]');
  await expect(goalButton).toBeVisible();
  await goalButton.click();
  await expect(page.locator('.study-star-goal-selected')).toContainText(/Goal selected|Unlocked/);
  const afterRerender=await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance());
  expect(afterRerender).toBe(10);

  await page.waitForTimeout(1350);
  await expect(page.locator('[data-reward-reveal]')).toHaveCount(0);
});

test('Step 9 freezes source key and session seed for reward identity and advances all PWA assets together',async({page})=>{
  const [app,index,sw]=await Promise.all([
    page.request.get('/app.js').then(r=>r.text()),
    page.request.get('/index.html').then(r=>r.text()),
    page.request.get('/sw.js').then(r=>r.text())
  ]);
  expect(app).toContain('sourceKey=currentGameSourceKey(),sessionSeed=engine.nextSessionSeed');
  expect(app).toContain('sourceKey,sessionSeed,learningEvents');
  expect(app).toContain('const sourceKey=g.sourceKey||currentGameSourceKey()');
  expect(app).toContain('studyStarRoundId({sourcePack:sourceKey,mode:g.mode,sessionSeed:g.sessionSeed})');
  expect(app).toContain('commitStudyStarRewards({sourcePack:sourceKey,roundId,completed:true,comebackSucceeded:!!g.comebackSucceeded})');
  expect(app).toContain('./study-games.js?v=87');
  expect(app).toContain('./study-games-view.js?v=3');
  expect(index).toContain('./styles.css?v=95');
  expect(index).toContain('./app.js?v=97');
  expect(sw).toContain('v97-study-games-learning-first');
  expect(sw).toContain('./study-games.js?v=87');
  expect(sw).toContain('./study-games-view.js?v=3');
});
