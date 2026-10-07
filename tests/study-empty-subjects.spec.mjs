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
  await expect(page.locator('[data-study-source]')).toHaveCount(0);
}
test('missing and blank subjects show honest empty notes while original game practice remains available',async({page},info)=>{
  await page.setViewportSize({width:393,height:852});
  await fixture(page,[{subject:'Math',topics:[' ',null],studyNotes:['']},{subject:'Reading / ELA'}]);
  const tiles=page.locator('.study-game-grid > .study-game-tile');
  await expect(tiles).toHaveCount(5);
  expect(await tiles.evaluateAll(nodes=>nodes.map(node=>node.dataset.gameStart))).toEqual(['reading','spelling','math','religion','mix']);
  await expect(page.locator('.game-privacy-note')).toContainText('original Grade 2 STAR-style practice');
  await expect(page.locator('.game-privacy-note')).toContainText('STAR-style practice uses original questions');
  const notes=page.locator('[data-study-notes]');
  await expect(notes).not.toHaveAttribute('open','');
  await expect(notes.locator('[data-study-notes-content]')).toBeEmpty();
  await notes.locator(':scope > summary').click();
  await expect(notes.locator('[data-study-notes-content]')).toContainText('No lesson notes are included in this selection.');
  await expect(notes.locator('.game-material-lesson')).toHaveCount(0);
  await expect(page.locator('.study-game-grid [data-game-start="math"]')).toBeEnabled();
  await expect.poll(()=>notes.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  const disabled=tiles.filter({hasText:'Not ready yet'});
  for(const tile of await disabled.all()){
    await expect(tile).toBeDisabled();await expect(tile.locator(':scope > b')).toBeHidden();
    expect(await tile.locator('.study-game-copy em').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  }
  await expect(page.locator('[data-game-start="reading"]')).toBeEnabled();
  const path=info.outputPath('games-empty-saved-iphone.png');
  await page.screenshot({animations:"disabled",path,fullPage:true});await info.attach('Empty saved bank with disabled games',{path,contentType:'image/png'});
});
test('teacher notes remain the explicit lesson content when notes arrive',async({page})=>{
  await fixture(page,[{subject:'Math',topics:['Compare three-digit numbers'],studyNotes:['Start with the hundreds.']}]);
  const notes=page.locator('[data-study-notes]');
  await expect(notes.locator('[data-study-notes-content]')).toBeEmpty();
  await notes.locator(':scope > summary').click();
  const math=notes.locator('[data-note-subject="Math"]');
  await expect(math).toBeVisible();
  await expect(math.locator('.study-note-topic li')).toHaveText(['Compare three-digit numbers']);
  await math.locator('.study-note-review > summary').click();
  await math.locator('.study-note-point > summary').click();
  await expect(math.locator('.study-note-point p')).toHaveText('Start with the hundreds.');
  const original=math.locator('.study-notes-original');
  await expect(original).not.toHaveAttribute('open','');
  await original.locator(':scope > summary').click();
  await expect(original.locator('li')).toHaveText(['Compare three-digit numbers','Start with the hundreds.']);
  await expect(original.locator('li').last()).toBeVisible();
  await expect(notes).not.toContainText('No lesson notes are included');
  expect(await math.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBeTruthy();
});

test('long Religion review lists stay optional and every original idea remains reachable by keyboard',async({page})=>{
  await page.setViewportSize({width:375,height:852});
  const ideas=Array.from({length:35},(_,i)=>`Reviewed Religion idea ${i+1}: full original wording.`);
  await fixture(page,[{subject:'Religion',topics:['Chapter 3: Jesus Lives in His Church'],studyNotes:ideas}]);
  await page.locator('[data-study-notes] > summary').click();
  const panel=page.locator('[data-note-subject="Religion"]'),review=panel.locator('.study-note-review');
  await expect(review).not.toHaveAttribute('open','');
  await expect(review.locator(':scope > summary')).toHaveText('Practice ideas35 ideas');
  await expect(review.locator('.study-note-point')).toHaveCount(35);
  await expect(review.locator('.study-note-point > summary').first()).toBeHidden();
  const summary=review.locator(':scope > summary');await summary.focus();await page.keyboard.press('Enter');
  await expect(review).toHaveAttribute('open','');
  const last=review.locator('.study-note-point').last();await expect(last.locator('p')).toBeHidden();await last.locator(':scope > summary').focus();await page.keyboard.press('Enter');
  await expect(last.locator('p')).toHaveText(ideas[34]);await expect(last.locator('p')).toBeVisible();
  const original=panel.locator('.study-notes-original');await original.locator(':scope > summary').click();
  await expect(original.locator('li')).toHaveText(['Chapter 3: Jesus Lives in His Church',...ideas]);
  expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
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
