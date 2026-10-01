import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
});

test('catalog adds validated non-answer-leaking rich formats to appropriate questions', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
    const engine = window.ABVMStudyGames;
    const sourceKey = engine.sourceKeyFromEnvelope(envelope.pack, envelope);
    const catalog = engine.buildCatalog(envelope.pack, { sourceKey });
    const rich = catalog.questions.filter(q => q.richContent).map(q => ({
      skill:q.skill, kind:q.richContent.kind, rich:q.richContent, prompt:q.prompt, answer:q.answer
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
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
    const engine = window.ABVMStudyGames;
    const catalog = engine.buildCatalog(envelope.pack, { sourceKey:engine.sourceKeyFromEnvelope(envelope.pack, envelope) });
    const q = catalog.questions.find(item => item.richContent?.kind === 'place-value');
    if (!q) throw new Error('Expected a place-value rich question');
    const html = window.ABVMStudyGameView.play({
      g:{supportMode:false,comebackMode:false,index:0,questions:[q],selectedIndex:null,answered:false,retry:0,lastWrong:null,score:0,streak:0,bestStreak:0,learningRow:{}},
      mode:{title:'Quick Mix'},q,teach:null,retryInstruction:'Use the clue.',labels:{direct:'Practice',transfer:'Practice',reasoning:'Practice'}
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
    const pack = JSON.parse(JSON.stringify(envelope.pack));
    const target = pack.contentPipeline.questions.find(q => q.skill === 'sentence-types');
    if (!target) throw new Error('Expected sentence-types pipeline question');
    target.richContent = {kind:'place-value',label:'Hidden answer data',number:999};
    const engine = window.ABVMStudyGames;
    const catalog = engine.buildCatalog(pack, { sourceKey:'rich-content-injection-test' });
    const built = catalog.questions.find(q => q.id === target.id);
    return {richContent:built?.richContent ?? null, issues:engine.validateCatalog(catalog)};
  });
  expect(result.issues).toEqual([]);
  expect(result.richContent).toBeNull();
});
