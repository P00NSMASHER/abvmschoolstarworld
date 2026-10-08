import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function openStudy(page){
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00-04:00'));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase('abvm-study-stars-v1');
    request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Badge database deletion blocked'));
  }));
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
}
async function seedStars(page,rounds){
  await page.evaluate(async count=>{
    const engine=window.ABVMStudyGames;
    for(let i=0;i<count;i++)await engine.commitStudyStarRewards({sourcePack:'badge-ui-fixture',mode:'quick',sessionSeed:'seed-'+i,completed:true});
  },rounds);
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
}
async function answerIndexes(page){
  const prompt=(await page.locator('.game-question-card>h2').innerText()).trim();
  const choices=(await page.locator('[data-game-answer] strong').allTextContents()).map(text=>text.trim());
  return page.evaluate(async({prompt,choices})=>{
    const envelope=await fetch('./data/study-pack-runtime.json').then(response=>response.json());
    const engine=window.ABVMStudyGames,{buildStarBank}=await import('./star-practice.mjs');
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)});
    const question=[...catalog.questions,...buildStarBank()].find(row=>row.prompt===prompt&&row.choices.length===choices.length&&row.choices.every(choice=>choices.includes(choice)));
    if(!question)throw new Error('Rendered question must resolve to the actual governed catalog');
    return {correct:choices.indexOf(question.answer),wrong:choices.map((choice,index)=>choice!==question.answer?index:-1).filter(index=>index>=0)};
  },{prompt,choices});
}
const balance=page=>page.evaluate(()=>window.ABVMStudyGames.studyStarBalance());

test('rank collection shows all six promotions and an accessible next-rank path without choosing a goal',async({page})=>{
  await openStudy(page);
  await expect(page.locator('.study-badge-tracker')).toBeVisible();
  await page.locator('[data-open-badges]').first().click();
  const collection=page.locator('[data-badge-collection]');
  await expect(collection).toBeVisible();
  await expect(collection.locator('.study-badge-grid').getByRole('listitem')).toHaveCount(6);
  await expect(collection.locator('.rank-current')).toContainText('Eaglet');
  await expect(collection.locator('.study-badge-next')).toContainText('Star Scout');
  const progress=collection.getByRole('progressbar',{name:'Next rank progress'});
  await expect(progress).toHaveAttribute('aria-valuenow','0');
  await expect(progress).toHaveAttribute('aria-valuemax','50');
  const targets=await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCatalog().map(badge=>badge.target));
  expect(targets).toEqual([50,150,300,600,1000,1500]);
  for(const target of targets)await expect(collection.locator('.study-badge-grid')).toContainText(String(target));
  await expect(page.locator('[data-study-star-goal]')).toHaveCount(0);
  expect(await balance(page)).toBe(0);
});

test('wrong-answer penalties survive leaving and reload while an earned badge remains owned below its threshold',async({page})=>{
  await openStudy(page);await seedStars(page,5);
  expect(await balance(page)).toBe(50);
  await page.locator('[data-game-start="mix"]').click();
  const first=await answerIndexes(page);
  await page.locator('[data-game-answer]').nth(first.wrong[0]).click();
  await expect(page.locator('.game-feedback')).toContainText('Incorrect');
  await expect.poll(()=>balance(page)).toBe(48);
  await expect(page.locator('.game-streak')).toContainText('−2 stars');
  await expect(page.locator('.study-star-penalty')).toContainText('−2 Study Stars');
  await expect(page.locator('[data-game-answer]').nth(first.wrong[0])).toBeDisabled();
  await page.locator('[data-game-answer]').nth(first.wrong[0]).evaluate(button=>button.click());
  expect(await balance(page)).toBe(48);
  const owned=await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCollection());
  expect(owned.badges.filter(badge=>badge.unlocked)).toHaveLength(1);
  expect(owned.latest.id).toBe('starlight-study-badge');
  await page.locator('[data-game-home]').click();
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  expect(await balance(page)).toBe(48);
  await page.getByRole('button',{name:'Today',exact:true}).click();
  await expect(page.locator('.study-badge-latest')).toContainText('Star Scout');
  await page.reload();
  await expect(page.locator('.study-badge-latest')).toContainText('Star Scout');
  await page.locator('.study-badge-latest[data-open-badges]').click();
  const collection=page.locator('[data-badge-collection]');
  await expect(collection).toContainText('Star Scout');
  await expect(collection.locator('.study-badge-next')).toContainText('Bright Spark');
  await expect(collection.getByRole('progressbar',{name:'Next rank progress'})).toHaveAttribute('aria-valuenow','48');
  await expect(collection.getByRole('progressbar',{name:'Next rank progress'})).toHaveAttribute('aria-valuemax','150');
  const after=await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCollection());
  expect(after.badges[0].unlocked).toBe(true);
});

test('a real 100 percent round saves a substantial 25-star bonus alongside learning evidence',async({page})=>{
  await openStudy(page);
  await page.locator('[data-game-start="mix"]').click();
  for(let i=0;i<8;i++){
    const question=await answerIndexes(page);
    await page.locator('[data-game-answer]').nth(question.correct).click();
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-score-summary>strong')).toContainText('8 / 8 correct on the first try · 100%');
  await expect(page.locator('.study-perfect-bonus')).toContainText('+25');
  await expect(page.locator('.study-star-earned')).toContainText('+45 Study Stars');
  await expect(page.getByRole('heading',{name:'What you learned'})).toBeVisible();
  await expect.poll(()=>balance(page)).toBe(45);
  const perfect=await page.evaluate(async()=>{
    const ledger=await window.ABVMStudyGames.loadStudyStarLedger();
    return ledger.filter(row=>row.rewardType==='perfect-round');
  });
  expect(perfect).toHaveLength(1);expect(perfect[0].amount).toBe(25);
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  expect(await balance(page)).toBe(45);
});

test('a hint preserves the balance and a corrected retry never qualifies as a perfect round',async({page})=>{
  await openStudy(page);await seedStars(page,2);
  await page.locator('[data-game-start="mix"]').click();
  await page.locator('[data-game-hint]').click();
  await expect(page.locator('.game-hint')).toBeVisible();
  expect(await balance(page)).toBe(20);
  for(let i=0;i<8;i++){
    const question=await answerIndexes(page);
    if(i===0){await page.locator('[data-game-answer]').nth(question.wrong[0]).click();await expect.poll(()=>balance(page)).toBe(18)}
    await page.locator('[data-game-answer]').nth(question.correct).click();
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-score-summary>strong')).toContainText('7 / 8 correct on the first try · 88%');
  await expect(page.locator('.study-perfect-bonus')).toHaveCount(0);
  const perfect=await page.evaluate(async()=>(await window.ABVMStudyGames.loadStudyStarLedger()).filter(row=>row.rewardType==='perfect-round'));
  expect(perfect).toHaveLength(0);
});

test('unavailable rank storage stays honest while learning practice remains usable',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true}));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await expect(page.locator('.badge-storage-error')).toContainText('Your stars could not be loaded');
  await expect(page.locator('.badge-storage-error')).toContainText('Practice is still available');
  await page.locator('[data-game-start="mix"]').click();
  const question=await answerIndexes(page);
  await page.locator('[data-game-answer]').nth(question.correct).click();
  await expect(page.locator('.game-feedback strong')).toHaveText('Correct');
  await expect(page.locator('.game-live-score')).toContainText('1 / 1');
});

test('the highest earned rank stays current after a deduction crosses below its threshold',async({page})=>{
  await openStudy(page);
  await page.evaluate(async()=>{
    const engine=window.ABVMStudyGames;
    for(let i=0;i<34;i++)await engine.commitStudyStarRewards({sourcePack:'top-rank-ui',mode:'quick',sessionSeed:'perfect-'+i,completed:true,streakAdjustment:10,firstTryCorrect:8,questionCount:8});
    for(let i=0;i<16;i++)await engine.commitStudyStarPenalty({sourcePack:'top-rank-ui',mode:'quick',sessionSeed:'deduction',attemptId:'wrong-'+i});
  });
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await page.locator('[data-open-badges]').first().click();
  const collection=page.locator('[data-badge-collection]');
  await expect(collection.locator('.rank-current')).toContainText('ABVM Legend');
  await expect(collection.locator('.study-badge-card.is-earned')).toHaveCount(6);
  await expect(collection).toContainText('Top rank reached');
  await expect(collection.getByRole('progressbar',{name:'Next rank progress'})).toHaveCount(0);
  await expect(collection).not.toContainText('NaN');
  expect(await balance(page)).toBe(1498);
});
