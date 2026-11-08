import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

// Synthetic question text; the real teacher's tests and student data stay out of QA.
test('mobile and desktop show true per-test coverage and launch independent Reading practice',async({page},info)=>{
  await page.goto('/#today');
  await page.evaluate(async()=>{
    const [{createStudyMaterials},{createMaterialsView}]=await Promise.all([
      import('./study-materials.mjs'),
      import('./study-games-materials-view.mjs?v=20'),
    ]);
    const make=(id,subject,skill,tier='material')=>({
      id,subject,skill,tier,prompt:'Synthetic reviewed '+id+'?',
      choices:['Correct','Incorrect'],answer:'Correct',
      explanation:'Reviewed classroom concept',hint:'Think about the lesson.',
    });
    const questions=[
      ...Array.from({length:9},(_,i)=>make('reading-'+i,'Reading / ELA','text-evidence')),
      ...Array.from({length:8},(_,i)=>make('nouns-'+i,'Reading / ELA','singular-plural-nouns')),
      ...Array.from({length:8},(_,i)=>make('blends-'+i,'Spelling / Handwriting','three-letter-blends')),
      make('star','Reading / ELA','general-star','star-fallback'),
    ];
    const events=[
      {date:'2026-11-11',label:'Reading',kind:'test'},
      {date:'2026-11-12',label:'Grammar (singular & plural nouns)',kind:'test'},
      {date:'2026-11-13',label:'Spelling (3 letter blends) / Handwriting',kind:'test'},
    ];
    const model=createStudyMaterials({now:()=> '2026-11-08T22:00:00Z',events,catalog:{sourceKey:'synthetic',questions}});
    const host=document.createElement('section');
    host.className='games-screen';
    document.body.replaceChildren(host);
    const view=createMaterialsView({
      win:window,
      onGeneralReading:()=>{const round=model.generalReadingRound({seed:'browser'});window.__generalReadingResult=round.questions.map(q=>({id:q.id,subject:q.subject}));},
      onChange:()=>{host.innerHTML=view.priorityHtml({loading:false});view.bind(host);}
    });
    view.setModel(model);
    host.innerHTML=view.priorityHtml({loading:false});
    view.bind(host);
  });
  await expect(page.locator('[data-test-coverage]')).toContainText('0 matching questions');
  await expect(page.locator('[data-general-reading]')).toContainText('8 general Reading questions');
  await expect(page.locator('[data-test-single]')).toBeDisabled();
  await expect(page.locator('[data-test-select]')).toContainText(['0 matching questions','8 matching questions','8 matching questions']);
  await expect(page.locator('.prep-reading-alternative')).toContainText('not confirmed test questions');
  expect(await page.locator('.games-screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({animations:'disabled',path:info.outputPath('phase1-coverage-'+info.project.name+'.png')});
  await page.locator('[data-general-reading]').click();
  const practiced=await page.evaluate(()=>window.__generalReadingResult);
  expect(practiced).toHaveLength(8);
  expect(practiced.every(q=>q.id.startsWith('reading-')&&q.subject==='Reading / ELA')).toBe(true);
  await page.locator('[data-test-select="1"]').click();
  await expect(page.locator('[data-test-coverage]')).toContainText('8 matching questions');
  await expect(page.locator('[data-general-reading]')).toHaveCount(0);
  await expect(page.locator('[data-test-single]')).toBeEnabled();
});
