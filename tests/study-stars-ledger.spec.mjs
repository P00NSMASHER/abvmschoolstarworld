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
    const e=window.ABVMStudyGames,sourcePack='pack-alpha',roundId=e.studyStarRoundId({sourcePack,mode:'quick',sessionSeed:'alpha'});
    const first=await e.commitStudyStarRewards({sourcePack,mode:'quick',sessionSeed:'alpha',roundId,completed:true,comebackSucceeded:true});
    const second=await e.commitStudyStarRewards({sourcePack,mode:'quick',sessionSeed:'alpha',roundId,completed:true,comebackSucceeded:true});
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
    const roundA=e.studyStarRoundId({sourcePack:'pack-a',mode:'quick',sessionSeed:'same'});
    const roundB=e.studyStarRoundId({sourcePack:'pack-b',mode:'quick',sessionSeed:'same'});
    await e.commitStudyStarRewards({sourcePack:'pack-a',mode:'quick',sessionSeed:'same',roundId:roundA,completed:true,comebackSucceeded:true});
    await e.commitStudyStarRewards({sourcePack:'pack-b',mode:'quick',sessionSeed:'same',roundId:roundB,completed:true,comebackSucceeded:false});
    const rows=await e.loadStudyStarLedger();
    return {rows,balance:await e.studyStarBalance(),roundA,roundB};
  });
  expect(result.balance).toBe(22);
  expect(result.rows.map(x=>[x.sourcePack,x.roundId,x.rewardType])).toEqual(expect.arrayContaining([
    ['pack-a',result.roundA,'round-complete'],
    ['pack-a',result.roundA,'comeback-success'],
    ['pack-b',result.roundB,'round-complete'],
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

test('ledger rejects arbitrary caller-supplied round IDs', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    try{
      await e.commitStudyStarRewards({sourcePack:'pack-raw',mode:'quick',sessionSeed:'raw',roundId:'round-fake-id',completed:true});
      return {rejected:false};
    }catch(error){return {rejected:true,message:String(error?.message||error)}}
  });
  expect(result.rejected).toBe(true);
  expect(result.message).toContain('must match sourcePack, mode, and sessionSeed');
});

test('interrupted or support-only activity cannot create reward rows', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    const roundId=e.studyStarRoundId({sourcePack:'pack-interrupt',mode:'quick',sessionSeed:'interrupt'});
    const committed=await e.commitStudyStarRewards({sourcePack:'pack-interrupt',mode:'quick',sessionSeed:'interrupt',roundId,completed:false,comebackSucceeded:true,support:true,teachCard:true});
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
    a.evaluate(()=>{const e=window.ABVMStudyGames,roundId=e.studyStarRoundId({sourcePack:'pack-race',mode:'quick',sessionSeed:'race'});return e.commitStudyStarRewards({sourcePack:'pack-race',mode:'quick',sessionSeed:'race',roundId,completed:true,comebackSucceeded:true})}),
    b.evaluate(()=>{const e=window.ABVMStudyGames,roundId=e.studyStarRoundId({sourcePack:'pack-race',mode:'quick',sessionSeed:'race'});return e.commitStudyStarRewards({sourcePack:'pack-race',mode:'quick',sessionSeed:'race',roundId,completed:true,comebackSucceeded:true})})
  ]);
  const final=await a.evaluate(async()=>({balance:await window.ABVMStudyGames.studyStarBalance(),rows:await window.ABVMStudyGames.loadStudyStarLedger()}));
  expect(ra.awardedAmount+rb.awardedAmount).toBe(12);
  expect(final.balance).toBe(12);
  expect(final.rows).toHaveLength(2);
  await context.close();
});

test('ledger remains available while the app is offline', async ({ page, context }) => {
  await page.evaluate(async()=>{const e=window.ABVMStudyGames,roundId=e.studyStarRoundId({sourcePack:'pack-offline',mode:'quick',sessionSeed:'offline'});return e.commitStudyStarRewards({sourcePack:'pack-offline',mode:'quick',sessionSeed:'offline',roundId,completed:true})});
  await context.setOffline(true);
  const balance=await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance());
  expect(balance).toBe(10);
  await context.setOffline(false);
});

test('reward persistence stays separate from learning evidence storage', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    localStorage.removeItem('abvm-study-learning:v2');
    const before=localStorage.getItem('abvm-study-learning:v2');
    const e=window.ABVMStudyGames,roundId=e.studyStarRoundId({sourcePack:'pack-separate',mode:'quick',sessionSeed:'separate'});
    await e.commitStudyStarRewards({sourcePack:'pack-separate',mode:'quick',sessionSeed:'separate',roundId,completed:true,comebackSucceeded:true});
    return {before,after:localStorage.getItem('abvm-study-learning:v2'),balance:await window.ABVMStudyGames.studyStarBalance()};
  });
  expect(result.before).toBeNull();
  expect(result.after).toBeNull();
  expect(result.balance).toBe(12);
});


test('reward ledger persists only bounded accounting fields and no exact activity timestamp', async ({ page }) => {
  const row=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    const roundId=e.studyStarRoundId({sourcePack:'pack-private',mode:'quick',sessionSeed:'private'});
    await e.commitStudyStarRewards({sourcePack:'pack-private',mode:'quick',sessionSeed:'private',roundId,completed:true,comebackSucceeded:false,prompt:'PRIVATE PROMPT',answer:'PRIVATE ANSWER'});
    return (await e.loadStudyStarLedger())[0];
  });
  expect(Object.keys(row).sort()).toEqual(['amount','currency','eventId','rewardType','roundId','sourcePack'].sort());
  expect(row).not.toHaveProperty('createdAt');
  expect(JSON.stringify(row)).not.toContain('PRIVATE PROMPT');
  expect(JSON.stringify(row)).not.toContain('PRIVATE ANSWER');
  expect(row.eventId).toMatch(/^star-[a-z0-9]+-[a-z0-9]+$/);
});

test('signed streak adjustments are idempotent and a completed round never subtracts existing balance', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    const good=e.studyStarRoundId({sourcePack:'pack-streak-good',mode:'quick',sessionSeed:'good'});
    const bad=e.studyStarRoundId({sourcePack:'pack-streak-bad',mode:'quick',sessionSeed:'bad'});
    const first=await e.commitStudyStarRewards({sourcePack:'pack-streak-good',mode:'quick',sessionSeed:'good',roundId:good,completed:true,streakAdjustment:10});
    const before=await e.studyStarBalance();
    const second=await e.commitStudyStarRewards({sourcePack:'pack-streak-bad',mode:'quick',sessionSeed:'bad',roundId:bad,completed:true,streakAdjustment:-10});
    const duplicate=await e.commitStudyStarRewards({sourcePack:'pack-streak-bad',mode:'quick',sessionSeed:'bad',roundId:bad,completed:true,streakAdjustment:-10});
    return {first,before,second,duplicate,after:await e.studyStarBalance(),rows:await e.loadStudyStarLedger()};
  });
  expect(result.first.awardedAmount).toBe(20);
  expect(result.before).toBe(20);
  expect(result.second.awardedAmount).toBe(0);
  expect(result.after).toBe(20);
  expect(result.duplicate.awardedAmount).toBe(0);
  expect(result.duplicate.duplicateAmount).toBe(0);
  expect(result.rows.filter(row=>row.sourcePack==='pack-streak-bad').map(row=>[row.rewardType,row.amount])).toEqual(expect.arrayContaining([
    ['round-complete',10],['streak-adjustment',-10]
  ]));
});
