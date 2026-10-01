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
  await clearLedger(page);
});

test('reward ledger is idempotent for retries and double commits', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,sourcePack='pack-alpha',roundId='round-alpha';
    const first=await e.commitStudyStarRewards({sourcePack,roundId,completed:true,comebackSucceeded:true});
    const second=await e.commitStudyStarRewards({sourcePack,roundId,completed:true,comebackSucceeded:true});
    return {first,second,balance:await e.studyStarBalance(),ledger:await e.loadStudyStarLedger()};
  });
  expect(result.first.awardedAmount).toBe(12);
  expect(result.second.awardedAmount).toBe(0);
  expect(result.second.duplicateAmount).toBe(12);
  expect(result.balance).toBe(12);
  expect(result.ledger).toHaveLength(2);
});

test('composite sourcePack + roundId + rewardType key isolates pack updates and reward types', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    await e.commitStudyStarRewards({sourcePack:'pack-a',roundId:'same-round',completed:true,comebackSucceeded:true});
    await e.commitStudyStarRewards({sourcePack:'pack-b',roundId:'same-round',completed:true,comebackSucceeded:false});
    const rows=await e.loadStudyStarLedger();
    return {rows,balance:await e.studyStarBalance()};
  });
  expect(result.balance).toBe(22);
  expect(result.rows.map(x=>[x.sourcePack,x.roundId,x.rewardType])).toEqual(expect.arrayContaining([
    ['pack-a','same-round','round-complete'],
    ['pack-a','same-round','comeback-success'],
    ['pack-b','same-round','round-complete'],
  ]));
});

test('round identity is deterministic and includes source pack, mode, and session seed', async ({ page }) => {
  const ids=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    return [
      e.studyStarRoundId({sourcePack:'pack-a',mode:'quick',sessionSeed:'1'}),
      e.studyStarRoundId({sourcePack:'pack-a',mode:'quick',sessionSeed:'1'}),
      e.studyStarRoundId({sourcePack:'pack-b',mode:'quick',sessionSeed:'1'}),
      e.studyStarRoundId({sourcePack:'pack-a',mode:'math',sessionSeed:'1'}),
      e.studyStarRoundId({sourcePack:'pack-a',mode:'quick',sessionSeed:'2'}),
    ];
  });
  expect(ids[0]).toBe(ids[1]);
  expect(new Set([ids[0],ids[2],ids[3],ids[4]]).size).toBe(4);
  expect(ids[0]).toMatch(/^round-[a-z0-9]+-[a-z0-9]+$/);
  expect(ids[0]).not.toContain('pack-a');
  expect(ids[0]).not.toContain('quick');
});

test('interrupted or support-only activity cannot create reward rows', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    const committed=await e.commitStudyStarRewards({sourcePack:'pack-interrupt',roundId:'r1',completed:false,comebackSucceeded:true,support:true,teachCard:true});
    return {committed,balance:await e.studyStarBalance(),rows:await e.loadStudyStarLedger()};
  });
  expect(result.committed.awardedAmount).toBe(0);
  expect(result.balance).toBe(0);
  expect(result.rows).toEqual([]);
});

test('two tabs racing the same round can only award each reward type once', async ({ browser }) => {
  const context=await browser.newContext();
  const a=await context.newPage(),b=await context.newPage();
  await Promise.all([a.goto('http://127.0.0.1:4173/#games'),b.goto('http://127.0.0.1:4173/#games')]);
  await Promise.all([
    expect(a.locator('.study-game-grid')).toBeVisible({timeout:10_000}),
    expect(b.locator('.study-game-grid')).toBeVisible({timeout:10_000})
  ]);
  await clearLedger(a);
  const [ra,rb]=await Promise.all([
    a.evaluate(()=>window.ABVMStudyGames.commitStudyStarRewards({sourcePack:'pack-race',roundId:'round-race',completed:true,comebackSucceeded:true})),
    b.evaluate(()=>window.ABVMStudyGames.commitStudyStarRewards({sourcePack:'pack-race',roundId:'round-race',completed:true,comebackSucceeded:true}))
  ]);
  const final=await a.evaluate(async()=>({balance:await window.ABVMStudyGames.studyStarBalance(),rows:await window.ABVMStudyGames.loadStudyStarLedger()}));
  expect(ra.awardedAmount+rb.awardedAmount).toBe(12);
  expect(final.balance).toBe(12);
  expect(final.rows).toHaveLength(2);
  await context.close();
});

test('ledger remains available while the app is offline', async ({ page, context }) => {
  await page.evaluate(async()=>window.ABVMStudyGames.commitStudyStarRewards({sourcePack:'pack-offline',roundId:'r1',completed:true}));
  await context.setOffline(true);
  const balance=await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance());
  expect(balance).toBe(10);
  await context.setOffline(false);
});

test('reward persistence stays separate from learning evidence storage', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    localStorage.removeItem('abvm-study-learning:v2');
    const before=localStorage.getItem('abvm-study-learning:v2');
    await window.ABVMStudyGames.commitStudyStarRewards({sourcePack:'pack-separate',roundId:'r1',completed:true,comebackSucceeded:true});
    return {before,after:localStorage.getItem('abvm-study-learning:v2'),balance:await window.ABVMStudyGames.studyStarBalance()};
  });
  expect(result.before).toBeNull();
  expect(result.after).toBeNull();
  expect(result.balance).toBe(12);
});


test('reward ledger persists only bounded accounting fields and no exact activity timestamp', async ({ page }) => {
  const row=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    await e.commitStudyStarRewards({sourcePack:'pack-private',roundId:'r-private',completed:true,comebackSucceeded:false,prompt:'PRIVATE PROMPT',answer:'PRIVATE ANSWER'});
    return (await e.loadStudyStarLedger())[0];
  });
  expect(Object.keys(row).sort()).toEqual(['amount','currency','eventId','rewardType','roundId','sourcePack'].sort());
  expect(row).not.toHaveProperty('createdAt');
  expect(JSON.stringify(row)).not.toContain('PRIVATE PROMPT');
  expect(JSON.stringify(row)).not.toContain('PRIVATE ANSWER');
  expect(row.eventId).toMatch(/^star-[a-z0-9]+-[a-z0-9]+$/);
});
