import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
});

test('Study Stars uses one fixed currency with intentionally small bounded rewards', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    return {
      policy:engine.studyStarPolicy(),
      none:engine.studyStarRewardEvents({}),
      complete:engine.studyStarRewardEvents({completed:true}),
      comeback:engine.studyStarRewardEvents({comebackSucceeded:true}),
      both:engine.studyStarRewardEvents({completed:true,comebackSucceeded:true}),
    };
  });
  expect(result.policy.currency).toBe('Study Stars');
  expect(result.policy.roundComplete).toBe(10);
  expect(result.policy.comebackSuccess).toBe(2);
  expect(result.policy.streakStepCap).toBe(5);
  expect(result.policy.streakRoundMin).toBe(-10);
  expect(result.policy.streakRoundMax).toBe(10);
  expect(result.none).toEqual([]);
  expect(result.complete).toEqual([{rewardType:'round-complete',amount:10,currency:'Study Stars'}]);
  expect(result.comeback).toEqual([{rewardType:'comeback-success',amount:2,currency:'Study Stars'}]);
  expect(result.both.reduce((sum,row)=>sum+row.amount,0)).toBe(12);
  expect(new Set(result.both.map(row=>row.currency))).toEqual(new Set(['Study Stars']));
});

test('only explicit streakAdjustment changes Study Star awards and it is bounded', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const baseline=engine.studyStarRewardEvents({completed:true,comebackSucceeded:true});
    const noisy=engine.studyStarRewardEvents({
      completed:true,comebackSucceeded:true,score:999,accuracy:1,firstTry:true,perfect:true,mastery:1,streak:999,
      responseMs:1,teachCard:true,support:true,hints:0
    });
    const positive=engine.studyStarRewardEvents({completed:true,streakAdjustment:999});
    const negative=engine.studyStarRewardEvents({completed:true,streakAdjustment:-999});
    const text=engine.studyStarRewardEvents({completed:true,streakAdjustment:'10'});
    return {baseline,noisy,positive,negative,text,policy:engine.studyStarPolicy()};
  });
  expect(result.noisy).toEqual(result.baseline);
  expect(result.policy.excludedSignals).toEqual(expect.arrayContaining([
    'score','accuracy','first-try','perfect','mastery','speed','hints','teach-card','support'
  ]));
  expect(result.policy.excludedSignals).not.toContain('streak');
  expect(result.positive).toEqual([
    {rewardType:'round-complete',amount:10,currency:'Study Stars'},
    {rewardType:'streak-adjustment',amount:10,currency:'Study Stars'}
  ]);
  expect(result.negative).toEqual([
    {rewardType:'round-complete',amount:10,currency:'Study Stars'},
    {rewardType:'streak-adjustment',amount:-10,currency:'Study Stars'}
  ]);
  expect(result.text).toEqual([{rewardType:'round-complete',amount:10,currency:'Study Stars'}]);
  expect(result.negative.reduce((sum,row)=>sum+row.amount,0)).toBe(0);
});

test('progressive streak steps rise in magnitude and reset when direction changes', async ({ page }) => {
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;let state={positiveStreak:0,negativeStreak:0,adjustment:0};const rows=[];
    for(const correct of [true,true,true,true,false,false,true]){state=e.nextStreakBonus(state,correct);rows.push(state)}
    return rows;
  });
  expect(result.map(row=>row.delta)).toEqual([1,2,3,4,-1,-2,1]);
  expect(result.map(row=>row.adjustment)).toEqual([1,3,6,10,9,7,8]);
  expect(result[3]).toEqual(expect.objectContaining({positiveStreak:4,negativeStreak:0}));
  expect(result[5]).toEqual(expect.objectContaining({positiveStreak:0,negativeStreak:2}));
  expect(result[6]).toEqual(expect.objectContaining({positiveStreak:1,negativeStreak:0}));
});

test('reward inputs are explicit booleans so truthy strings cannot mint rewards', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    return {
      strings:engine.studyStarRewardEvents({completed:'true',comebackSucceeded:'yes'}),
      numbers:engine.studyStarRewardEvents({completed:1,comebackSucceeded:1}),
      booleans:engine.studyStarRewardEvents({completed:true,comebackSucceeded:true})
    };
  });
  expect(result.strings).toEqual([]);
  expect(result.numbers).toEqual([]);
  expect(result.booleans).toHaveLength(2);
});

test('reward policy is deterministic and contains no random or loot-box outcome', async ({ page }) => {
  const result=await page.evaluate(() => {
    const engine=window.ABVMStudyGames;
    return Array.from({length:25},()=>engine.studyStarRewardEvents({completed:true,comebackSucceeded:true}));
  });
  for(const row of result)expect(row).toEqual(result[0]);
  expect(result.flat().every(event=>['round-complete','comeback-success'].includes(event.rewardType))).toBe(true);
});
