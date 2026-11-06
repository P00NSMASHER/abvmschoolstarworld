import {test,expect} from '@playwright/test';
import {renderTestWorksheet} from '../pages/test-study-pair.mjs';

// Synthetic items; no copied school questions, handwriting or learner answers.
const makeGuide=(subject,label,optionCount,count)=>({
  subject,label,date:'2026-11-04',sourceLabel:'Reviewed original-grade-2 skills',
  facts:['A verified lesson skill was reviewed.'],warnings:[],
  practice:Array.from({length:count},(_,i)=>({
    id:'new-original-'+i,skill:subject==='Math'?'place-value':'common-proper-nouns',
    prompt:'Which original example matches the learning goal for item '+(i+1)+'?',
    choices:Array.from({length:optionCount},(_,j)=>'Original choice '+String.fromCharCode(65+j)),
    answer:'Original choice B',explanation:'For adults: explanation of a checked skill.',
  })),
});

for(const [name,guide,options,count] of [
  ['genuine ELA noun assessment',makeGuide('Reading / ELA','Grammar (Common & Proper Nouns)',3,10),3,6],
  ['teacher-marked publisher Math Chapter 2 practice',makeGuide('Math','Math (Ch. 2)',4,16),4,6],
]){
  test(name+' renders checked bubble responses and protects parent key on real browsers',async({page},info)=>{
    await page.setContent(renderTestWorksheet(guide),{waitUntil:'load'});
    const paper=page.locator('main.student-test.teacher-bubble-choice');
    await expect(paper).toHaveCount(1);
    await expect(paper.locator('.teacher-bubble-choice-item')).toHaveCount(count);
    await expect(paper.locator('.teacher-bubble-mark')).toHaveCount(count*options);
    await expect(page.locator('section.adult-key h1')).toHaveText('Parent Answer Key');
    const dimensions=await page.evaluate(()=>{
      const items=[...document.querySelectorAll('.teacher-bubble-choice-item')];
      return {
        viewport:document.documentElement.clientWidth,
        width:document.documentElement.scrollWidth,
        visible:items.every(x=>x.getBoundingClientRect().width>90 && x.getBoundingClientRect().height>25),
        hiddenKey:!document.querySelector('main.student-test').textContent.includes('For adults: explanation'),
        hasAdultKey:document.querySelector('section.adult-key').textContent.includes('For adults: explanation'),
      };
    });
    expect(dimensions.visible).toBe(true);
    expect(dimensions.hiddenKey).toBe(true);
    expect(dimensions.hasAdultKey).toBe(true);
    if(info.project.name!=='desktop')expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport+2);
    await info.attach('teacher-prep-v2-'+options+'-choice.png',{
      body:await page.screenshot({fullPage:true}),contentType:'image/png'
    });
  });
  test(name+' prints 2-column Letter PDF with separate key',async({page},info)=>{
    test.skip(info.project.name==='iphone-webkit','Physical PDF export is not implemented by WebKit Playwright');
    await page.setContent(renderTestWorksheet(guide),{waitUntil:'load'});
    await page.emulateMedia({media:'print'});
    const style=await page.evaluate(()=>({
      columns:getComputedStyle(document.querySelector('.teacher-bubble-choice-problems')).columnCount,
      breakBefore:getComputedStyle(document.querySelector('.adult-key')).breakBefore,
    }));
    expect(style.columns).toBe('2');
    expect(['page','always','left','right']).toContain(style.breakBefore);
    const pdf=await page.pdf({format:'Letter',printBackground:false});
    expect(pdf.subarray(0,5).toString('ascii')).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(4500);
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
    await info.attach('teacher-prep-v2-'+options+'-choice.pdf',{body:pdf,contentType:'application/pdf'});
  });
}


test('heterogeneous actual source practice keeps teacher bubbles and generic response forms',async({page})=>{
  const guide=makeGuide('Reading / ELA','Grammar (Common & Proper Nouns)',3,2);
  guide.practice[1].choices.push('Original choice D');
  await page.setContent(renderTestWorksheet(guide),{waitUntil:'load'});
  await expect(page.locator('main.student-test .teacher-bubble-choice-item')).toHaveCount(1);
  await expect(page.locator('main.student-test .pick-problem')).toHaveCount(1);
  await expect(page.locator('main.student-test .format-evidence')).toContainText('1 of 2 items');
  await expect(page.locator('main.student-test .teacher-bubble-mark')).toHaveCount(3);
  await expect(page.locator('main.student-test .choice')).toHaveCount(4);
  await expect(page.locator('section.adult-key .key-list li')).toHaveCount(2);
});

test('combined spelling and handwriting keeps every assigned word on the key and numbered primary lines on the paper',async({page},info)=>{
  const words=['chop','place','catch','badge','shape','trash','phone','seven','that',"isn't",'sting','early','thin','bring','while'];
  const html=renderTestWorksheet({label:'Spelling (consonant digraphs) / Handwriting',subject:'Spelling / Handwriting',spellingWords:words});
  await page.setContent(html);
  const paper=page.locator('main.dictation-sheet');
  await expect(paper.locator('.hand-line')).toHaveCount(words.length);
  await expect(paper.locator('.dictation-item .n')).toHaveText(words.map((_,i)=>(i+1)+'.'));
  await expect(page.locator('.adult-key ol li')).toHaveText(words);
  await expect(paper).not.toContainText(/chop|badge|bonus/i);
  if(info.project.name==='iphone-webkit')return;
  await page.emulateMedia({media:'print'});
  const lines=await paper.locator('.hand-line').evaluateAll(lines=>lines.map(line=>{
    const {x,y,height}=line.getBoundingClientRect();return {x,y,height};
  }));
  expect(lines[0].height).toBeGreaterThanOrEqual(48);
  expect(lines[7].x).toBe(lines[0].x);
  expect(lines[8].x).toBeGreaterThan(lines[0].x+100);
  expect(lines[8].y).toBe(lines[0].y);
  const pdf=await page.pdf({format:'Letter'});
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
});
