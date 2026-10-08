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

test('completion does not apply negative streak adjustment a second time', async ({ page }) => {
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
  expect(result.second.awardedAmount).toBe(10);
  expect(result.after).toBe(30);
  expect(result.duplicate.awardedAmount).toBe(0);
  expect(result.duplicate.duplicateAmount).toBe(10);
  expect(result.rows.filter(row=>row.sourcePack==='pack-streak-bad').map(row=>[row.rewardType,row.amount])).toEqual(expect.arrayContaining([
    ['round-complete',10]
  ]));
});

test('every distinct wrong attempt immediately debits at most two stars and never goes below zero',async({page})=>{
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,identity={sourcePack:'penalty-floor',mode:'math',sessionSeed:'same-round'};
    await e.commitStudyStarRewards({...identity,completed:true});
    const rows=[];
    for(let i=0;i<6;i++)rows.push(await e.commitStudyStarPenalty({...identity,attemptId:'normal|question-'+i+'|attempt-1'}));
    const replay=await e.commitStudyStarPenalty({...identity,attemptId:'normal|question-0|attempt-1'});
    await e.commitStudyStarRewards({sourcePack:'later-credit',mode:'math',sessionSeed:'credit',completed:true});
    const zeroReplay=await e.commitStudyStarPenalty({...identity,attemptId:'normal|question-5|attempt-1'});
    return {rows,replay,zeroReplay,balance:await e.studyStarBalance(),ledger:await e.loadStudyStarLedger()};
  });
  expect(result.rows.map(row=>row.deductedAmount)).toEqual([2,2,2,2,2,0]);
  expect(result.rows.map(row=>row.balance)).toEqual([8,6,4,2,0,0]);
  expect(result.replay.deductedAmount).toBe(0);expect(result.replay.duplicateAmount).toBe(2);
  expect(result.zeroReplay.deductedAmount).toBe(0);expect(result.zeroReplay.balance).toBe(10);
  expect(result.balance).toBe(10);
  expect(result.ledger.filter(row=>row.rewardType.startsWith('wrong-answer:'))).toHaveLength(6);
});

test('low balances deduct the actual available amount and keep kinds and attempts distinct',async({page})=>{
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,identity={sourcePack:'kind-penalty',mode:'mix',sessionSeed:'round'};
    await e.commitStudyStarRewards({...identity,completed:true,streakAdjustment:1});
    const rows=[];
    for(const attemptId of ['normal|q1|1','normal|q1|2','support|q1|1','comeback|q1|1','normal|q2|1','normal|q3|1'])rows.push(await e.commitStudyStarPenalty({...identity,attemptId}));
    return {rows,balance:await e.studyStarBalance(),ledger:await e.loadStudyStarLedger()};
  });
  expect(result.rows.map(row=>row.deductedAmount)).toEqual([2,2,2,2,2,1]);
  expect(result.balance).toBe(0);
  expect(result.ledger.filter(row=>row.rewardType.startsWith('wrong-answer:'))).toHaveLength(6);
  expect(result.ledger.every(row=>!JSON.stringify(row).includes('q1'))).toBe(true);
});

test('penalty and perfect completion survive reload without duplicate debits or bonus',async({page})=>{
  const first=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,identity={sourcePack:'reload-penalty',mode:'reading',sessionSeed:'round'};
    const credit=await e.commitStudyStarRewards({...identity,completed:true,streakAdjustment:10,firstTryCorrect:8,questionCount:8});
    const debit=await e.commitStudyStarPenalty({...identity,attemptId:'normal|question-1|attempt-1'});
    return {credit,debit};
  });
  expect(first.credit.awardedAmount).toBe(45);expect(first.credit.perfectBonus).toBe(25);expect(first.debit.balance).toBe(43);
  await page.reload();await expect(page.locator('.study-game-grid')).toBeVisible();
  const replay=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,identity={sourcePack:'reload-penalty',mode:'reading',sessionSeed:'round'};
    const credit=await e.commitStudyStarRewards({...identity,completed:true,streakAdjustment:10,firstTryCorrect:8,questionCount:8});
    const debit=await e.commitStudyStarPenalty({...identity,attemptId:'normal|question-1|attempt-1'});
    return {credit,debit,ledger:await e.loadStudyStarLedger()};
  });
  expect(replay.credit.awardedAmount).toBe(0);expect(replay.credit.perfectBonus).toBe(0);expect(replay.credit.duplicateAmount).toBe(45);
  expect(replay.debit.deductedAmount).toBe(0);expect(replay.debit.balance).toBe(43);expect(replay.ledger).toHaveLength(4);
});

test('concurrent tabs serialize duplicate penalties with reward and badge transactions',async({browser})=>{
  const context=await browser.newContext({serviceWorkers:'block'}),a=await context.newPage(),b=await context.newPage();
  await Promise.all([a.goto('http://127.0.0.1:4173/#games'),b.goto('http://127.0.0.1:4173/#games')]);
  await Promise.all([expect(a.locator('.study-game-grid')).toBeVisible(),expect(b.locator('.study-game-grid')).toBeVisible()]);
  await clearLedger(a);
  await a.evaluate(()=>window.ABVMStudyGames.commitStudyStarRewards({sourcePack:'race-seed',mode:'mix',sessionSeed:'seed',completed:true}));
  const identity={sourcePack:'penalty-race',mode:'mix',sessionSeed:'same',attemptId:'normal|q1|1'};
  const results=await Promise.all([
    a.evaluate(identity=>window.ABVMStudyGames.commitStudyStarPenalty(identity),identity),
    b.evaluate(identity=>window.ABVMStudyGames.commitStudyStarPenalty(identity),identity),
    b.evaluate(()=>window.ABVMStudyGames.commitStudyStarRewards({sourcePack:'race-credit',mode:'mix',sessionSeed:'credit',completed:true,streakAdjustment:10,firstTryCorrect:8,questionCount:8})),
    a.evaluate(()=>window.ABVMStudyGames.studyBadgeCollection())
  ]);
  expect(results[0].deductedAmount+results[1].deductedAmount).toBe(2);
  const final=await a.evaluate(async()=>({collection:await window.ABVMStudyGames.studyBadgeCollection(),ledger:await window.ABVMStudyGames.loadStudyStarLedger()}));
  expect(final.collection.balance).toBe(53);expect(final.collection.badges[0].unlocked).toBe(true);
  expect(final.ledger.filter(row=>row.rewardType.startsWith('wrong-answer:'))).toHaveLength(1);
  await context.close();
});

test('badges remain unlocked after spending stars and all six milestones are durable',async({page})=>{
  const earned=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    for(let i=0;i<34;i++)await e.commitStudyStarRewards({sourcePack:'all-badges',mode:'mix',sessionSeed:String(i),completed:true,streakAdjustment:10,firstTryCorrect:8,questionCount:8});
    return e.studyBadgeCollection();
  });
  expect(earned.balance).toBe(1530);expect(earned.badges.every(row=>row.unlocked&&!row.migrated&&row.earnedAt)).toBe(true);
  expect(earned.current.id).toBe('constellation-champion');expect(earned.latest.id).toBe('constellation-champion');expect(earned.next).toBeNull();expect(earned.remaining).toBe(0);expect(earned.percent).toBe(100);
  const after=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    for(let i=0;i<20;i++)await e.commitStudyStarPenalty({sourcePack:'all-badges',mode:'mix',sessionSeed:'0',attemptId:'support|q'+i+'|1'});
    return e.studyBadgeCollection();
  });
  expect(after.balance).toBe(1490);expect(after.badges).toEqual(earned.badges);expect(after.latest).toEqual(earned.latest);
  await page.reload();await expect(page.locator('.study-game-grid')).toBeVisible();
  expect(await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCollection())).toEqual(after);
});

test('version-one ledger preserves historical badge achievements without inventing earning dates',async({page})=>{
  // Seed the old database before the current app can auto-read rank state.
  await page.goto('/manifest.webmanifest');await clearLedger(page);
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('abvm-study-stars-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('reward-ledger',{keyPath:['sourcePack','roundId','rewardType']});
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('reward-ledger','readwrite'),store=tx.objectStore('reward-ledger');
      for(const [rewardType,amount] of [['round-complete',160],['streak-adjustment',-20]])store.add({sourcePack:'legacy-pack',roundId:'legacy-round',rewardType,amount,currency:'Study Stars',eventId:'legacy-'+rewardType});
      tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};
    };
  }));
  await page.goto('/#games');await expect(page.locator('.study-game-grid')).toBeVisible();
  const before=await page.evaluate(async()=>({collection:await window.ABVMStudyGames.studyBadgeCollection(),ledger:await window.ABVMStudyGames.loadStudyStarLedger()}));
  expect(before.collection.balance).toBe(140);expect(before.ledger.map(row=>row.amount).sort((a,b)=>a-b)).toEqual([-20,160]);
  const unlocked=before.collection.badges.filter(row=>row.unlocked);
  expect(unlocked.map(row=>row.target)).toEqual([50]);expect(unlocked.every(row=>row.earnedAt===null&&row.migrated)).toBe(true);
  expect(before.collection.latest.id).toBe('starlight-study-badge');expect(before.collection.next.target).toBe(150);
  const after=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames;
    for(let i=0;i<4;i++)await e.commitStudyStarRewards({sourcePack:'post-migration',mode:'mix',sessionSeed:String(i),completed:true,streakAdjustment:10,firstTryCorrect:8,questionCount:8});
    return e.studyBadgeCollection();
  });
  expect(after.balance).toBe(320);expect(after.latest.id).toBe('rising-scholar');expect(after.latest.migrated).toBe(false);
  expect(Date.parse(after.latest.earnedAt)).toBeGreaterThan(0);expect(after.latest.earnedOrder).toBeGreaterThan(unlocked.at(-1).earnedOrder);
  expect(after.badges.slice(0,1)).toEqual(before.collection.badges.slice(0,1));
});

test('penalty rejects missing attempt identity or a forged round identity before writing',async({page})=>{
  const messages=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,identity={sourcePack:'bad-penalty',mode:'mix',sessionSeed:'round'},errors=[];
    for(const args of [{...identity},{...identity,attemptId:'q1|1',roundId:'fake-round'}]){
      try{await e.commitStudyStarPenalty(args)}catch(error){errors.push(error.message)}
    }
    return {errors,ledger:await e.loadStudyStarLedger()};
  });
  expect(messages.errors[0]).toContain('stable question/attempt identity');expect(messages.errors[1]).toContain('must match sourcePack, mode, and sessionSeed');expect(messages.ledger).toEqual([]);
});


test('new collection starts as Eaglet and a rank never falls after penalties',async({page})=>{
  const result=await page.evaluate(async()=>{
    const e=window.ABVMStudyGames,start=await e.studyBadgeCollection();
    for(let i=0;i<5;i++)await e.commitStudyStarRewards({sourcePack:'rank-floor',mode:'math',sessionSeed:String(i),completed:true});
    const promoted=await e.studyBadgeCollection();
    await e.commitStudyStarPenalty({sourcePack:'rank-floor',mode:'math',sessionSeed:'4',attemptId:'normal|q1|1'});
    return {start,promoted,after:await e.studyBadgeCollection()};
  });
  expect(result.start.current).toEqual(expect.objectContaining({id:'eaglet',title:'Eaglet',starter:true,target:0,artIndex:-1,earnedAt:null}));
  expect(result.start.latest).toBeNull();expect(result.start.next.target).toBe(50);
  expect(result.promoted.current.title).toBe('Star Scout');expect(result.after.balance).toBe(48);expect(result.after.current).toEqual(result.promoted.current);
});


test('canceled version-one completion rewards cannot fabricate rank achievements',async({page})=>{
  // Seed the old database before the current app can auto-read rank state.
  await page.goto('/manifest.webmanifest');await clearLedger(page);
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('abvm-study-stars-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('reward-ledger',{keyPath:['sourcePack','roundId','rewardType']});
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('reward-ledger','readwrite'),store=tx.objectStore('reward-ledger');
      for(let i=0;i<100;i++)for(const [rewardType,amount] of [['round-complete',10],['streak-adjustment',-10]])store.add({sourcePack:'legacy-canceled',roundId:'round-'+i,rewardType,amount,currency:'Study Stars',eventId:'legacy-'+i+'-'+rewardType});
      tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};
    };
  }));
  await page.goto('/#games');await expect(page.locator('.study-game-grid')).toBeVisible();
  const result=await page.evaluate(async()=>({collection:await window.ABVMStudyGames.studyBadgeCollection(),rows:await window.ABVMStudyGames.loadStudyStarLedger()}));
  expect(result.rows).toHaveLength(200);
  expect(result.collection.balance).toBe(0);expect(result.collection.current.id).toBe('eaglet');
  expect(result.collection.latest).toBeNull();expect(result.collection.next.target).toBe(50);
  expect(result.collection.badges.every(row=>!row.unlocked&&row.earnedAt===null)).toBe(true);
  await page.reload();await expect(page.locator('.study-game-grid')).toBeVisible();
  expect(await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCollection())).toEqual(result.collection);
});
