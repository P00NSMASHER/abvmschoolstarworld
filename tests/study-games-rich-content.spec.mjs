import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
});

test('catalog adds validated non-answer-leaking rich formats to appropriate questions', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
    const pack = structuredClone(envelope.pack);
    const base = {
      subject:'Math',
      sourceFact:'Controlled Grade 2 rich-format regression fixture',
      standards:['CCSS.2.OA.A.1'],
      domain:'Mathematics',
      dok:2,
      difficulty:2,
    };
    pack.contentPipeline = {
      schemaVersion:2,
      sourceHash:'rich-format-fixture',
      skills:[
        {id:'subtraction-within-20',subject:'Math'},
        {id:'time',subject:'Math'},
        {id:'place-value',subject:'Math'},
        {id:'data-interpretation',subject:'Math'},
      ],
      coverage:[],
      questions:[
        {...base,id:'rich-subtraction',skill:'subtraction-within-20',questionType:'direct',
          prompt:'What is 12 − 5? Choose the correct difference.',choices:['7','8','6'],answer:'7',
          explanation:'12 − 5 = 7.',hint:'Start at 12 and move back 5.'},
        {...base,id:'rich-time',skill:'time',questionType:'transfer',
          prompt:'A movie starts at 2:15 and lasts 30 minutes. What time does it end?',choices:['2:45','2:30','3:15'],answer:'2:45',
          explanation:'Thirty minutes after 2:15 is 2:45.',hint:'Count forward 30 minutes.'},
        {...base,id:'rich-place',skill:'place-value',questionType:'direct',
          prompt:'In the number 462, what value does the 6 represent?',choices:['60','6','600'],answer:'60',
          explanation:'The 6 is in the tens place, so its value is 60.',hint:'Name the place of the 6.'},
        {...base,id:'rich-data',skill:'data-interpretation',questionType:'reasoning',
          prompt:'A class chart shows 7 votes for apples, 5 for bananas, and 3 for grapes. How many more votes did apples get than grapes?',
          choices:['4','10','2'],answer:'4',explanation:'7 − 3 = 4.',hint:'Find the difference between apples and grapes.'},
      ],
    };
    const engine = window.ABVMStudyGames;
    const catalog = engine.buildCatalog(pack, { sourceKey:'rich-format-fixture' });
    const rich = catalog.questions.filter(q => q.id.startsWith('rich-')).map(q => ({
      id:q.id,skill:q.skill,kind:q.richContent?.kind||null,rich:q.richContent,prompt:q.prompt,answer:q.answer
    }));
    return {rich, issues:engine.validateCatalog(catalog)};
  });
  expect(result.issues).toEqual([]);
  const kinds = new Set(result.rich.map(row => row.kind));
  for (const kind of ['number-line','clock','place-value','bar-chart']) expect(kinds.has(kind)).toBe(true);
  const numberLine = result.rich.find(row => row.kind === 'number-line');
  expect(numberLine.rich).not.toHaveProperty('end');
  expect(JSON.stringify(numberLine.rich)).not.toContain('"answer"');
});
test('every supported rich format has an accessible text alternative and keeps tap answers intact', async ({ page }) => {
  const cases = [
    {kind:'number-line',label:'Start at 12 and move back 5 spaces.',min:0,max:12,start:12,steps:5},
    {kind:'clock',label:'Clock showing 2:15.',hour:2,minute:15},
    {kind:'place-value',label:'Place-value chart for 462.',number:462},
    {kind:'bar-chart',label:'Votes for fruit.',entries:[{label:'Apples',value:7},{label:'Bananas',value:5},{label:'Grapes',value:3}]},
  ];
  for (const richContent of cases) {
    const html = await page.evaluate(content => window.ABVMStudyGameView.play({
      g:{supportMode:false,comebackMode:false,index:0,questions:[1],selectedIndex:null,answered:false,retry:0,lastWrong:null,score:0,streak:0,bestStreak:0,learningRow:{}},
      mode:{title:'Quick Mix'},
      q:{subject:'Math',questionType:'direct',prompt:'Use the visual, then choose the answer.',choices:['1','2','3'],answer:'2',explanation:'Model explanation.',hint:'Use the visual.',choiceDiagnostics:{'1':{feedback:'Try again.'},'3':{feedback:'Try again.'}},richContent:content},
      teach:null,retryInstruction:'Use the clue.',labels:{direct:'Practice'}
    }), richContent);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="');
    expect((html.match(/class="game-answer"/g)||[]).length).toBe(3);
  }
});

test('place-value support never fills the answer-bearing digit into a labeled place', async ({ page }) => {
  const result = await page.evaluate(() => {
    const q = {
      subject:'Math',questionType:'direct',
      prompt:'In the number 462, what value does the 6 represent?',
      choices:['60','6','600'],answer:'60',explanation:'The 6 is in the tens place.',hint:'Name the place of the 6.',
      choiceDiagnostics:{'6':{feedback:'Check the place, not just the digit.'},'600':{feedback:'Check the hundreds and tens places.'}},
      richContent:{kind:'place-value',label:'Blank place-value chart. Use the number in the question to identify hundreds, tens, and ones.',number:462}
    };
    const html = window.ABVMStudyGameView.play({
      g:{supportMode:false,comebackMode:false,index:0,questions:[q],selectedIndex:null,answered:false,retry:0,lastWrong:null,score:0,streak:0,bestStreak:0,learningRow:{}},
      mode:{title:'Quick Mix'},q,teach:null,retryInstruction:'Use the clue.',labels:{direct:'Practice'}
    });
    const host = document.createElement('div');
    host.innerHTML = html;
    const visual = host.querySelector('.rich-place-value');
    return {
      answer:String(q.answer),
      visualText:visual?.textContent || '',
      visualHtml:visual?.innerHTML || '',
      label:visual?.getAttribute('aria-label') || ''
    };
  });
  expect(result.visualText).not.toContain(result.answer);
  expect(result.visualHtml).toContain('Hundreds');
  expect(result.visualHtml).toContain('Tens');
  expect(result.visualHtml).toContain('Ones');
  expect(result.visualHtml).not.toMatch(/<b[^>]*>[0-9]<\/b>/);
  expect(result.label).toContain('Blank place-value chart');
});

test('malformed visuals fail to text-only presentation instead of blocking a question', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const invalid = {kind:'clock',label:'Broken clock',hour:99,minute:15};
    const html = window.ABVMStudyGameView.play({
      g:{supportMode:false,comebackMode:false,index:0,questions:[1],selectedIndex:null,answered:false,retry:0,lastWrong:null,score:0,streak:0,bestStreak:0,learningRow:{}},
      mode:{title:'Quick Mix'},
      q:{subject:'Math',questionType:'direct',prompt:'This question must stay answerable.',choices:['A','B','C'],answer:'B',explanation:'Explanation.',hint:'Hint.',choiceDiagnostics:{'A':{feedback:'Try again.'},'C':{feedback:'Try again.'}},richContent:invalid},
      teach:null,retryInstruction:'Use the clue.',labels:{direct:'Practice'}
    });
    return {valid:engine.validateRichContent(invalid),html};
  });
  expect(result.valid).toBe(false);
  expect(result.html).not.toContain('game-rich-content');
  expect((result.html.match(/class="game-answer"/g)||[]).length).toBe(3);
});

test('rich visuals remain inside the phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const html = await page.evaluate(() => window.ABVMStudyGameView.play({
    g:{supportMode:false,comebackMode:false,index:0,questions:[1],selectedIndex:null,answered:false,retry:0,lastWrong:null,score:0,streak:0,bestStreak:0,learningRow:{}},
    mode:{title:'Quick Mix'},
    q:{subject:'Math',questionType:'direct',prompt:'Use the chart.',choices:['1','2','3'],answer:'2',explanation:'Explanation.',hint:'Hint.',choiceDiagnostics:{'1':{feedback:'Try again.'},'3':{feedback:'Try again.'}},richContent:{kind:'bar-chart',label:'Votes',entries:[{label:'Apples',value:7},{label:'Bananas',value:5},{label:'Grapes',value:3}]}},
    teach:null,retryInstruction:'Use the clue.',labels:{direct:'Practice'}
  }));
  await page.locator('#app-content').evaluate((node, markup) => { node.innerHTML = '<main style="width:100%"><section class="game-question-card">'+markup+'</section></main>'; }, html);
  const box = await page.locator('.game-rich-content').boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});

test('pre-supplied rich content cannot inject information that is absent from the prompt', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
    const pack = structuredClone(envelope.pack);
    pack.contentPipeline = {
      schemaVersion:2,
      sourceHash:'rich-content-injection-test',
      skills:[{id:'theme',subject:'Reading / ELA'}],
      coverage:[],
      questions:[{
        id:'rich-injection-theme',
        subject:'Reading / ELA',
        skill:'theme',
        questionType:'reasoning',
        prompt:'A character keeps practicing after making mistakes. Which lesson best matches the story?',
        choices:['Practice can help you improve.','Never try something difficult.','Mistakes mean you should stop.'],
        answer:'Practice can help you improve.',
        explanation:'The character improves by continuing to practice.',
        hint:'Think about what the character learns.',
        sourceFact:'Controlled Grade 2 theme regression fixture',
        standards:['CCSS.RL.2.2'],
        domain:'Literature',
        dok:3,
        difficulty:2,
        richContent:{kind:'place-value',label:'Hidden answer data',number:999},
      }],
    };
    const engine = window.ABVMStudyGames;
    const catalog = engine.buildCatalog(pack, { sourceKey:'rich-content-injection-test' });
    const built = catalog.questions.find(q => q.id === 'rich-injection-theme');
    return {richContent:built?.richContent ?? null, issues:engine.validateCatalog(catalog)};
  });
  expect(result.issues).toEqual([]);
  expect(result.richContent).toBeNull();
});
