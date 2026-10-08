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

test('rank collection shows all 21 promotions in the same permanent ladder and an accessible next-rank path without choosing a goal',async({page})=>{
  await openStudy(page);
  await expect(page.locator('.study-badge-tracker')).toBeVisible();
  await page.locator('[data-open-badges]').first().click();
  const collection=page.locator('[data-badge-collection]');
  await expect(collection).toBeVisible();
  await expect(collection.locator('.study-badge-grid').getByRole('listitem')).toHaveCount(21);
  await expect(collection.locator('.rank-current')).toContainText('Eaglet');
  await expect(collection.locator('.study-badge-next')).toContainText('Nest Explorer');
  const progress=collection.getByRole('progressbar',{name:'Next rank progress'});
  await expect(progress).toHaveAttribute('aria-valuenow','0');
  await expect(progress).toHaveAttribute('aria-valuemax','25');
  const targets=await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCatalog().map(badge=>badge.target));
  expect(targets).toEqual([25,50,75,100,150,200,250,300,375,450,525,600,700,800,900,1000,1100,1200,1300,1400,1500]);
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
  expect(owned.badges.filter(badge=>badge.unlocked)).toHaveLength(2);
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
  await expect(collection.locator('.study-badge-next')).toContainText('Little Luminary');
  await expect(collection.getByRole('progressbar',{name:'Next rank progress'})).toHaveAttribute('aria-valuenow','0');
  await expect(collection.getByRole('progressbar',{name:'Next rank progress'})).toHaveAttribute('aria-valuemax','25');
  const after=await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCollection());
  expect(after.badges[0].unlocked).toBe(true);
  expect(after.badges.find(badge=>badge.id==='starlight-study-badge')?.unlocked).toBe(true);
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
  await expect(page.locator('.game-finish')).toContainText('Nest Explorer');
  await expect(page.locator('.game-finish .study-badge-next')).toContainText('Star Scout');
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
  await expect(collection.locator('.study-badge-card.is-earned')).toHaveCount(21);
  await expect(collection).toContainText('Top rank reached');
  await expect(collection.getByRole('progressbar',{name:'Next rank progress'})).toHaveCount(0);
  await expect(collection).not.toContainText('NaN');
  expect(await balance(page)).toBe(1498);
});

test('a saved penalty restores the real player balance after a transient initial rank-read failure',async({page})=>{
  await openStudy(page);await seedStars(page,5);
  await expect(page.locator('.study-badge-tracker')).toContainText('50 Study Stars');
  await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    window.rankRecoveryEngine=engine;
    window.ABVMStudyGames={...engine,studyBadgeCollection:()=>Promise.reject(new Error('Fixture: transient initial rank read failure'))};
  });
  await page.locator('[data-game-start="mix"]').click();
  await expect(page.locator('.game-star-balance')).toContainText('Study Stars unavailable');
  await page.evaluate(()=>{window.ABVMStudyGames=window.rankRecoveryEngine;delete window.rankRecoveryEngine});
  const question=await answerIndexes(page);
  await page.locator('[data-game-answer]').nth(question.wrong[0]).click();
  await expect(page.locator('.study-star-penalty')).toContainText('−2 Study Stars');
  await expect.poll(()=>balance(page)).toBe(48);
  await expect(page.locator('.game-star-balance')).toContainText('48 Study Stars');
  await expect(page.locator('.game-star-balance')).not.toContainText('unavailable');
  await page.locator('[data-game-answer]').nth(question.correct).click();
  await expect(page.locator('.game-feedback strong')).toHaveText('Correct on retry');
  await expect(page.locator('.game-live-score')).toContainText('0 / 1');
  await expect(page.locator('.game-star-balance')).toContainText('48 Study Stars');
  expect(await balance(page)).toBe(48);
});

test('every original and new premium rank emblem loads, with no horizontal overflow on an iPhone',async({page})=>{
  await page.setViewportSize({width:393,height:852});await openStudy(page);
  await page.locator('[data-open-badges]').first().click();
  const collection=page.locator('[data-badge-collection]'),images=collection.locator('.study-badge-grid img');
  await expect(images).toHaveCount(21);
  await expect.poll(()=>images.evaluateAll(items=>items.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
  const paths=await images.evaluateAll(items=>items.map(image=>new URL(image.src).pathname));
  expect(new Set(paths).size).toBe(21);
  expect(paths.filter(path=>path.endsWith('.svg'))).toHaveLength(15);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(collection.locator('.rank-current')).toContainText('Eaglet');
  await expect(collection.locator('.badge-progress')).toHaveCount(1);
});
