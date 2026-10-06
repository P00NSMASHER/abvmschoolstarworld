import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test.use({serviceWorkers:'block'});
const APP='http://127.0.0.1:4173';
const QUEUE='abvm-study-comebacks:v1';

async function openFixture(page){
  await page.clock.setFixedTime(new Date('2026-10-06T13:00:00Z'));
  const initial=structuredClone(await(await page.request.get(APP+'/data/study-pack.json')).json());
  initial.pack.importantDates=[{date:'Wednesday, Oct. 7',label:'Math test',kind:'test'}];
  initial.sourceLastSeenAt='2026-10-06T12:00:00.000Z';
  let current=initial,revision=0;
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:current}));
  await page.route('**/data/study-pack.json*',route=>route.fulfill({json:current}));
  await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{lessons:[]}}));
  await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{notes:[],vocabulary:[],questions:[]}}));
  await page.goto(APP+'/#games');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:10_000});
  await page.locator('select[data-study-source]').selectOption('weekly');
  await page.evaluate(()=>{
    localStorage.clear();
    return new Promise((resolve,reject)=>{
      const request=indexedDB.deleteDatabase('abvm-study-stars-v1');
      request.onsuccess=()=>resolve();
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('The fixture could not reset the Study Star ledger'));
    });
  });
  const catalog=await page.evaluate(envelope=>{
    const engine=window.ABVMStudyGames;
    const sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    const built=engine.buildCatalog(envelope.pack,{sourceKey});
    return {sourceKey,questions:built.questions.map(({id,subject,skill,prompt,choices,answer})=>({id,subject,skill,prompt,choices,answer}))};
  },initial);
  return {
    initial,catalog,
    async refresh(){
      const priorScreen=await page.locator('.games-screen').elementHandle();
      revision++;
      const next=structuredClone(initial);
      next.pack.sourceHash=initial.pack.sourceHash+'-async-refresh-'+revision;
      // Source-page hashes take precedence over pack.sourceHash in the public
      // catalog key. Change their identity too, while retaining the real bank.
      next.sourcePages=(next.sourcePages||[]).map(row=>row.contentHash
        ? {...row,contentHash:row.contentHash+'-async-refresh-'+revision}:row);
      next.sourceLastSeenAt='2026-10-06T12:59:00.000Z';
      current=next;
      const received=page.waitForResponse(response=>response.url().includes('/data/study-pack-runtime.json')&&response.status()===200);
      await page.evaluate(()=>window.dispatchEvent(new Event('online')));
      expect((await(await received).json()).pack.sourceHash).toBe(next.pack.sourceHash);
      await expect.poll(()=>priorScreen.evaluate(node=>node.isConnected)).toBe(false);
      await priorScreen.dispose();
      await expect(page.locator('#toast')).toContainText('School info updated');
      const key=await page.evaluate(envelope=>window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack,envelope),next);
      expect(key).not.toBe(catalog.sourceKey);
      return key;
    }
  };
}

async function visibleQuestion(page,questions){
  const card=page.locator('.game-question-card');
  await expect(card).toBeVisible();
  const prompt=(await card.locator(':scope > h2').textContent()).trim();
  const choices=(await card.locator('[data-game-answer] strong').allTextContents()).map(text=>text.trim());
  const matches=questions.filter(question=>question.prompt.trim()===prompt&&
    question.choices.length===choices.length&&question.choices.every((choice,index)=>choice.trim()===choices[index]));
  expect(matches.length,'the visible question must resolve against the frozen source catalog').toBeGreaterThan(0);
  expect(new Set(matches.map(question=>question.answer)).size,'matching source questions must agree on the answer').toBe(1);
  const question=matches[0];
  return {...question,answerIndex:choices.indexOf(question.answer.trim()),choices};
}

async function finishPerfectRound(page,catalog){
  for(let index=0;index<8;index++){
    await expect(page.locator('.game-topbar > div > strong')).toHaveText(`${index+1} of 8`);
    const question=await visibleQuestion(page,catalog.questions);
    expect(question.answerIndex).toBeGreaterThanOrEqual(0);
    await page.locator('.game-question-card [data-game-answer]').nth(question.answerIndex).click();
    await expect(page.locator('.game-feedback.correct')).toBeVisible();
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.game-score-summary>strong')).toHaveText('8 / 8 correct on the first try · 100%');
}

// This JSHandle owns only test coordination. Production APIs still perform the
// real ledger commit/read; no app state or production-only test hook is exposed.
async function holdReward(page,{stage='balance',fail=false}={}){
  return page.evaluateHandle(({stage,fail})=>{
    const engine=window.ABVMStudyGames;
    let release;
    const gate=new Promise(resolve=>{release=resolve});
    const state={phase:'idle',calls:[],receipt:null,balance:null,error:null,pending:null};
    async function wait(){
      state.phase='held';
      await gate;
      if(fail){state.phase='rejected';state.error='Fixture ledger write failed';throw new Error(state.error)}
    }
    window.ABVMStudyGames={...engine,
      commitStudyStarRewards(args){
        state.calls.push({...args});
        const pending=(async()=>{
          if(stage==='commit')await wait();
          state.receipt=await engine.commitStudyStarRewards(args);
          return state.receipt;
        })();
        if(stage==='commit')state.pending=pending;
        return pending;
      },
      studyStarBalance(){
        const pending=(async()=>{
          if(stage==='balance')await wait();
          state.balance=await engine.studyStarBalance();
          state.phase='settled';
          return state.balance;
        })();
        if(stage==='balance')state.pending=pending;
        return pending;
      }
    };
    return {
      release:()=>release(),
      snapshot:()=>({phase:state.phase,calls:state.calls,receipt:state.receipt,balance:state.balance,error:state.error}),
      async releaseAndWait(){
        if(!state.pending)throw new Error('The reward promise has not started');
        release();
        try{await state.pending}catch{}
        // The app attached its settlement handlers before this observer. Drain
        // their promise continuations before checking that another route stayed.
        await Promise.resolve();
        await Promise.resolve();
      }
    };
  },{stage,fail});
}

async function waitForPendingReward(page,hold,catalog){
  await expect(page.locator('.study-star-earned')).toContainText('Saving on this device');
  await expect.poll(()=>hold.evaluate(fixture=>fixture.snapshot().phase)).toBe('held');
  const snapshot=await hold.evaluate(fixture=>fixture.snapshot());
  expect(snapshot.calls).toHaveLength(1);
  expect(snapshot.calls[0]).toMatchObject({sourcePack:catalog.sourceKey,mode:'quick',completed:true,comebackSucceeded:false});
  return snapshot.calls[0];
}

async function finishTextMetrics(page){
  return page.locator('.game-finish .learning-summary-note,.game-finish .study-star-earned > *').evaluateAll(nodes=>nodes.map(node=>({
    text:node.textContent.trim(),
    kind:node.matches('.learning-summary-note')?'mastery':node.matches('.study-star-earned > span,.study-star-earned > small')?'secondary':'primary',
    fontSize:parseFloat(getComputedStyle(node).fontSize),
    clipped:node.clientWidth>0&&node.scrollWidth>node.clientWidth+1
  })));
}

test('Math skips an earlier Faith Comeback and strict test practice leaves all queued work untouched',async({page})=>{
  const fixture=await openFixture(page);
  const seeded=await page.evaluate(async envelope=>{
    const engine=window.ABVMStudyGames;
    const sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey});
    const {createStudyMaterials}=await import('./study-materials.mjs');
    const model=createStudyMaterials({pack:envelope.pack,catalog,engine,
      schoolwork:{lessons:[]},archive:{notes:[],vocabulary:[],questions:[]},
      events:[{date:'2026-10-07',label:'Math test'}]});
    function pair(rows){
      for(const question of rows){
        const origin=rows.find(row=>row.id!==question.id&&row.skill===question.skill);
        if(origin)return {question,origin};
      }
      throw new Error('The public bank needs two same-skill questions for the queue fixture');
    }
    function eligible(mode){
      const scope=model.forMode(mode,{source:'weekly'}),ids=new Set(scope.eligibleIds);
      if(scope.sourceKey!==sourceKey)throw new Error('Weekly practice changed the canonical source key');
      return pair(scope.catalog.questions.filter(question=>ids.has(question.id)));
    }
    const faith=eligible('faith'),math=eligible('math');
    const row=({question,origin},key=sourceKey,remaining=0)=>({key:key+'|'+origin.id+'|'+question.id,
      sourceKey:key,questionId:question.id,originQuestionId:origin.id,skill:question.skill,remaining});
    const queue=[row(faith),row(math)];
    localStorage.setItem('abvm-study-comebacks:v1',JSON.stringify(queue));
    const strict=model.testRound({seed:'inspect-strict-queue-scope'}),strictPair=pair(strict.catalog.questions);
    return {sourceKey,queue,math:math.question,strictQuestions:strict.catalog.questions,
      strictQueue:[...queue,row(strictPair,strict.sourceKey),
        row({question:strictPair.origin,origin:strictPair.question},strict.sourceKey,2)]};
  },fixture.initial);
  expect(seeded.sourceKey).toBe(fixture.catalog.sourceKey);
  await page.locator('.study-game-grid [data-game-start="math"]').click();
  await expect(page.locator('.game-topbar > div > span')).toHaveText('Comeback');
  await expect(page.locator('.game-question-meta > span')).toHaveText('Math');
  await expect(page.locator('.game-question-card > h2')).toHaveText(seeded.math.prompt);
  await expect(page.locator('.adaptive-note')).toContainText('not part of the section score');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),QUEUE)).toEqual(seeded.queue);
  const comeback=await visibleQuestion(page,fixture.catalog.questions);
  await page.locator('[data-game-answer]').nth(comeback.answerIndex).click();
  await page.locator('[data-game-next]').click();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),QUEUE)).toEqual([seeded.queue[0]]);
  await expect(page.locator('.game-topbar > div > strong')).toHaveText('1 of 8');
  await page.locator('[data-game-home]').click();

  // Due weekly rows alone cannot detect ticking: zero is unchanged by a tick.
  // Include eligible due/counter rows under the actual strict-test source key.
  await page.evaluate(({key,rows})=>localStorage.setItem(key,JSON.stringify(rows)),{key:QUEUE,rows:seeded.strictQueue});
  await expect(page.locator('[data-study-tests] time')).toHaveAttribute('datetime','2026-10-07');
  await page.locator('[data-test]').click();
  await expect(page.locator('.game-topbar > div > span')).toHaveText('Test practice');
  await expect(page.locator('.game-topbar > div > strong')).toHaveText('1 of 8');
  await expect(page.locator('.game-question-meta > span')).toHaveText('Math');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),QUEUE)).toEqual(seeded.strictQueue);
  const question=await visibleQuestion(page,seeded.strictQuestions);
  const wrongs=question.choices.map((choice,index)=>index!==question.answerIndex?index:-1).filter(index=>index>=0);
  for(const index of wrongs.slice(0,2))await page.locator('[data-game-answer]').nth(index).click();
  await expect(page.locator('[data-game-next]')).toBeVisible();
  await page.locator('[data-game-next]').click();
  await expect(page.locator('.game-topbar > div > span')).toHaveText('Test practice');
  await expect(page.locator('.game-topbar > div > strong')).toHaveText('2 of 8');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),QUEUE)).toEqual(seeded.strictQueue);
});

for(const outcome of ['success','failure']){
  test(`an active finish shows its own delayed reward ${outcome} after school-pack refresh`,async({page},info)=>{
    test.setTimeout(60_000);
    await page.setViewportSize({width:393,height:852});
    const fixture=await openFixture(page);
    const hold=await holdReward(page,{stage:outcome==='success'?'balance':'commit',fail:outcome==='failure'});
    try{
      await page.locator('.study-game-grid [data-game-start="quick"]').click();
      const first=await visibleQuestion(page,fixture.catalog.questions);
      await fixture.refresh();
      expect((await visibleQuestion(page,fixture.catalog.questions)).id).toBe(first.id);
      await finishPerfectRound(page,fixture.catalog);
      const call=await waitForPendingReward(page,hold,fixture.catalog);
      await fixture.refresh();
      await expect(page.locator('.game-finish')).toBeVisible();
      await expect(page.locator('.study-star-earned')).toContainText('Saving on this device');
      await hold.evaluate(fixture=>fixture.releaseAndWait());
      const result=await hold.evaluate(fixture=>fixture.snapshot());
      await expect(page.locator('.study-star-earned')).not.toContainText('Saving on this device');
      await expect(page.locator('.game-finish h2')).toHaveText('Your score');
      await expect(page.locator('.game-finish [data-game-start="quick"]')).toBeEnabled();
      await expect(page.locator('.game-finish [data-game-home]')).toBeEnabled();
      const ledger=await page.evaluate(()=>window.ABVMStudyGames.loadStudyStarLedger());
      if(outcome==='success'){
        expect(result.receipt.awardedAmount).toBeGreaterThan(0);
        await expect(page.locator('.study-star-earned')).toContainText('+'+result.receipt.awardedAmount+' Study Stars');
        await expect(page.locator('.study-star-earned')).toContainText('Balance '+result.balance);
        expect(ledger).toHaveLength(1);
        expect(ledger[0]).toMatchObject({sourcePack:fixture.catalog.sourceKey,roundId:call.roundId,amount:result.receipt.awardedAmount});
      }else{
        await expect(page.locator('.study-star-earned[role="status"]')).toContainText('Study Stars could not be confirmed.');
        await expect(page.locator('.study-star-earned[role="status"]')).toContainText('You can keep practicing.');
        await expect(page.locator('.study-star-earned')).not.toContainText(/Balance|\+\d+ Study Stars|Already saved/);
        expect(ledger).toEqual([]);
      }
      expect(result.calls).toHaveLength(1);
      await expect(page.locator('[data-reward-reveal]')).toHaveCount(0);
      const normalText=await finishTextMetrics(page);
      expect(normalText.filter(row=>row.kind==='mastery')).toHaveLength(1);
      for(const row of normalText){
        expect(row.fontSize,row.text+' is readable at the default text size').toBeGreaterThanOrEqual(row.kind==='secondary'?14:16);
        expect(row.clipped,row.text+' is not clipped').toBe(false);
      }
      const previousFont=await page.evaluate(doubleText=>{
        const root=document.documentElement,previous=root.style.fontSize;
        if(doubleText)root.style.fontSize=(parseFloat(getComputedStyle(root).fontSize)*2)+'px';
        return previous;
      },outcome==='success');
      try{
        const displayedText=await finishTextMetrics(page);
        expect(displayedText.map(row=>row.text)).toEqual(normalText.map(row=>row.text));
        for(let i=0;i<displayedText.length;i++){
          expect(displayedText[i].fontSize,displayedText[i].text+' follows the root text size').toBeGreaterThanOrEqual(normalText[i].fontSize*(outcome==='success'?2:1)-.1);
          expect(displayedText[i].clipped,displayedText[i].text+' is not clipped').toBe(false);
        }
        const metricsPath=info.outputPath(outcome==='success'?'games-result-text-metrics.json':'games-reward-error-text-metrics.json');
        await writeFile(metricsPath,JSON.stringify({viewport:{width:393,height:852},scale:outcome==='success'?2:1,normal:normalText,displayed:displayedText},null,2));
        await info.attach('Result text metrics',{path:metricsPath,contentType:'application/json'});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
        await page.locator('.games-screen').evaluate(el=>{el.scrollTop=0;});
        const name=outcome==='success'?'games-result-200-percent-iphone':'games-reward-error-iphone';
        let path=info.outputPath(name+'-top.png');
        await page.screenshot({path});await info.attach(name+' top',{path,contentType:'image/png'});
        const actions=page.locator('.game-finish-actions');
        if(await actions.evaluate(el=>el.getBoundingClientRect().bottom>innerHeight-document.querySelector('.bottom-nav').getBoundingClientRect().height)){
          await actions.scrollIntoViewIfNeeded();
          path=info.outputPath(name+'-controls.png');
          await page.screenshot({path});await info.attach(name+' controls',{path,contentType:'image/png'});
        }
      }finally{await page.evaluate(font=>{document.documentElement.style.fontSize=font;},previousFont);}
    }finally{
      await hold.evaluate(fixture=>fixture.release()).catch(()=>{});
      await hold.dispose();
    }
  });
}

test('delayed reward success and failure cannot repaint Today or Family after navigation',async({browser})=>{
  test.setTimeout(60_000);
  for(const {destination,fail} of [{destination:'Today',fail:false},{destination:'Family',fail:true}]){
    await test.step(destination,async()=>{
      const context=await browser.newContext({serviceWorkers:'block',baseURL:APP});
      const page=await context.newPage();
      let hold;
      try{
        const fixture=await openFixture(page);
        hold=await holdReward(page,{stage:fail?'commit':'balance',fail});
        await page.locator('.study-game-grid [data-game-start="quick"]').click();
        await fixture.refresh();
        await finishPerfectRound(page,fixture.catalog);
        await waitForPendingReward(page,hold,fixture.catalog);
        await page.getByRole('button',{name:destination,exact:true}).click();
        const screen=page.locator(destination==='Today'?'.today-screen':'.family-screen');
        await expect(screen).toBeVisible();
        const before=await screen.elementHandle();
        await hold.evaluate(fixture=>fixture.releaseAndWait());
        const result=await hold.evaluate(fixture=>fixture.snapshot());
        expect(result.phase).toBe(fail?'rejected':'settled');
        expect(await before.evaluate(node=>node.isConnected)).toBe(true);
        await expect(screen).toBeVisible();
        await expect(page.locator('.games-screen,.game-finish,.study-star-earned')).toHaveCount(0);
        await expect(page.getByRole('button',{name:destination,exact:true})).toHaveAttribute('aria-current','page');
        await expect(page).toHaveURL(new RegExp('#'+destination.toLowerCase()+'$'));
        await before.dispose();
      }finally{
        if(hold){await hold.evaluate(fixture=>fixture.release()).catch(()=>{});await hold.dispose()}
        await context.close();
      }
    });
  }
});
