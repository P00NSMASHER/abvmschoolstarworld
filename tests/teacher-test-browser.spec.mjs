import {test, expect} from '@playwright/test';
import {renderTestWorksheet, renderTestStudyGuide} from '../pages/test-study-pair.mjs';

// Entirely synthetic educational questions. No actual test wording or student work.
const makeGuide=()=>({
  label:'Religion Ch. 4',subject:'Religion',date:'2026-11-04',
  facts:['Reviewed Grade 2 lesson content.'],
  sourceLabel:'Original practice — not a reproduction of a school test',
  warnings:[],practice:Array.from({length:20},(_,n)=>({
    id:'synthetic-'+(n+1),skill:'practice-'+(n+1),
    prompt:'Which reviewed idea matches this new example '+(n+1)+'?',
    choices:['First new idea','Second new idea','Third new idea'],
    answer:'Second new idea',explanation:'A separate adult explanation.',
  })),
});
test('teacher-style worksheet renders six letter-choice questions on mobile and desktop',async({page},testInfo)=>{
  const html=renderTestWorksheet(makeGuide());
  await page.setContent(html,{waitUntil:'load'});
  await expect(page.locator('main.student-test.teacher-letter-choice')).toHaveCount(1);
  await expect(page.locator('main.student-test .teacher-letter-choice-item')).toHaveCount(6);
  await expect(page.locator('main.student-test .teacher-choice-row')).toHaveCount(18);
  await expect(page.locator('main.student-test .teacher-answer-blank')).toHaveCount(6);
  await expect(page.locator('section.adult-key h1')).toHaveText('Parent Answer Key');
  const screen=await page.evaluate(()=>{
    const student=document.querySelector('main.student-test');
    const key=document.querySelector('section.adult-key');
    const problems=[...student.querySelectorAll('.teacher-letter-choice-item')];
    const first=problems[0].getBoundingClientRect();
    const answer=problems[0].querySelector('.teacher-answer-blank').getBoundingClientRect();
    return {
      viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,
      visible:problems.every(el=>{
        const box=el.getBoundingClientRect();
        return box.width>80 && box.height>20 && getComputedStyle(el).display!=='none';
      }),
      firstWidth:first.width,answerWidth:answer.width,
      studentHasKey:student.textContent.includes('A separate adult explanation'),
      parentHasKey:key.textContent.includes('A separate adult explanation'),
      labels:problems[0].querySelectorAll('.teacher-choice-letter').length,
    };
  });
  expect(screen.visible).toBe(true);
  expect(screen.answerWidth).toBeGreaterThan(14);
  expect(screen.labels).toBe(3);
  expect(screen.studentHasKey).toBe(false);
  expect(screen.parentHasKey).toBe(true);
  if(testInfo.project.name!=='desktop'){
    expect(screen.documentWidth,'horizontal overflow at '+screen.viewport+'px').toBeLessThanOrEqual(screen.viewport+2);
  }
  await testInfo.attach('synthetic-teacher-format-browser.png',{
    body:await page.screenshot({fullPage:true}),contentType:'image/png'});
});
test('real Chromium print media keeps two columns and a separate answer key',async({page},testInfo)=>{
  test.skip(testInfo.project.name==='iphone-webkit','PDF export is Chromium-only; WebKit runs actual mobile-render test');
  await page.setContent(renderTestWorksheet(makeGuide()),{waitUntil:'load'});
  await page.emulateMedia({media:'print'});
  const print=await page.evaluate(()=>{
    const problems=document.querySelector('.teacher-letter-choice-problems');
    const parent=document.querySelector('section.adult-key');
    return {columnCount:getComputedStyle(problems).columnCount,
      parentBreak:getComputedStyle(parent).breakBefore,
      studentCount:problems.querySelectorAll('li.teacher-letter-choice-item').length,
    };
  });
  expect(print.columnCount).toBe('2');
  expect(print.studentCount).toBe(6);
  expect(['page','always','left','right']).toContain(print.parentBreak);
  const pdf=await page.pdf({format:'Letter',printBackground:false});
  expect(pdf.subarray(0,5).toString('ascii')).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5_000);
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  await testInfo.attach('synthetic-teacher-format-letter.pdf',{body:pdf,contentType:'application/pdf'});
});
test('actual browser displays historical test format as example, never a forecast',async({page})=>{
  await page.setContent(renderTestStudyGuide(makeGuide()),{waitUntil:'load'});
  const details=page.locator('details.guide-source');
  await details.locator('summary').click();
  const marker=details.locator('p').filter({hasText:'Previous actual test format'});
  await expect(marker).toHaveCount(1);
  await expect(marker).toContainText('example only');
  await expect(marker).toContainText('not a guarantee');
});
