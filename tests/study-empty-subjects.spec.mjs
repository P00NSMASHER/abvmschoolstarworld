import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
async function fixture(page,subjects=[]){
  const data=await(await page.request.get('/data/study-pack.json')).json();
  data.pack.subjects=subjects;data.pack.vocabulary=[];
  data.pack.questions=[];
  data.pack.contentPipeline={...data.pack.contentPipeline,skills:[],questions:[]};
  data.pack.recentReviewPipeline={...data.pack.recentReviewPipeline,skills:[],questions:[]};
  await page.clock.setFixedTime(new Date('2026-10-06T13:00:00Z'));
  await page.route('**/data/study-pack-runtime.json*',r=>r.fulfill({json:data}));
  await page.route('**/data/study-archive.json*',r=>r.fulfill({json:{notes:[],vocabulary:[],questions:[]}}));
  await page.route('**/data/schoolwork.json*',r=>r.fulfill({json:{lessons:[]}}));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await expect(page.locator('[data-study-source]')).toHaveValue('weekly');
}
test('missing and blank subjects show honest empty notes while original game practice remains available',async({page},info)=>{
  await page.setViewportSize({width:393,height:852});
  await fixture(page,[{subject:'Math',topics:[' ',null],studyNotes:['']},{subject:'Reading / ELA'}]);
  const tiles=page.locator('.study-game-grid > .study-game-tile');
  await expect(tiles).toHaveCount(4);
  expect(await tiles.evaluateAll(nodes=>nodes.map(node=>node.dataset.gameStart))).toEqual(['quick','math','words','faith']);
  await expect(page.locator('.game-privacy-note')).toContainText('original Grade 2 practice');
  await expect(page.locator('.game-privacy-note')).toContainText('not copied STAR test items');
  const notes=page.locator('[data-study-notes]');
  await expect(notes).not.toHaveAttribute('open','');
  await expect(notes.locator('[data-study-notes-content]')).toBeEmpty();
  await notes.locator(':scope > summary').click();
  await expect(notes.locator('[data-study-notes-content]')).toHaveText('No lesson notes are included in this selection.');
  await expect(notes.locator('.game-material-lesson')).toHaveCount(0);
  await expect(page.locator('.study-game-grid [data-game-start="math"]')).toBeEnabled();
  expect(await notes.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBeTruthy();
  await notes.locator(':scope > summary').click();
  await page.locator('[data-study-source]').selectOption('saved');
  for(let i=0;i<4;i++)await expect(tiles.nth(i)).toBeDisabled();
  await expect(tiles).toContainText(['Not ready yet','Not ready yet','Not ready yet','Not ready yet']);
  const path=info.outputPath('games-empty-saved-iphone.png');
  await page.screenshot({path,fullPage:true});await info.attach('Empty saved bank with disabled games',{path,contentType:'image/png'});
});
test('teacher notes remain the explicit lesson content when notes arrive',async({page})=>{
  await fixture(page,[{subject:'Math',topics:['Compare three-digit numbers'],studyNotes:['Start with the hundreds.']}]);
  const notes=page.locator('[data-study-notes]');
  await expect(notes.locator('[data-study-notes-content]')).toBeEmpty();
  await notes.locator(':scope > summary').click();
  const math=notes.locator('.game-material-lesson').filter({has:page.getByText('Math',{exact:true})});
  await math.locator(':scope > summary').click();
  await expect(math.locator('li')).toHaveText(['Compare three-digit numbers','Start with the hundreds.']);
  await expect(math.locator('li').last()).toBeVisible();
  await expect(notes).not.toContainText('No lesson notes are included');
  expect(await math.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBeTruthy();
});
test('empty Math opens a playable eight-question round directly',async({page})=>{
  await fixture(page);
  await page.locator('.study-game-grid [data-game-start="math"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  await expect(page.locator('.game-answer')).toHaveCount(3);
  await expect(page.locator('.game-topbar')).toContainText('1 of 8');
  await expect(page.locator('.game-question-meta')).toContainText('STAR-style practice');
});
test('all fallback place-value variants name a present digit and correct value',async({page})=>{
  await page.goto('/#games');await expect(page.locator('.study-game-grid')).toBeVisible();
  const rows=await page.evaluate(()=>['fallback-check-a','fallback-check-b'].map(sourceKey=>{
    const c=window.ABVMStudyGames.buildCatalog({subjects:[],contentPipeline:{skills:[]}},{sourceKey});
    return c.questions.find(q=>q.id.startsWith('star-math-place'));
  }));
  for(const q of rows){const number=Number(q.prompt.match(/number (\d+)/)[1]);expect(Math.floor(number/10)%10).toBe(6);expect(q.answer).toBe('60');}
});
