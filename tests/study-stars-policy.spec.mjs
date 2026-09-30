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
  expect(result.none).toEqual([]);
  expect(result.complete).toEqual([{rewardType:'round-complete',amount:10,currency:'Study Stars'}]);
  expect(result.comeback).toEqual([{rewardType:'comeback-success',amount:2,currency:'Study Stars'}]);
  expect(result.both.reduce((sum,row)=>sum+row.amount,0)).toBe(12);
  expect(new Set(result.both.map(row=>row.currency))).toEqual(new Set(['Study Stars']));
});

test('scores, mastery, speed, streaks, perfect play, Teach Cards, and support never change Study Star awards', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const baseline=engine.studyStarRewardEvents({completed:true,comebackSucceeded:true});
    const noisy=engine.studyStarRewardEvents({
      completed:true,comebackSucceeded:true,
      score:999,accuracy:1,firstTry:true,perfect:true,mastery:1,streak:999,
      responseMs:1,teachCard:true,support:true,hints:0
    });
    return {baseline,noisy,policy:engine.studyStarPolicy()};
  });
  expect(result.noisy).toEqual(result.baseline);
  expect(result.policy.excludedSignals).toEqual(expect.arrayContaining([
    'score','accuracy','first-try','perfect','mastery','streak','speed','hints','teach-card','support'
  ]));
  expect(result.noisy.every(row=>row.amount>0)).toBe(true);
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
