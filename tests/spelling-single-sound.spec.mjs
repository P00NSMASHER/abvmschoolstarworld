import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {buildGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';

test.use({serviceWorkers:'block'});

// Freeze the observed Nov. 20 announcement so this regression remains useful
// after the live teacher page advances. All questions are existing original ABVM items.
function envelope(){
  const fixture=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
  const pack=fixture.pack;
  pack.sourceHash='single-long-a-browser-regression';
  pack.sourceCheckedAt='2026-11-16T23:32:10.126Z';
  pack.weekLabel=pack.teacherPostingWeekLabel='Week of November 16, 2026';
  pack.subjects=[{subject:'Spelling / Handwriting',topics:['Friday, Nov. 20 test focus: long a'],studyNotes:[]}];
  pack.vocabulary=[];
  pack.importantDates=[{date:'Friday, Nov. 20',label:'Spelling (long a) / Handwriting',kind:'test',source:'teacher-tests'}];
  pack.contentPipeline=buildGrade2ContentPipeline(pack,{sourceHash:pack.sourceHash});
  pack.recentReviewPipeline={skills:[],questions:[]};
  return fixture;
}

test('long-a Test Prep opens its three questions, prints them and completes a scored round',async({page},info)=>{
  const fixture=envelope();
  const allowed=fixture.pack.contentPipeline.questions.filter(q=>[
    'Which word has a long a sound because of the a_e pattern?',
    'Why does the a in “game” have a long sound?',
    'Which word uses the a_e pattern to make long a?',
  ].includes(q.prompt));
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-17T00:00:00Z'));
  await page.route('**/data/study-pack*.json*',route=>route.fulfill({json:fixture}));
  await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{notes:[],vocabulary:[],questions:[]}}));
  await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{lessons:[]}}));
  await page.goto('/#study?prep=1');
  await expect(page.locator('.games-screen[data-study-state="ready"]')).toBeVisible();
  await expect(page.locator('[data-test-coverage]')).toHaveText('3 matching questions');
  await expect(page.locator('[data-test-single]')).toBeEnabled();
  await page.screenshot({path:info.outputPath('long-a-prep-enabled.png'),fullPage:true});

  await page.locator('[data-test-worksheet]').click();
  await expect(page.locator('[data-study-guide-dialog]')).toHaveAttribute('data-guide-practice-count','3');
  const paper=page.frameLocator('.study-guide-frame');
  await expect(paper.locator('main.student-test .problem')).toHaveCount(3);
  await expect(paper.locator('section.adult-key .key-list li')).toHaveCount(3);
  await expect(paper.locator('main.student-test')).not.toContainText('Which word has the short a sound?');
  await page.locator('[data-guide-close]').click();

  await page.locator('[data-test-single]').click();
  const observed=new Set();
  for(let index=0;index<3;index++){
    await expect(page.locator('.game-topbar')).toContainText(`${index+1} of 3`);
    const prompt=await page.locator('.game-question-card > h2').innerText();
    const question=allowed.find(row=>row.prompt===prompt);
    expect(question,'every playable item must target only the announced sound').toBeTruthy();
    observed.add(prompt);
    await page.locator('[data-game-answer]').filter({has:page.locator('strong',{hasText:question.answer})}).click();
    await expect(page.locator('.game-feedback strong')).toHaveText('Correct');
    await page.locator('[data-game-next]').click();
  }
  expect(observed.size).toBe(3);
  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.game-finish')).toContainText('3 / 3');
  expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('long-a-round-complete.png'),fullPage:true});
});
