import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {openNoteSubject} from './helpers/study-notes.mjs';
test.use({serviceWorkers:'block'});

async function study(page,width=390){
 await page.clock.setFixedTime(new Date('2026-10-16T12:00:00-04:00'));
 await page.setViewportSize({width,height:width>=700?1180:852});
 await page.goto('/#study');
 await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state',/ready|partial/,{timeout:15000});
 const notes=page.locator('[data-study-notes]');
 if(!await notes.evaluate(node=>node.open))await notes.locator(':scope > summary').click();
 await expect(notes).toHaveAttribute('open','');
}
async function capture(page,info,name){
 const path=info.outputPath(name+'.png');await page.screenshot({path,animations:'disabled'});await info.attach(name,{path,contentType:'image/png'});
}
test('notes library has one clear subject drill-in and keyboard return, leaving print/history intact',async({page})=>{
 await study(page);
 const notes=page.locator('[data-study-notes]'),history=page.locator('[data-study-test-options]');
 const historyBefore=await history.innerHTML();
 await expect(notes.locator('.notes-subject-browser')).toBeVisible();
 await expect(notes.locator('.notes-reader')).toBeHidden();
 const first=notes.locator('[data-notes-subject]').first(),name=await first.getAttribute('aria-label');
 await first.focus();await page.keyboard.press('Enter');
 await expect(notes.locator('[data-note-subject]:not([hidden]) h3')).toHaveText(name);
 await expect(notes.locator('[data-note-subject]:not([hidden]) h3')).toBeFocused();
 await notes.locator('[data-notes-back]').focus();await page.keyboard.press('Enter');
 await expect(notes.locator('.notes-subject-browser')).toBeVisible();await expect(first).toBeFocused();
 expect(await history.innerHTML()).toBe(historyBefore);
 await history.locator(':scope > summary').click();await expect(history.locator('[data-test-guide]').first()).toBeVisible();
});
test('search reaches notes, words and saved work without losing typed text, caret or accurate scope',async({page})=>{
 await study(page);
 const notes=page.locator('[data-study-notes]'),search=notes.getByRole('searchbox',{name:'Search study notes'});
 await search.fill('short vowels');await expect(search).toBeFocused();await expect(search).toHaveValue('short vowels');
 await expect(notes.locator('.notes-search-status')).not.toContainText('0 matches');
 await openNoteSubject(page,'Reading / ELA');
 await expect(notes.locator('[data-note-subject]:not([hidden])')).toContainText(/short vowels/i);
 await search.fill('unmatched QA phrase 93427');await expect(search).toBeFocused();await expect(notes.locator('.study-tools-empty')).toContainText('No matching notes');
 await notes.getByRole('button',{name:'Clear note search',exact:true}).click();await expect(search).toBeFocused();await expect(search).toHaveValue('');
 await notes.locator('[data-notes-source=saved]').click();await expect(notes.locator('.notes-search-status')).toContainText('Undated work stays here');
 await expect(notes.locator('[data-notes-source=saved]')).toHaveAttribute('aria-pressed','true');
});
test('all class notes are directly readable without a practice-ideas panel and exact originals remain intact',async({page})=>{
 const envelope=await(await page.request.get('/data/study-pack.json')).json();
 envelope.pack.subjects=[{subject:'Math',topics:['Place value'],studyNotes:['Read the hundreds first.','Then compare tens.']}];
 envelope.pack.vocabulary=[];
 await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:envelope}));
 await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{notes:[],vocabulary:[],questions:[]}}));
 await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{lessons:[]}}));
 await study(page);
 const panel=page.locator('[data-note-subject="Math"]');
 await expect(panel.locator('.study-note-review > summary')).toHaveCount(0);
 await expect(panel).not.toContainText('Practice ideas');
 await expect(panel.locator('.study-note-point p')).toHaveText(['Read the hundreds first.','Then compare tens.']);
 await expect(panel.locator('.study-note-point p').last()).toBeVisible();
 await expect(panel.locator('.study-note-point details,.study-note-point summary')).toHaveCount(0);
 await panel.locator('.study-notes-original > summary').click();
 await expect(panel.locator('.study-notes-original li')).toHaveText(['Place value','Read the hundreds first.','Then compare tens.']);
});
test('rendered library and reader stay readable on phone, tablet and desktop including enlarged text',async({page},info)=>{
 test.setTimeout(120000);
 for(const width of [375,390,430,744,820,1024,1440]){
  await study(page,width);
  const notes=page.locator('[data-study-notes]');
  await notes.locator('.notes-library-heading').scrollIntoViewIfNeeded();
  await capture(page,info,'notes-library-'+width);
  const buttons=await notes.locator('button:visible,input:visible').evaluateAll(nodes=>nodes.map(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,scroll:el.scrollWidth,client:el.clientWidth})));
  for(const button of buttons){expect(button.height,JSON.stringify({width,button})).toBeGreaterThanOrEqual(44);expect(button.scroll).toBeLessThanOrEqual(button.client+1);}
  await openNoteSubject(page,'Reading / ELA');
  await notes.locator('[data-notes-back]').scrollIntoViewIfNeeded();await capture(page,info,'notes-reader-'+width);
  const geometry=await notes.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));expect(geometry.scroll).toBeLessThanOrEqual(geometry.client+1);
  if(width===390){
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.evaluate(()=>document.documentElement.style.fontSize=2*parseFloat(getComputedStyle(document.documentElement).fontSize)+'px');
   expect(await notes.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   await capture(page,info,'notes-reader-390-enlarged');
   const result=await new AxeBuilder({page}).include('[data-study-notes]').analyze();expect(result.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
   await page.evaluate(()=>document.documentElement.style.fontSize='');
  }
  await notes.locator('[data-notes-back]').click();
 }
});

test('words use matching disclosure styling, Math follows Spelling, and chapter/Math notes teach more than titles',async({page},info)=>{
 const envelope=await(await page.request.get('/data/study-pack-runtime.json')).json();
 envelope.pack.subjects=[
  {subject:'Religion',topics:['Chapter 3: Jesus Lives in His Church','Chapter 1: Gifts'],studyNotes:['Exact original class note.']},
  {subject:'Reading / ELA',topics:['Phonics: Short vowels'],studyNotes:[]},
  {subject:'Spelling / Handwriting',topics:['Short i'],studyNotes:[]},
  {subject:'Math',topics:['Math (subtraction)'],studyNotes:[]}
 ];
 envelope.pack.vocabulary=[{subject:'Reading / ELA',term:'cat',meaning:'A small animal.'}];
 envelope.pack.testGuideFacts={religionChapters:{'3':['Faith is a gift from God.','A sacrament is a sacred sign given to the Church by Jesus.'],'1':['We care for creation.']}};
 await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:envelope}));
 await page.route('**/data/study-archive.json*',route=>route.fulfill({json:{notes:[],vocabulary:[],questions:[]}}));
 await page.route('**/data/schoolwork.json*',route=>route.fulfill({json:{lessons:[]}}));
 for(const width of [390,820]){
  await study(page,width);
  const notes=page.locator('[data-study-notes]');
  expect(await notes.locator('[data-notes-subject]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))).toEqual(['Reading / ELA','Spelling / Handwriting','Math','Religion']);
  await openNoteSubject(page,'Reading / ELA');
  const panel=notes.locator('[data-note-subject]:not([hidden])');
  const styles=await panel.locator('.study-note-topic > summary').evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node),title=getComputedStyle(node.querySelector('strong'));return {border:s.borderRadius,padding:s.padding,font:s.fontSize,weight:title.fontWeight,background:s.backgroundColor};}));
  expect(styles).toHaveLength(2);expect(styles[0]).toEqual(styles[1]);
  await panel.locator('.study-vocabulary > summary').scrollIntoViewIfNeeded();await capture(page,info,'notes-words-'+width);
  await openNoteSubject(page,'Religion');
  const church=panel.locator('.study-note-topic').filter({hasText:'Chapter 3'});
  await expect(church).toHaveAttribute('open','');await expect(church.locator('.notes-explanation')).toContainText('Faith is a gift from God');
  await expect(church).not.toContainText('care for creation');await expect(panel.locator('.notes-explanation').first()).toBeVisible();
  await capture(page,info,'notes-religion-'+width);
  await openNoteSubject(page,'Math');
  await expect(panel.locator('.notes-worked-lesson')).toContainText('12 − 5 = 7');await expect(panel.locator('.notes-worked-lesson')).toContainText('7 + 5 = 12');
  await expect(panel.locator('.notes-worked-lesson')).toContainText('ABVM worked example');
  await capture(page,info,'notes-math-'+width);
 }
});
