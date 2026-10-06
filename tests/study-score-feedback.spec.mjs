import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

async function open(page){
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
  await page.goto('/#games');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
}
async function visibleQuestion(page){
  const prompt=await page.locator('.game-question-card>h2').innerText();
  const choices=await page.locator('[data-game-answer] strong').allTextContents();
  return page.evaluate(async({prompt,choices})=>{
    const envelope=await fetch('./data/study-pack-runtime.json').then(r=>r.json());
    const engine=window.ABVMStudyGames,{buildStarBank}=await import('./star-practice.mjs');
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)});
    const q=[...catalog.questions,...buildStarBank()].find(row=>row.prompt===prompt&&row.choices.length===choices.length&&row.choices.every(c=>choices.includes(c)));
    return q?{answer:q.answer,subject:q.subject,prompt:q.prompt,choices}:null;
  },{prompt,choices});
}

test('six first-try correct and two corrected retries stays 6 of 8 at 75 percent',async({page},info)=>{
  await page.setViewportSize({width:393,height:852});await open(page);
  await page.locator('[data-study-source]').selectOption('star');
  await page.locator('[data-game-start="math"]').click();
  for(let i=0;i<8;i++){
    const q=await visibleQuestion(page);expect(q).not.toBeNull();
    const correct=q.choices.indexOf(q.answer);expect(correct).toBeGreaterThanOrEqual(0);
    if(i<2){
      const wrong=q.choices.findIndex(choice=>choice!==q.answer);expect(q.choices.length).toBeGreaterThanOrEqual(3);
      const wrongButton=page.locator('[data-game-answer]').nth(wrong);await wrongButton.click();
      await expect(page.locator('.game-feedback')).toContainText('Incorrect. Try again.');
      await expect(wrongButton).toBeDisabled();
      const before=await page.locator('.game-live-score').innerText();
      await wrongButton.evaluate(button=>button.click());
      await expect(page.locator('.game-live-score')).toHaveText(before);
      await page.locator('[data-game-answer]').nth(correct).click();
      await expect(page.locator('.game-feedback')).toContainText('Correct on retry');
      await expect(page.locator('.game-feedback')).toContainText('Your first-try score stays the same');
    }else{
      if(i===2){await page.locator('[data-game-hint]').click();await expect(page.locator('.game-hint')).toBeVisible()}
      await page.locator('[data-game-answer]').nth(correct).click();
      await expect(page.locator('.game-feedback strong')).toHaveText('Correct');
    }
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  const reveal=page.locator('.study-star-reveal');
  if(await reveal.count()){
    const overlap=await page.evaluate(()=>{const reward=document.querySelector('.study-star-reveal')?.getBoundingClientRect(),score=document.querySelector('.game-score-summary')?.getBoundingClientRect();return !!reward&&!!score&&!(reward.bottom<=score.top||reward.top>=score.bottom||reward.right<=score.left||reward.left>=score.right)});
    expect(overlap,'Study Star confirmation must not cover the score').toBe(false);
  }
  await expect(page.locator('.game-score-summary>strong')).toHaveText('6 / 8 correct on the first try · 75%');
  await expect(page.locator('.game-score-summary>span')).toContainText('First try: 6 right');
  await expect(page.locator('.game-score-summary>span')).toContainText('2 missed');
  await expect(page.locator('.game-score-summary>span')).toContainText('2 fixed');
  await expect(page.locator('.game-score-summary>span')).toContainText('1 hint');
  const math=page.locator('.game-section-scores>div').filter({hasText:'Math'});
  await expect(math).toContainText('6 / 8 · 75%');
  await expect(page.locator('.legacy-record')).toContainText('best solved with retries');
  let path=info.outputPath('score-result-393x852.png');await page.screenshot({path,fullPage:true});await info.attach('Phone score result',{path,contentType:'image/png'});
  await page.setViewportSize({width:768,height:1024});path=info.outputPath('score-result-768x1024.png');await page.screenshot({path,fullPage:true});await info.attach('Tablet score result',{path,contentType:'image/png'});
  await page.setViewportSize({width:852,height:393});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  path=info.outputPath('score-result-landscape.png');await page.screenshot({path,fullPage:true});await info.attach('Landscape score result',{path,contentType:'image/png'});
  await page.setViewportSize({width:393,height:852});await page.evaluate(()=>document.documentElement.style.fontSize=(parseFloat(getComputedStyle(document.documentElement).fontSize)*2)+'px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  path=info.outputPath('score-result-200-percent.png');await page.screenshot({path,fullPage:true});await info.attach('200 percent score result',{path,contentType:'image/png'});
});

test('all four named games use explicit Correct feedback through the shared player',async({page})=>{
  await open(page);
  for(const mode of ['quick','math','words','faith']){
    await page.locator('[data-study-source]').selectOption('weekly');
    const button=page.locator('[data-game-start="'+mode+'"]');
    if(await button.isDisabled())continue;
    await button.click();
    const q=await visibleQuestion(page);expect(q).not.toBeNull();
    const correct=q.choices.indexOf(q.answer);expect(correct).toBeGreaterThanOrEqual(0);
    await page.locator('[data-game-answer]').nth(correct).click();
    await expect(page.locator('.game-feedback strong')).toHaveText('Correct');
    await expect(page.locator('.game-feedback')).toHaveAttribute('aria-live','polite');
    await page.locator('[data-game-home]').click();
  }
  const daily=page.locator('[data-game-start="daily"]');
  if(await daily.count()&&await daily.isEnabled()){
    await daily.click();const q=await visibleQuestion(page);expect(q).not.toBeNull();
    await page.locator('[data-game-answer]').nth(q.choices.indexOf(q.answer)).click();
    await expect(page.locator('.game-feedback strong')).toHaveText('Correct');
  }
});

test('score helper excludes review questions and reconciles subject denominators',async({page})=>{
  await open(page);
  const result=await page.evaluate(async()=>{
    const envelope=await fetch('./data/study-pack-runtime.json').then(r=>r.json()),engine=window.ABVMStudyGames,view=window.ABVMStudyGameView;
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)});
    const math=catalog.questions.filter(q=>q.subject==='Math').slice(0,2),reading=catalog.questions.find(q=>q.subject==='Reading / ELA')||catalog.questions.find(q=>q.subject!=='Math');
    if(math.length<2||!reading)throw new Error('Need real Math and reading questions');
    const state={results:[],sourceKey:catalog.sourceKey,mode:'quick'};
    view.recordAttempt(state,math[0],{counted:true,kind:'primary',correct:false,resolved:false,index:0,attempt:1});
    view.recordAttempt(state,math[0],{counted:true,kind:'primary',correct:true,resolved:true,index:0,attempt:2});
    view.recordAttempt(state,math[1],{counted:true,kind:'primary',correct:true,resolved:true,index:1,attempt:1});
    view.recordAttempt(state,reading,{counted:true,kind:'primary',correct:true,resolved:true,index:2,hintUsed:true,attempt:1});
    view.recordAttempt(state,math[0],{counted:false,kind:'comeback',correct:true,resolved:true,index:0,attempt:1});
    return {summary:view.scoreSummary(state),sections:view.sectionScores(state),empty:view.scoreSummary({results:[]})};
  });
  expect(result.summary).toMatchObject({answered:3,correct:2,incorrect:1,corrected:1,hinted:1,percent:67});
  expect(result.empty).toMatchObject({answered:0,correct:0,incorrect:0,corrected:0,hinted:0,percent:null});
  const math=result.sections.find(row=>row.subject==='Math');expect(math).toMatchObject({answered:2,correct:1,percent:50});
  expect(result.sections.reduce((n,row)=>n+row.answered,0)).toBe(3);
});
