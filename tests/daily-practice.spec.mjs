import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('the simplified Study menu provides five accessible subjects without a competing daily CTA',async({page},info)=>{
  for(const width of [320,393,820]){
    await page.setViewportSize({width,height:852});await page.goto('/#study');await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
    const tiles=page.locator('.study-game-grid > .study-game-tile');await expect(tiles).toHaveCount(5);await expect(page.locator('[data-game-start="daily"]')).toHaveCount(0);
    for(const tile of await tiles.all())expect((await tile.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.evaluate(()=>document.documentElement.style.fontSize='34px');expect(await page.locator('.screen').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await page.evaluate(()=>document.documentElement.style.fontSize='');
  }
  await page.screenshot({path:info.outputPath('study-subjects-iphone.png')});
});
test('daily review engine retains due-skill scheduling through presentation simplification',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('abvm-study-learning:v2',JSON.stringify({'place-value':{LastSeenAt:Date.now()-3*86400000}})));
  await page.goto('/#study');await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  const round=await page.evaluate(async()=>{
    const envelope=await fetch('./data/study-pack-runtime.json').then(r=>r.json()),engine=window.ABVMStudyGames;
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)});
    return engine.selectDailyQuestions(catalog,{count:8,seed:'scheduled-review-regression',skillStats:engine.loadLearning(),pack:envelope.pack});
  });
  expect(round).toHaveLength(8);expect(round[0].skill).toBe('place-value');expect(new Set(round.map(q=>q.id)).size).toBe(8);
});
test('complete a mixed round and persist review scheduling without publishing answers',async({page})=>{
  await page.goto('/#study');await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');await page.locator('[data-game-start="mix"]').click();
  for(let i=0;i<12;i++){
    if(await page.locator('.game-finish').count())break;
    const prompt=await page.locator('.game-question-card > h2').textContent();
    const answer=await page.evaluate(async prompt=>{
      const [data,work,archive]=await Promise.all(['study-pack-runtime.json','schoolwork.json','study-archive.json'].map(n=>fetch('./data/'+n).then(r=>r.json()))),engine=window.ABVMStudyGames;
      const {buildStarBank}=await import('./star-practice.mjs');
      return [...engine.buildCatalog(data.pack,{sourceKey:engine.sourceKeyFromEnvelope(data.pack,data)}).questions,...work.lessons.flatMap(l=>l.questions),...archive.questions,...buildStarBank()].find(q=>q.prompt===prompt)?.answer;
    },prompt);
    expect(answer).toBeTruthy();const choices=await page.locator('.game-answer strong').allTextContents();expect(choices.indexOf(answer)).toBeGreaterThanOrEqual(0);await page.locator('.game-answer').nth(choices.indexOf(answer)).click();await expect(page.locator('.game-feedback.correct')).toBeVisible();await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));expect(JSON.parse(before)).toBeTruthy();
  expect(Object.values(JSON.parse(before)).filter(r=>r.Review).length).toBeGreaterThan(0);await page.reload();await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(5);expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);
});
test('corrupt local learning cannot prevent mixed practice from loading',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('abvm-study-learning:v2','broken json'));await page.goto('/#study');await page.locator('[data-game-start="mix"]').click();await expect(page.locator('.game-question-card')).toBeVisible();
});
