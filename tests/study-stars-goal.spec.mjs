import { test, expect } from '@playwright/test';

async function clearLedger(page){
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase('abvm-study-stars-v1');
    request.onsuccess=()=>resolve();
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Study Star DB delete blocked'));
  }));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await page.evaluate(()=>localStorage.removeItem('abvm-study-stars-goal:v1'));
  await clearLedger(page);
});

test('Dream Goal is exactly one cosmetic target at 50 Study Stars', async ({ page }) => {
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    return {goal:e.studyStarDreamGoal(),before:e.loadStudyStarGoal(),after:e.selectStudyStarGoal()};
  });
  expect(result.goal).toEqual(expect.objectContaining({id:'starlight-study-badge',title:'Starlight Study Badge',target:50,cosmetic:true}));
  expect(result.before.selected).toBe(false);
  expect(result.after.selected).toBe(true);
});

test('Dream Goal progress is bounded and caps progress at the target', async ({ page }) => {
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    e.selectStudyStarGoal();
    return [-5,0,12,49,50,90].map(balance=>e.studyStarGoalProgress(balance));
  });
  expect(result[0]).toEqual(expect.objectContaining({balance:0,progress:0,remaining:50,percent:0,unlocked:false}));
  expect(result[2]).toEqual(expect.objectContaining({balance:12,progress:12,remaining:38,percent:24,unlocked:false}));
  expect(result[3]).toEqual(expect.objectContaining({balance:49,progress:49,remaining:1,percent:98,unlocked:false}));
  expect(result[4]).toEqual(expect.objectContaining({balance:50,progress:50,remaining:0,percent:100,unlocked:true}));
  expect(result[5]).toEqual(expect.objectContaining({balance:90,progress:50,remaining:0,percent:100,unlocked:true}));
});

test('Dream Goal selection and progress never spend or mutate the Study Star ledger', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,sourcePack='goal-ledger-pack',mode='quick',sessionSeed='goal-ledger';
    const roundId=e.studyStarRoundId({sourcePack,mode,sessionSeed});
    await e.commitStudyStarRewards({sourcePack,mode,sessionSeed,roundId,completed:true,comebackSucceeded:true});
    const before=await e.studyStarBalance();
    e.selectStudyStarGoal();
    const progress=e.studyStarGoalProgress(before);
    const after=await e.studyStarBalance();
    return {before,after,progress};
  });
  expect(result.before).toBe(12);
  expect(result.after).toBe(12);
  expect(result.progress).toEqual(expect.objectContaining({balance:12,progress:12,remaining:38,percent:24}));
});

test('Dream Goal renderer reuses existing accessible game UI and exposes no store or catalog', async ({ page }) => {
  const html=await page.evaluate(()=>{
    const e=window.ABVMStudyGames,v=window.ABVMStudyGameView;
    e.selectStudyStarGoal();
    return v.goal({state:e.studyStarGoalProgress(12)});
  });
  expect(html).toContain('class="game-question-card study-star-goal"');
  expect(html).toContain('role="progressbar"');
  expect(html).toContain('aria-valuenow="12"');
  expect(html).toContain('12 / 50 Stars');
  expect(html).not.toMatch(/store|shop|catalog|purchase/i);
});

test('Dream Goal renderer falls back to balance when progress is omitted', async ({ page }) => {
  const html=await page.evaluate(()=>{
    const e=window.ABVMStudyGames,v=window.ABVMStudyGameView,state=e.studyStarGoalProgress(12);
    delete state.progress;
    return v.goal({state});
  });
  expect(html).toContain('12 / 50 Stars');
  expect(html).toContain('aria-valuenow="12"');
  expect(html).not.toContain('NaN');
});

test('unknown Dream Goals are rejected rather than creating a hidden catalog', async ({ page }) => {
  const result=await page.evaluate(()=>{
    try{window.ABVMStudyGames.selectStudyStarGoal('second-goal');return 'accepted'}catch(error){return String(error.message)}
  });
  expect(result).toContain('Unknown Study Star Dream Goal');
});

test('unlocked Dream Goal caps both visible and accessible progress at 50 of 50', async ({ page }) => {
  const html=await page.evaluate(()=>{
    const e=window.ABVMStudyGames,v=window.ABVMStudyGameView;
    e.selectStudyStarGoal();
    return v.goal({state:e.studyStarGoalProgress(90)});
  });
  expect(html).toContain('50 / 50 Stars');
  expect(html).toContain('aria-valuemax="50"');
  expect(html).toContain('aria-valuenow="50"');
  expect(html).not.toContain('90 / 50 Stars');
});
