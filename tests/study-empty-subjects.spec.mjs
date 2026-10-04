import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
async function fixture(page,subjects=[]){
  const data=await(await page.request.get('/data/study-pack.json')).json();
  data.pack.subjects=subjects;data.pack.vocabulary=[];
  await page.route('**/data/study-pack-runtime.json*',r=>r.fulfill({json:data}));
  await page.goto('/#study');await expect(page.locator('.study-screen')).toBeVisible();
}
test('all six empty subjects have an original lesson and answer, including missing and blank fields',async({page})=>{
  await fixture(page,[{subject:'Math',topics:[' ',null],studyNotes:['']}]);
  for(const id of ['religion','reading','math','spelling','sight','vocabulary']){
    const card=page.locator('#study-'+id);await card.locator(':scope > summary').click();
    await expect(card.locator('.subject-practice li').first()).toBeVisible();
    await expect(card.locator('.practice-source-note')).toContainText('not a teacher assignment');
    await card.locator('.practice-answer summary').click();
    await expect(card.locator('.practice-answer p')).toBeVisible();
    expect(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBeTruthy();
  }
  await expect(page.locator('#study-religion .practice-origin')).toHaveText('Reading enrichment');
});
test('teacher notes stay primary and fallback disappears when notes arrive',async({page})=>{
  await fixture(page,[{subject:'Math',topics:['Compare three-digit numbers'],studyNotes:['Start with the hundreds.']}]);
  await page.locator('#study-math > summary').click();
  await expect(page.locator('#study-math')).toContainText('Start with the hundreds.');
  await expect(page.locator('#study-math .subject-practice')).toHaveCount(0);
});
test('empty Math opens a playable eight-question round directly',async({page})=>{
  await fixture(page);
  await page.locator('#study-math > summary').click();
  await page.getByRole('button',{name:'Practice with Math Dash'}).click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  await expect(page.locator('.game-answer')).toHaveCount(3);
  await expect(page.locator('.game-progress')).toContainText('8');
});
test('all fallback place-value variants name a present digit and correct value',async({page})=>{
  await page.goto('/#games');await expect(page.locator('.study-game-grid')).toBeVisible();
  const rows=await page.evaluate(()=>['fallback-check-a','fallback-check-b'].map(sourceKey=>{
    const c=window.ABVMStudyGames.buildCatalog({subjects:[],contentPipeline:{skills:[]}},{sourceKey});
    return c.questions.find(q=>q.id.startsWith('star-math-place'));
  }));
  for(const q of rows){const number=Number(q.prompt.match(/number (\d+)/)[1]);expect(Math.floor(number/10)%10).toBe(6);expect(q.answer).toBe('60');}
});
