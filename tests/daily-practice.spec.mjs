import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('compact daily practice remains accessible after the four games and scales with larger text',async({page},testInfo)=>{
  for(const width of [320,393,820]){
    await page.setViewportSize({width,height:852});await page.goto('/#study');
    const card=page.locator('.game-daily-action');await expect(card).toBeVisible();
    await expect(card).toContainText('No timer');
    const button=card.locator('[data-game-start="daily"]');
    await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
    const grid=await page.locator('.study-game-grid').boundingBox();
    expect((await button.boundingBox()).y).toBeGreaterThanOrEqual(grid.y+grid.height);
    await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.evaluate(()=>document.documentElement.style.fontSize='34px');
    expect(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBeTruthy();
    await page.evaluate(()=>document.documentElement.style.fontSize='');
  }
  await page.setViewportSize({width:393,height:852});
  await page.screenshot({path:testInfo.outputPath('daily-practice-iphone.png')});
});
test('due skills still guide daily review without a Place value recommendation callout',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('abvm-study-learning:v2',JSON.stringify({'place-value':{LastSeenAt:Date.now()-3*86400000}})));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await expect(page.locator('.daily-practice,.review-skill-chip')).toHaveCount(0);
  expect(await page.locator('.games-screen').innerText()).not.toContain('Place value');
  await page.locator('[data-game-start="daily"]').click();
  await expect(page.locator('.game-topbar')).toContainText('Daily Practice');
  await expect(page.locator('.game-topbar')).toContainText('1 of 8');
  const prompt=await page.locator('.game-question-card h2').innerText();
  const skill=await page.evaluate(async text=>{
    const data=await fetch('./data/study-pack.json').then(r=>r.json());
    return window.ABVMStudyGames.buildCatalog(data.pack).questions.find(q=>q.prompt===text)?.skill;
  },prompt);
  expect(skill).toBe('place-value');
  await page.getByRole('button',{name:'Need a hint?'}).click();
  await expect(page.locator('.game-hint')).toBeVisible();
});
test('complete a daily round, persist its calm completion state, and keep all named games',async({page})=>{
  await page.goto('/#study');await page.locator('[data-game-start="daily"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  for(let i=0;i<12;i++){
    if(await page.locator('.game-finish').count())break;
    const prompt=await page.locator('.game-question-card h2').textContent();
    const answer=await page.evaluate(async prompt=>{
      const data=await fetch('./data/study-pack-runtime.json').then(r=>r.json()),e=window.ABVMStudyGames;
      return e.buildCatalog(data.pack,{sourceKey:e.sourceKeyFromEnvelope(data.pack,data)}).questions.find(q=>q.prompt===prompt)?.answer;
    },prompt);
    expect(answer).toBeTruthy();
    const index=await page.locator('.game-answer strong').evaluateAll((nodes,answer)=>nodes.findIndex(n=>n.textContent===answer),answer);
    expect(index).toBeGreaterThanOrEqual(0);await page.locator('.game-answer').nth(index).click();
    await expect(page.locator('.game-feedback.correct')).toBeVisible();await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await page.getByRole('button',{name:'Study',exact:true}).click();
  await expect(page.locator('.game-daily-action')).toContainText('Today’s practice is complete');
  await page.reload();await expect(page.locator('.game-daily-action')).toContainText('Today’s practice is complete');
  const schedules=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('abvm-study-learning:v2'))).filter(r=>r.Review));expect(schedules.length).toBeGreaterThan(0);
  await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
  for(const label of ['Math Dash','Word Power','Faith Quest','Quick Mix'])await expect(page.getByRole('button',{name:new RegExp(label)})).toBeVisible();
});
test('corrupt progress cannot prevent Study or daily practice from loading',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('abvm-study-learning:v2','broken json'));
  await page.goto('/#study');await page.locator('[data-game-start="daily"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
});
