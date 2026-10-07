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
  await page.screenshot({animations:"disabled",path:testInfo.outputPath('games-weekly-test-prep.png'),fullPage:true});
}

test('weekly test prep covers same-day subjects in the existing player and completion persists',async({page},testInfo)=>{
  const [archive,work]=await Promise.all([
    page.request.get('/data/study-archive.json').then(response=>response.json()),
    page.request.get('/data/schoolwork.json').then(response=>response.json())
  ]);
  // Oct 4 belongs to the Sep 28–Oct 4 school week. The reviewed Math bank
  // can grow when a newly governed current family is published. Strict test prep
  // may use that current material plus the dated archive, but never STAR fallback.
  const archivedMath=archive.questions.filter(q=>q.subject==='Math'&&q.provenance.some(source=>source.capturedAt==='2026-09-29'));
  const religion=work.lessons.filter(lesson=>lesson.subject==='Religion'&&lesson.chapter===2)
    .flatMap(lesson=>lesson.questions).filter(q=>q.skill==='religion-chapter-2');
  expect(archivedMath).toHaveLength(3);expect(religion).toHaveLength(10);
  await mount(page,'2026-10-04',testInfo);
  const currentMath=await page.evaluate(async()=>{
    const envelope=await fetch('./data/study-pack-runtime.json',{cache:'no-store'}).then(response=>response.json());
    const sourceKey=window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack,envelope);
    return window.ABVMStudyGames.buildCatalog(envelope.pack,{sourceKey}).questions
      .filter(q=>q.subject==='Math'&&q.tier==='material');
  });
  const dedupe=rows=>[...new Map(rows.map(q=>[q.prompt+'|'+q.answer,q])).values()];
  const allowed={Math:dedupe([...currentMath,...archivedMath]),Religion:religion};
  await page.locator('[data-open-prep]').click();
  const prep=page.locator('[data-study-tests]');
  await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-07');
  await expect(page.locator('[data-test-select]')).toContainText(['Math test','Religion Chapter 2 test','Math test']);
  for(const [index,subject] of [[0,'Math'],[1,'Religion']]){
    await page.locator(`[data-test-select="${index}"]`).click();
    await expect(page.locator(`[data-test-select="${index}"]`)).toHaveAttribute('aria-pressed','true');
    await expect(prep.locator('h3')).toContainText(subject);await page.locator('[data-test-single]').click();
    const seen=[];
    const total=Math.min(8,allowed[subject].length);
    for(let question=0;question<total;question++){
      await expect(page.locator('.game-question-card')).toBeVisible();
      await expect(page.locator('.game-topbar')).toContainText(`${question+1} of ${total}`);
      await expect(page.locator('.game-question-meta > span')).toHaveText(subject);
      const prompt=await page.locator('.game-question-card > h2').innerText();
      const choices=await page.locator('[data-game-answer] strong').allTextContents();
      const matches=allowed[subject].filter(q=>q.prompt===prompt&&q.choices.length===choices.length&&q.choices.every(choice=>choices.includes(choice)));
      expect(matches,'test practice must use reviewed Math or exact Religion Chapter 2, never unrelated fallback').toHaveLength(1);seen.push(prompt);
      const count=await page.locator('[data-game-answer]').count();
      for(let attempt=0;attempt<count;attempt++){
        const available=page.locator('[data-game-answer]:not(:disabled)'),before=await available.count();expect(before).toBeGreaterThan(0);
        const choice=await available.first().getAttribute('data-game-answer');await available.first().click();
        if(await page.locator('[data-game-next]').count())break;
        await expect(page.locator(`[data-game-answer="${choice}"]`)).toBeDisabled();await expect(available).toHaveCount(before-1);await expect(page.locator('.game-feedback')).toBeVisible();
      }
      await expect(page.locator('[data-game-next]')).toBeVisible();await page.locator('[data-game-next]').click();
    }
    await expect(page.locator('.game-finish')).toBeVisible();await expect(page.locator('[data-game-answer],[data-game-hint],[data-game-next],[data-game-read]')).toHaveCount(0);
    expect(new Set(seen).size).toBe(total);await page.locator('[data-game-home]').last().click();
  }
  await page.locator('[data-study-test-options] > summary').click();
  await page.locator('[data-complete-test]').click();
  await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-09');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abvm-completed-tests')).length)).toBe(2);
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await page.locator('[data-open-prep]').click();
  await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-09');
});

test('past tests roll forward and mixed practice keeps hints separate from answers',async({page},testInfo)=>{
  await mount(page,'2026-10-08',testInfo);await page.locator('[data-open-prep]').click();const prep=page.locator('[data-study-tests]');await expect(prep.locator('time')).toHaveAttribute('datetime','2026-10-09');
  await page.locator('[data-close-prep]').click();await page.locator('[data-game-start="mix"]').click();const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));
  await page.locator('[data-game-hint]').click();await expect(page.locator('.game-hint')).toBeVisible();await expect(page.locator('[data-game-next]')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);await page.locator('[data-game-home]').click();await expect(page.locator('input[type="file"]')).toHaveCount(0);
});
test('subject menu and dedicated test selection fit phone and tablet',async({page},info)=>{
  await page.goto('/#study');await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  for(const width of [390,820]){
    await page.setViewportSize({width,height:900});expect(await page.locator('.games-screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await page.locator('[data-open-prep]').click();
    const choice=page.locator('[data-test-select]').first();await expect(choice).toBeVisible();await choice.focus();await expect(choice).toBeFocused();
    expect(await page.locator('.games-screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await page.screenshot({animations:"disabled",path:info.outputPath(`study-prep-${width}.png`),fullPage:true});await page.locator('[data-close-prep]').click();await page.locator('[data-game-start="math"]').click();
    await expect(page.locator('.game-question-card')).toBeVisible();await expect(page.locator('[data-game-answer]').first()).toBeVisible();await page.screenshot({animations:"disabled",path:info.outputPath(`study-question-${width}.png`),fullPage:true});await page.locator('[data-game-home]').click();
  }
});
test('current material is exhausted before saved learning and STAR fallback in the player',async({page})=>{
  test.setTimeout(60000);await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
  const envelope=await (await page.request.get('/data/study-pack.json')).json(),work=await (await page.request.get('/data/schoolwork.json')).json();
  const lesson=work.lessons.find(row=>row.subject==='Math'&&!row.studiedOn&&row.questions.length>=8);expect(lesson).toBeTruthy();
  const fixture=structuredClone(envelope);
  for(const key of ['contentPipeline','recentReviewPipeline'])fixture.pack[key]={...fixture.pack[key],skills:(fixture.pack[key]?.skills||[]).filter(row=>row.subject!=='Math'),questions:(fixture.pack[key]?.questions||[]).filter(row=>row.subject!=='Math')};
  fixture.pack.questions=(fixture.pack.questions||[]).filter(q=>q.subject!=='Math');
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:fixture}));
  let saved=true;await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{...work,lessons:saved?[lesson]:[]}}));await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{questions:[],notes:[],vocabulary:[]}}));
  await page.goto('/#study');await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await page.locator('[data-game-start="math"]').click();
  for(let i=0;i<8;i++){
    await expect(page.locator('.game-topbar')).toContainText(`${i+1} of 8`);const prompt=await page.locator('.game-question-card > h2').innerText();
    const q=lesson.questions.find(q=>q.prompt===prompt);expect(q,'saved worksheet is used before STAR when current material is absent').toBeTruthy();
    const choices=await page.locator('[data-game-answer] strong').allTextContents();await page.locator('[data-game-answer]').nth(choices.indexOf(q.answer)).click();await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();saved=false;await page.reload();await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');await page.locator('[data-game-start="math"]').click();
  await expect(page.locator('.game-question-meta')).toContainText('STAR-style practice');
  const prompt=await page.locator('.game-question-card > h2').innerText();
  expect(lesson.questions.some(q=>q.prompt===prompt)).toBe(false);
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
  await page.locator('[data-notes-subject]').filter({hasText:/^Religion$/}).click();
  await expect(religion).toBeVisible();
  const review=religion.locator('[data-religion-review]');
  await expect(review).toHaveAttribute('href',chapter.url);
  await expect(review).toHaveText('Chapter 2 online review');
  await expect(review).toHaveAttribute('target','_blank');
  await expect(review).toHaveAttribute('rel',/noopener/);
  await expect(review).toBeVisible();
  const spelling=page.locator('[data-note-subject="Spelling / Handwriting"]');
  await page.locator('[data-notes-subject]').filter({hasText:/^Spelling \/ Handwriting$/}).click();
  await expect(religion).toBeHidden();
  await expect(spelling.locator('.game-note-warning')).toContainText('Spelling (short i / long i) (2026-10-09)');
  await expect(spelling.locator('.game-note-warning')).toContainText('earlier vowel pattern');
  await expect(spelling.locator('.game-note-warning')).toContainText('do not establish test coverage');
  await page.locator('[data-notes-subject]').filter({hasText:/^Religion$/}).click();
  await page.locator('[data-study-notes] > summary').click();
  await expect(page.locator('[data-study-notes]')).not.toHaveAttribute('open','');
  await expect(review).not.toBeVisible();
  expect(await review.evaluate(el=>el.getClientRects().length),'closed nested notes leave no rendered religion link').toBe(0);
  await expect(page.getByRole('link',{name:'Chapter 2 online review',exact:true})).toHaveCount(0);
  expect(await review.evaluate(el=>{el.focus();return document.activeElement===el;}),'closed nested notes cannot receive focus').toBe(false);
  await page.locator('[data-study-notes] > summary').click();
  await expect(review).toBeVisible();
});

test('current notes and cumulative reviewed schoolwork remain separately available',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
  const work=await (await page.request.get('/data/schoolwork.json')).json();
  const lesson=work.lessons.find(row=>!row.studiedOn&&row.notes?.length);expect(lesson).toBeTruthy();
  await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{...work,lessons:[lesson]}}));
  await page.goto('/#study');await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await page.locator('[data-study-notes] > summary').click();
  await expect(page.locator('[data-notes-source="weekly"]')).toHaveAttribute('aria-pressed','true');
  const notes=page.locator('[data-study-notes-content]');await expect(notes).not.toContainText(lesson.title);
  await page.locator('[data-notes-source="saved"]').click();await expect(page.locator('[data-notes-source="saved"]')).toHaveAttribute('aria-pressed','true');
  await expect(notes).toContainText('Undated schoolwork');
  await page.locator('[data-notes-subject]').filter({hasText:new RegExp('^'+lesson.subject.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
  const reviewed=notes.locator('.game-material-lesson').filter({hasText:lesson.title});await reviewed.locator(':scope > summary').click();
  await expect(reviewed.locator('li')).toHaveText(lesson.notes);
  await page.locator('[data-notes-source="weekly"]').click();await expect(notes).not.toContainText(lesson.title);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});
