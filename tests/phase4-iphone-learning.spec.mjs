import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
const sample={
  id:'original-phase4-synthetic-subtraction',subject:'Math',skill:'math-subtraction',
  prompt:'Solve 15 - 6.',choices:['8','9','10'],answer:'9',
  explanation:'Count back six.',hint:'Use subtraction.'
};
async function openStudy(page){
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:15000});
  await expect.poll(()=>page.evaluate(()=>!!window.ABVMStudyGameView&&!!window.ABVMStudyGames)).toBe(true);
}
test('iPhone scratch counter is an optional accessible, non-scoring Math activity',async({page},info)=>{
  await openStudy(page);
  await page.setViewportSize({width:393,height:852});
  const diagnostics=await page.evaluate(q=>{
    const view=window.ABVMStudyGameView;
    const g={questions:[q],index:0,selectedIndex:null,answered:false,wrong:[],
      counterValue:7,results:[],score:0,streak:0,negativeStreak:0,streakAdjustment:0};
    const html=view.play({g,q,mode:{id:'math',title:'Math'},labels:{},canRead:false});
    const board=document.createElement('div');board.id='phase4-board';board.className='games-screen is-playing';
    board.innerHTML=html;document.body.append(board);
    return {
      applicable:view.canUseScratchCounter(q),
      one:view.updateScratchCounter(0,1),
      zero:view.updateScratchCounter(0,-1),
      ceiling:view.updateScratchCounter(20,1),
      noChange:view.updateScratchCounter(6,6),
      scoreBefore:view.scoreSummary(g).answered,
      noAnswerScored:!g.answered&&g.score===0,
    };
  },sample);
  expect(diagnostics).toEqual({applicable:true,one:1,zero:0,ceiling:20,noChange:6,scoreBefore:0,noAnswerScored:true});
  const board=page.locator('#phase4-board .game-scratch-counter');
  await expect(board).toBeVisible();
  await expect(board.getByRole('status')).toHaveText('7 counters');
  await expect(board.locator('.game-scratch-dots span.filled')).toHaveCount(7);
  await expect(board.getByRole('button',{name:'Add one counter'})).toBeEnabled();
  await expect(board.getByRole('button',{name:'Remove one counter'})).toBeEnabled();
  await expect(board.getByRole('button',{name:'Clear counting board'})).toBeEnabled();
  const metrics=await board.locator('button').evaluateAll(nodes=>nodes.map(node=>({
    width:Math.round(node.getBoundingClientRect().width),
    height:Math.round(node.getBoundingClientRect().height),
    touchAction:getComputedStyle(node).touchAction
  })));
  expect(metrics.every(v=>v.height>=48&&v.width>=44&&v.touchAction==='manipulation')).toBe(true);
  const bounds=await board.evaluate(node=>({scroll:node.scrollWidth,client:node.clientWidth}));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.client+1);
  await info.attach('phase4-count-board-'+info.project.name+'.png',{
    body:await board.screenshot(),contentType:'image/png'
  });
});
test('scratch board cannot appear for unscoped, too-large or non-Math questions',async({page})=>{
  await openStudy(page);
  const verdict=await page.evaluate(q=>{
    const v=window.ABVMStudyGameView;
    const cases=[
      {...q,subject:'Religion'},
      {...q,skill:'math-place-value'},
      {...q,prompt:'Solve 115 - 6.'},
      {...q,prompt:'Which number is larger?'},
      {...q,prompt:'Solve -1 - 6.'}
    ];
    return cases.map(x=>v.canUseScratchCounter(x));
  },sample);
  // Explicit negative operands are not supported by the 0–20 counter.
  expect(verdict).toEqual([false,false,false,false,false]);
});
test('storage failures preserve tab-local history and retry writes full accumulated evidence',async({page})=>{
  await openStudy(page);
  const outcome=await page.evaluate(q=>{
    const engine=window.ABVMStudyGames,key='abvm-study-learning:v2';
    localStorage.removeItem(key);
    const old=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new Error('quota');return old.call(this,k,v)};
    try{
      engine.recordLearning(q,true,{attemptCount:1,incorrectCount:0,hintCount:0});
      engine.recordLearning(q,false,{attemptCount:2,incorrectCount:2,hintCount:0});
      const volatile={status:engine.learningStorageState(),row:engine.loadLearning()[q.skill]};
      const disk=localStorage.getItem(key);
      Storage.prototype.setItem=old;
      const saved=engine.retrySaveLearning();
      return {volatile:{status:volatile.status,seen:volatile.row.Seen,correct:volatile.row.Correct,wrong:volatile.row.Wrong},
        disk, saved,after:engine.learningStorageState(),persisted:JSON.parse(localStorage.getItem(key))[q.skill].Seen};
    }finally{Storage.prototype.setItem=old}
  },sample);
  expect(outcome).toEqual({volatile:{status:'not-saved',seen:2,correct:1,wrong:1},disk:null,saved:true,after:'saved',persisted:2});
  await page.reload();
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:15000});
  expect(await page.evaluate(()=>window.ABVMStudyGames.loadLearning()['math-subtraction']?.Seen)).toBe(2);
});
test('silent storage write rejection is detected instead of falsely promising history was saved',async({page})=>{
  await openStudy(page);
  const result=await page.evaluate(q=>{
    const engine=window.ABVMStudyGames,key='abvm-study-learning:v2';
    localStorage.removeItem(key);
    const old=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)return;return old.call(this,k,v)};
    try{
      engine.recordLearning(q,true);
      return {status:engine.learningStorageState(),seen:engine.loadLearning()[q.skill].Seen,persisted:localStorage.getItem(key)};
    }finally{Storage.prototype.setItem=old}
  },sample);
  expect(result).toEqual({status:'not-saved',seen:1,persisted:null});
  await page.locator('.bottom-nav [data-tab="today"]').click();
  await page.locator('.bottom-nav [data-tab="study"]').click();
  await expect(page.locator('.game-history-warning')).toBeVisible();
  await expect(page.locator('.game-history-warning')).toContainText('not saved on this device');
  await page.locator('[data-game-save-retry]').click();
  await expect(page.locator('.game-history-warning')).toHaveCount(0);
  expect(await page.evaluate(()=>window.ABVMStudyGames.learningStorageState())).toBe('saved');
});
test('on-device learning writes also succeed without network after Study loads',async({page,context})=>{
  await openStudy(page);
  await context.setOffline(true);
  try{
    const result=await page.evaluate(q=>{
      const engine=window.ABVMStudyGames;
      engine.recordLearning(q,true);
      return {status:engine.learningStorageState(),seen:engine.loadLearning()[q.skill].Seen};
    },sample);
    expect(result).toEqual({status:'saved',seen:1});
  }finally{await context.setOffline(false)}
  await page.reload();
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:15000});
  expect(await page.evaluate(()=>window.ABVMStudyGames.loadLearning()['math-subtraction']?.Seen)).toBe(1);
});
