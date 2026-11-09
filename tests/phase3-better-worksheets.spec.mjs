import {test,expect} from '@playwright/test';
import {renderTestWorksheet} from '../pages/test-study-pair.mjs';
const items=['Baptism','Grace','Holy Spirit'].map((answer,i)=>({
  id:'synthetic-'+i,skill:'reviewed-lesson',prompt:'Which idea explains original lesson example '+(i+1)+'?',
  choices:['Other answer',answer,'Different answer'],answer,
  explanation:'Parent explanation for '+answer,
}));
const guide={label:'Religion Chapter 1',subject:'Religion',date:'2026-11-09',practice:items,
  warnings:[],sourceLabel:'Original home practice'};
test('word-bank worksheet remains printable, readable, and segregates its parent answers',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await page.setContent(renderTestWorksheet(guide),{waitUntil:'load'});
  await expect(page.locator('main.student-test .teacher-word-bank li')).toHaveCount(3);
  await expect(page.locator('main.student-test .word-bank-item')).toHaveCount(3);
  await expect(page.locator('section.adult-key .key-list li')).toHaveCount(3);
  expect(await page.locator('main.student-test').innerText()).not.toContain('Parent explanation');
  expect(await page.locator('section.adult-key').innerText()).toContain('Parent explanation');
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(392);
  await page.emulateMedia({media:'print'});
  const properties=await page.locator('section.adult-key').evaluate(el=>({
    breakBefore:getComputedStyle(el).breakBefore,
    wordBankVisible:getComputedStyle(document.querySelector('.teacher-word-bank')).display,
  }));
  expect(['page','always','left','right']).toContain(properties.breakBefore);
  expect(properties.wordBankVisible).not.toBe('none');
  if(testInfo.project.name!=='iphone-webkit'){
    const pdf=await page.pdf({format:'Letter',printBackground:false});
    expect(pdf.subarray(0,5).toString('ascii')).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
    await testInfo.attach('phase3-original-word-bank.pdf',{body:pdf,contentType:'application/pdf'});
  }
});
