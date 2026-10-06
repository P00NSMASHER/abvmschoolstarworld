import {test,expect} from '@playwright/test';

async function resolveQuestion(page){
  const card=page.locator('.game-question-card');
  await expect(card).toBeVisible();
  const prompt=(await card.locator('h2').innerText()).trim();
  const choices=(await card.locator('[data-game-answer] strong').allTextContents()).map(x=>x.trim());
  return page.evaluate(async ({prompt,choices})=>{
    const envelope=await fetch('./data/study-pack.json',{cache:'no-store'}).then(r=>r.json());
    const engine=window.ABVMStudyGames;
    const sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey});
    const q=catalog.questions.find(item=>item.prompt===prompt&&item.choices.length===choices.length&&item.choices.every((choice,index)=>choice===choices[index]));
    if(!q)throw new Error('Could not resolve rendered question');
    return{answer:q.answer,answerIndex:q.choices.indexOf(q.answer),choices:q.choices,subject:q.subject};
  },{prompt,choices});
}

test.beforeEach(async({page})=>{
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
  await page.evaluate(()=>{
    localStorage.removeItem('abvm-study-comebacks:v1');
    localStorage.removeItem('abvm-study-learning:v2');
  });
  await page.reload();
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
});

test('first-answer summary keeps retries and sections honest',async({page})=>{
  const summary=await page.evaluate(()=>window.ABVMStudyGameView.accuracySummary({
    accuracyRows:[
      {key:'1',subject:'Reading',firstCorrect:true,eventualCorrect:true,hintUsed:false},
      {key:'2',subject:'Reading',firstCorrect:true,eventualCorrect:true,hintUsed:true},
      {key:'3',subject:'Reading',firstCorrect:true,eventualCorrect:true,hintUsed:false},
      {key:'4',subject:'Reading',firstCorrect:false,eventualCorrect:true,hintUsed:false},
      {key:'5',subject:'Math',firstCorrect:true,eventualCorrect:true,hintUsed:false},
      {key:'6',subject:'Math',firstCorrect:true,eventualCorrect:true,hintUsed:false},
      {key:'7',subject:'Math',firstCorrect:true,eventualCorrect:true,hintUsed:false},
      {key:'8',subject:'Math',firstCorrect:false,eventualCorrect:false,hintUsed:false},
    ]
  }));
  expect(summary).toMatchObject({answered:8,correct:6,incorrect:2,corrected:1,assisted:1,percent:75});
  expect(summary.sections).toEqual([
    {subject:'Reading',answered:4,correct:3,incorrect:1,corrected:1,assisted:1,percent:75},
    {subject:'Math',answered:4,correct:3,incorrect:1,corrected:0,assisted:0,percent:75},
  ]);
});

test('wrong first answer is explicitly Incorrect and a retry cannot inflate first-try score',async({page})=>{
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  let row=await resolveQuestion(page);
  const wrongIndex=row.choices.findIndex(choice=>choice!==row.answer);
  expect(wrongIndex).toBeGreaterThanOrEqual(0);

  await page.locator('.game-answer').nth(wrongIndex).click();
  await expect(page.locator('.game-feedback.incorrect strong')).toHaveText('Incorrect. Try again.');
  await expect(page.locator('.game-live-score')).toContainText('0 / 1 first try');
  await expect(page.locator('.game-answer').nth(wrongIndex)).toBeDisabled();

  await page.locator('.game-answer').nth(row.answerIndex).click();
  await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct on retry');
  await expect(page.locator('.game-feedback.correct')).toContainText('first-try score does not increase');
  await expect(page.locator('.game-live-score')).toContainText('0 / 1 first try');
});

test('six first-try correct answers out of eight finish at exactly 75 percent even after two corrections',async({page})=>{
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  for(let i=0;i<8;i++){
    const row=await resolveQuestion(page);
    if(i<2){
      const wrongIndex=row.choices.findIndex(choice=>choice!==row.answer);
      await page.locator('.game-answer').nth(wrongIndex).click();
      await expect(page.locator('.game-feedback.incorrect strong')).toHaveText('Incorrect. Try again.');
      await page.locator('.game-answer').nth(row.answerIndex).click();
      await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct on retry');
    }else{
      await page.locator('.game-answer').nth(row.answerIndex).click();
      await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct');
    }
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.accuracy-hero')).toContainText('6 / 8');
  await expect(page.locator('.accuracy-hero')).toContainText('75%');
  await expect(page.locator('.accuracy-details')).toContainText('Initially incorrect');
  await expect(page.locator('.accuracy-details')).toContainText('2');
  await expect(page.locator('.accuracy-details')).toContainText('Corrected on retry');
  const sections=page.locator('[data-section-score]');
  expect(await sections.count()).toBeGreaterThan(0);
  const totals=await sections.evaluateAll(nodes=>nodes.map(node=>{
    const match=node.querySelector('strong')?.textContent?.match(/(\d+)\s*\/\s*(\d+)/);
    return match?{correct:Number(match[1]),answered:Number(match[2])}:null;
  }).filter(Boolean));
  expect(totals.reduce((sum,row)=>sum+row.correct,0)).toBe(6);
  expect(totals.reduce((sum,row)=>sum+row.answered,0)).toBe(8);
});

test('hinted first-answer correctness is scored but labeled assisted',async({page})=>{
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  const row=await resolveQuestion(page);
  await page.getByRole('button',{name:'Need a hint?'}).click();
  await page.locator('.game-answer').nth(row.answerIndex).click();
  await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct');
  await expect(page.locator('.game-feedback.correct')).toContainText('Hint used');
  await expect(page.locator('.game-live-score')).toContainText('1 / 1 first try');
});

test('support and comeback feedback are explicit and excluded from accuracy',async({page})=>{
  const base={
    index:0,questions:[{id:'q1'}],wrong:[],selectedIndex:0,answered:true,hintOpen:false,retry:0,misses:0,hints:0,
    accuracyRows:[{key:'0|q1',subject:'Math',firstCorrect:false,eventualCorrect:false,hintUsed:false}],
    learningRow:null,strict:false
  };
  const q={id:'review',subject:'Math',tier:'material',questionType:'practice',prompt:'Review?',choices:['Yes','No'],answer:'Yes',hint:'Think again.',explanation:'Yes is correct.'};
  const supportHtml=await page.evaluate(({base,q})=>window.ABVMStudyGameView.play({g:{...base,supportMode:true,comebackMode:false},mode:{title:'Math Dash'},q,labels:{practice:'Practice'}}),{base,q});
  expect(supportHtml).toContain('Correct — review question');
  expect(supportHtml).toContain('Review question · not part of the section score');
  const comebackHtml=await page.evaluate(({base,q})=>window.ABVMStudyGameView.play({g:{...base,supportMode:false,comebackMode:true,selectedIndex:1},mode:{title:'Math Dash'},q,labels:{practice:'Practice'}}),{base,q});
  expect(comebackHtml).toContain('Incorrect — review question');
  expect(comebackHtml).toContain('Review question · not part of the section score');
});
