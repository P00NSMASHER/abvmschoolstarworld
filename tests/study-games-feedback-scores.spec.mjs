import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.goto('/#games');
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
});

async function currentQuestion(page){
  const prompt=await page.locator('.game-question-card h2').textContent();
  return page.evaluate(async currentPrompt=>{
    const envelope=await fetch('./data/study-pack.json',{cache:'no-store'}).then(r=>r.json());
    const engine=window.ABVMStudyGames;
    const sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey});
    const q=catalog.questions.find(item=>item.prompt===currentPrompt);
    return q?{answer:q.answer,choices:q.choices,subject:q.subject}:null;
  },prompt);
}

async function answerByText(page,text){
  const index=await page.locator('.game-answer strong').evaluateAll((nodes,answer)=>nodes.findIndex(node=>node.textContent===answer),text);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator('.game-answer').nth(index).click();
}

test('wrong answers are explicit and a successful retry does not inflate first-try accuracy',async({page})=>{
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  const q=await currentQuestion(page);
  expect(q).not.toBeNull();
  const wrong=q.choices.find(choice=>choice!==q.answer);
  await answerByText(page,wrong);
  await expect(page.locator('.game-feedback.incorrect strong')).toHaveText('Incorrect. Try again.');
  await expect(page.locator('.game-live-score')).toContainText('0 / 1 first try');
  await answerByText(page,q.answer);
  await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct on retry.');
  await expect(page.locator('.game-feedback.correct')).toContainText('First-try score does not increase on a retry.');
  await expect(page.locator('.game-live-score')).toContainText('0 / 1 first try');
});

test('a correct answer after opening a hint counts for accuracy but is labeled assisted',async({page})=>{
  await page.getByRole('button',{name:/Math Dash/i}).click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  await page.getByRole('button',{name:'Need a hint?'}).click();
  const q=await currentQuestion(page);
  expect(q).not.toBeNull();
  await answerByText(page,q.answer);
  await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct.');
  await expect(page.locator('.game-feedback.correct')).toContainText('Hint used');
  await expect(page.locator('.game-live-score')).toContainText('1 / 1 first try');
});

test('six of eight first-try answers remains 75 percent after both mistakes are corrected',async({page})=>{
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  for(let scored=0;scored<8;scored++){
    await expect(page.locator('.game-question-card')).toBeVisible();
    const q=await currentQuestion(page);
    expect(q).not.toBeNull();
    if(scored<2){
      const wrong=q.choices.find(choice=>choice!==q.answer);
      await answerByText(page,wrong);
      await expect(page.locator('.game-feedback.incorrect strong')).toHaveText('Incorrect. Try again.');
      await answerByText(page,q.answer);
      await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct on retry.');
    }else{
      await answerByText(page,q.answer);
      await expect(page.locator('.game-feedback.correct strong')).toHaveText('Correct.');
    }
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.game-accuracy-hero strong')).toHaveText('6 / 8');
  await expect(page.locator('.game-accuracy-hero')).toContainText('75%');
  await expect(page.locator('.game-score-detail')).toContainText('2');
  await expect(page.locator('.game-score-detail')).toContainText('Corrected on retry');
  const totals=await page.locator('.game-section-score-row strong').allTextContents();
  const parsed=totals.map(text=>text.match(/(\d+)\s*\/\s*(\d+)/)).filter(Boolean).map(match=>[Number(match[1]),Number(match[2])]);
  expect(parsed.length).toBeGreaterThan(0);
  expect(parsed.reduce((sum,row)=>sum+row[0],0)).toBe(6);
  expect(parsed.reduce((sum,row)=>sum+row[1],0)).toBe(8);
});

test('support review feedback is explicit and excluded from section scoring',async({page})=>{
  await page.getByRole('button',{name:/Quick Mix/i}).click();
  const html=await page.evaluate(()=>{
    const q={id:'review',subject:'Math',tier:'material',questionType:'direct',prompt:'2 + 2 = ?',choices:['3','4','5'],answer:'4',hint:'Count on.',explanation:'Two plus two equals four.'};
    const g={supportMode:true,comebackMode:false,index:0,questions:[q],selectedIndex:0,answered:true,hintOpen:false,wrong:[],retry:0,misses:0,hints:0,questionResults:[],firstTryCorrect:0,firstTryAnswered:0,learningRow:null,strict:false};
    return window.ABVMStudyGameView.play({g,mode:{title:'Quick Mix'},q,teach:null,retryInstruction:'',labels:{direct:'Practice'},canRead:false});
  });
  expect(html).toContain('Incorrect. The correct answer is 4.');
  expect(html).toContain('Review question · not part of the section score');
  expect(html).toContain('No answers yet');
});
