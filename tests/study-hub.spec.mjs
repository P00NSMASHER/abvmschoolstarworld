import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

async function mount(page,day,testInfo){
  await page.clock.setFixedTime(new Date(day+'T16:00:00-04:00'));
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  const fixture=structuredClone(envelope);
  fixture.pack.importantDates=[
    {date:'Wednesday, Oct. 7',label:'Math test',kind:'test'},
    {date:'Wednesday, Oct. 7',label:'Religion Chapter 2 test',kind:'test'},
    {date:'Friday, Oct. 9',label:'Math test',kind:'test'}
  ];
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:fixture}));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await page.screenshot({path:testInfo.outputPath('games-weekly-test-prep.png'),fullPage:true});
}

test('weekly test prep covers same-day subjects in the existing player and completion persists',async({page},testInfo)=>{
  const [archive,work]=await Promise.all([
    page.request.get('/data/study-archive.json').then(response=>response.json()),
    page.request.get('/data/schoolwork.json').then(response=>response.json())
  ]);
  // Oct 4 belongs to the Sep 28–Oct 4 school week. Its actual Math archive
  // contains three questions; strict prep gives both test banks that quota.
  const allowed={
    Math:archive.questions.filter(q=>q.subject==='Math'&&q.provenance.some(source=>source.capturedAt==='2026-09-29')),
    Religion:work.lessons.filter(lesson=>lesson.subject==='Religion'&&lesson.chapter===2)
      .flatMap(lesson=>lesson.questions).filter(q=>q.skill==='religion-chapter-2')
  };
  expect(allowed.Math).toHaveLength(3);expect(allowed.Religion).toHaveLength(10);
  const quota=3,total=quota*2;
  await mount(page,'2026-10-04',testInfo);
  const prep=page.locator('[data-study-tests]');
  await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-07');
  await expect(prep.locator('time')).toContainText(/Oct(?:ober)?\.? 7/);
  await expect(prep).toContainText('Math test');
  await expect(prep).toContainText('Religion Chapter 2 test');
  await page.locator('[data-test]').click();
  const subjects=[],seen=[];
  for(let question=0;question<total;question++){
    await expect(page.locator('.game-question-card')).toBeVisible();
    await expect(page.locator('.game-topbar > div > span')).toHaveText('Test practice');
    await expect(page.locator('.game-topbar')).toContainText(`${question+1} of ${total}`);
    const subject=await page.locator('.game-question-meta > span').innerText();subjects.push(subject);
    const prompt=await page.locator('.game-question-card > h2').innerText();
    const choices=await page.locator('[data-game-answer] strong').allTextContents();
    const matches=(allowed[subject]||[]).filter(q=>q.prompt===prompt&&q.choices.length===choices.length&&q.choices.every(choice=>choices.includes(choice)));
    expect(matches,'strict prep must use the dated Math archive or exact Religion Chapter 2 bank').toHaveLength(1);
    seen.push(subject+'|'+prompt);
    const choiceCount=await page.locator('[data-game-answer]').count();
    for(let attempt=0;attempt<choiceCount;attempt++){
      const available=page.locator('[data-game-answer]:not(:disabled)');
      const countBefore=await available.count();
      expect(countBefore).toBeGreaterThan(0);
      const answerIndex=await available.first().getAttribute('data-game-answer');
      await available.first().click();
      if(await page.locator('[data-game-next]').count())break;
      await expect(page.locator(`[data-game-answer="${answerIndex}"]`)).toBeDisabled();
      await expect(available).toHaveCount(countBefore-1);
      await expect(page.locator('.game-feedback')).toBeVisible();
    }
    await expect(page.locator('[data-game-next]')).toBeVisible();
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.game-question-card:not(.study-star-goal)')).toHaveCount(0);
  await expect(page.locator('[data-game-answer],[data-game-hint],[data-game-next],[data-game-read]')).toHaveCount(0);
  expect(subjects.filter(subject=>subject==='Math')).toHaveLength(quota);
  expect(subjects.filter(subject=>subject==='Religion')).toHaveLength(quota);
  expect(new Set(seen).size).toBe(total);
  await page.locator('[data-game-home]').last().click();
  await page.locator('[data-study-test-options] > summary').click();
  await page.locator('[data-complete-test]').click();
  await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-09');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abvm-completed-tests')).length)).toBe(2);
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-09');
});

test('past tests roll forward; saved, STAR and mixed practice use Games without an uploader',async({page},testInfo)=>{
  await mount(page,'2026-10-08',testInfo);
  const prep=page.locator('[data-study-tests]');
  await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-09');
  await expect(prep).not.toContainText('2026-10-07');
  await page.locator('[data-study-source]').selectOption('saved');
  await page.locator('[data-study-notes] > summary').click();
  await expect(page.locator('[data-study-notes]')).toContainText('Undated schoolwork');
  await page.locator('[data-study-source]').selectOption('star');
  for(const [mode,subject] of [['math','Math'],['words','Reading / ELA']]){
    await page.locator(`[data-game-start="${mode}"]`).click();
    await expect(page.locator('.game-question-meta > span')).toHaveText(subject);
    await expect(page.locator('.game-question-meta')).toContainText('STAR-style practice');
    await page.locator('[data-game-home]').click();
  }
  await page.locator('[data-study-source]').selectOption('mix');
  await page.locator('[data-study-pick="weekly"]').uncheck();
  await page.locator('[data-study-pick="saved"]').check();
  await page.locator('[data-study-pick="star"]').check();
  await page.locator('[data-game-start="quick"]').click();
  const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));
  await page.locator('[data-game-hint]').click();
  await expect(page.locator('.game-hint')).toBeVisible();
  await expect(page.locator('[data-game-next]')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);
  await page.locator('[data-game-home]').click();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(await page.locator('.games-screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});

test('Games sources and optional notes have usable phone and tablet layouts',async({page},testInfo)=>{
  await page.goto('/#study');
  const games=page.locator('.games-screen');
  await expect(games).toHaveAttribute('data-study-state','ready');
  await expect(page.locator('.hub-faith')).toHaveCount(0);
  await expect(games).not.toContainText('Dated schoolwork this week');
  for(const width of [390,820]){
    await page.setViewportSize({width,height:900});
    for(const source of ['weekly','saved','star','mix']){
      await page.locator('[data-study-source]').selectOption(source);
      await expect(page.locator('[data-study-source]')).toHaveValue(source);
      expect(await games.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      if(source==='mix'){
        const rows=await page.locator('[data-study-mix] label').evaluateAll(labels=>labels.map(label=>{
          const box=label.getBoundingClientRect(),input=label.querySelector('input').getBoundingClientRect();
          const text=label.querySelector('span').getBoundingClientRect();
          return {top:box.top,bottom:box.bottom,inputRight:input.right,textLeft:text.left,textTop:text.top,textBottom:text.bottom};
        }));
        expect(rows).toHaveLength(3);
        for(const row of rows){
          expect(row.textLeft).toBeGreaterThanOrEqual(row.inputRight);
          expect(row.textTop).toBeGreaterThanOrEqual(row.top);
          expect(row.textBottom).toBeLessThanOrEqual(row.bottom);
        }
      }
      await page.screenshot({path:testInfo.outputPath(`games-${source}-${width}.png`),fullPage:true});
    }
    await page.locator('[data-study-source]').selectOption('star');
    await page.locator('[data-game-start="math"]').click();
    await expect(page.locator('.game-question-card')).toBeVisible();
    await expect(page.locator('[data-game-answer]').first()).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`games-question-${width}.png`),fullPage:true});
    await page.locator('[data-game-home]').click();
  }
});

test('the source chooser changes real question banks and a selected mix includes both sources',async({page})=>{
  test.setTimeout(60000);
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  const work=await (await page.request.get('/data/schoolwork.json')).json();
  const archive=await (await page.request.get('/data/study-archive.json')).json();
  const lesson=work.lessons.find(row=>row.subject==='Math'&&!row.studiedOn&&row.questions.length>=8);
  expect(lesson).toBeTruthy();
  // Isolate a real undated worksheet. It must be selectable as saved learning,
  // while the current Math game truthfully uses its existing original fallback.
  const fixture=structuredClone(envelope);
  for(const key of ['contentPipeline','recentReviewPipeline']){
    fixture.pack[key]={...fixture.pack[key],
      skills:(fixture.pack[key]?.skills||[]).filter(row=>row.subject!=='Math'),
      questions:(fixture.pack[key]?.questions||[]).filter(row=>row.subject!=='Math')};
  }
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:fixture}));
  await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{...work,lessons:[lesson]}}));
  await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{...archive,questions:[],notes:[],vocabulary:[]}}));
  await page.goto('/#games');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  const star=await page.evaluate(async()=>{
    const {buildStarBank}=await import('./star-practice.mjs');
    const envelope=await fetch('./data/study-pack-runtime.json').then(response=>response.json());
    const engine=window.ABVMStudyGames;
    const sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    return [...buildStarBank(),...engine.buildCatalog(envelope.pack,{sourceKey}).questions.filter(q=>q.tier==='star-fallback')];
  });
  const savedPrompts=new Set(lesson.questions.map(q=>q.prompt));
  const starPrompts=new Set(star.map(q=>q.prompt));
  await page.locator('[data-game-start="math"]').click();
  const weeklyPrompt=await page.locator('.game-question-card > h2').innerText();
  expect(starPrompts.has(weeklyPrompt)).toBe(true);
  expect(savedPrompts.has(weeklyPrompt)).toBe(false);
  await page.locator('[data-game-home]').click();
  for(const source of ['saved','star','mix']){
    await page.locator('[data-study-source]').selectOption(source);
    if(source==='mix'){
      await page.locator('[data-study-pick="weekly"]').uncheck();
      await page.locator('[data-study-pick="saved"]').check();
      await page.locator('[data-study-pick="star"]').check();
    }
    await page.locator('[data-game-start="math"]').click();
    const seen=[];
    for(let index=0;index<8;index++){
      await expect(page.locator('.game-topbar')).toContainText(`${index+1} of 8`);
      const prompt=await page.locator('.game-question-card > h2').innerText();
      const q=[...lesson.questions,...star].find(row=>row.prompt===prompt);
      expect(q,`presented ${source} question belongs to a selected public bank`).toBeTruthy();
      const bank=savedPrompts.has(prompt)?'saved':starPrompts.has(prompt)?'star':'unknown';
      if(source!=='mix')expect(bank).toBe(source);
      seen.push(bank);
      const choices=await page.locator('[data-game-answer] strong').allTextContents();
      const answerIndex=choices.indexOf(q.answer);
      expect(answerIndex).toBeGreaterThanOrEqual(0);
      await page.locator('[data-game-answer]').nth(answerIndex).click();
      await page.locator('[data-game-next]').click();
    }
    await expect(page.locator('.game-finish')).toBeVisible();
    if(source==='mix'){
      expect(seen.filter(bank=>bank==='saved')).toHaveLength(4);
      expect(seen.filter(bank=>bank==='star')).toHaveLength(4);
    }
    await page.locator('[data-game-home]').last().click();
  }
});

test('on-demand subject notes retain the verified chapter review and disclose a spelling coverage mismatch',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  const references=await (await page.request.get('/data/religion-sources.json')).json();
  const chapter=references.chapters.find(row=>row.chapter===2&&row.status==='verified'&&row.available);
  expect(chapter).toBeTruthy();
  const fixture=structuredClone(envelope);
  fixture.pack.subjects=[
    ...fixture.pack.subjects.filter(subject=>subject.subject!=='Religion'&&!/spelling/i.test(subject.subject)),
    {subject:'Religion',topics:['Chapter 2: Jesus is God’s Best Gift'],studyNotes:['Jesus gave us the new life of grace.']},
    {subject:'Spelling / Handwriting',topics:['Spelling: short a / long a'],studyNotes:['Compare short a with a_e long-a words.']}
  ];
  fixture.pack.importantDates=[{date:'Friday, Oct. 9',label:'Spelling (short i / long i)',kind:'test'}];
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:fixture}));
  let referenceReads=0;
  await page.route('**/data/religion-sources.json*',route=>{referenceReads++;return route.fulfill({json:references});});
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  expect(referenceReads).toBe(0);
  await expect(page.locator('[data-religion-review],.game-note-warning')).toHaveCount(0);
  await page.locator('[data-study-notes] > summary').click();
  const religion=page.locator('[data-note-subject="Religion"]');
  await religion.locator(':scope > summary').click();
  const review=religion.locator('[data-religion-review]');
  await expect(review).toHaveAttribute('href',chapter.url);
  await expect(review).toHaveText('Chapter 2 online review');
  await expect(review).toHaveAttribute('target','_blank');
  await expect(review).toHaveAttribute('rel',/noopener/);
  await expect(review).toBeVisible();
  const spelling=page.locator('[data-note-subject="Spelling / Handwriting"]');
  await spelling.locator(':scope > summary').click();
  await expect(spelling.locator('.game-note-warning')).toContainText('Spelling (short i / long i) (2026-10-09)');
  await expect(spelling.locator('.game-note-warning')).toContainText('earlier vowel pattern');
  await expect(spelling.locator('.game-note-warning')).toContainText('do not establish test coverage');
  await page.locator('[data-study-source]').selectOption('star');
  await expect(page.locator('[data-religion-review],.game-note-warning')).toHaveCount(0);
});
