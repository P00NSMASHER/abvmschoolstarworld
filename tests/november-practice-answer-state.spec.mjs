import {test,expect} from '@playwright/test';

test('Math answers survive paper switching and reload, and clearing counts as blank',async({page},testInfo)=>{
  await page.goto('/november-practice-tests.html');
  const answer=page.getByRole('textbox',{name:'Answer to question 1',exact:true});
  await answer.fill('37');
  await page.getByRole('button',{name:'Religion · 20',exact:true}).click();
  await page.getByRole('button',{name:'Math · 20',exact:true}).click();
  await expect(answer).toHaveValue('37');
  await page.reload();
  await expect(answer).toHaveValue('37');
  await expect(page.locator('#progress')).toHaveText('1 of 20 answers entered');
  await testInfo.attach('math-answer-retained.png',{body:await page.screenshot({fullPage:false}),contentType:'image/png'});
  await answer.fill('');
  await expect(page.locator('#progress')).toHaveText('0 of 20 answers entered');
  await page.reload();
  await expect(answer).toHaveValue('');
  await expect(page.locator('#progress')).toHaveText('0 of 20 answers entered');
});

test('previously saved Math arrays recover as editable answers and score correctly',async({page},testInfo)=>{
  await page.addInitScript(()=>{
    if(!localStorage.getItem('abvm-audit-seeded')){
      localStorage.setItem('abvm-grade2-tuesday-2026-11-17-v2',JSON.stringify({active:'math',answers:{math:{m1:['37',''],m2:['',''],m3:'57'},religion:{r1:'A'}},submitted:{},student:'',date:''}));
      localStorage.setItem('abvm-audit-seeded','1');
    }
  });
  await page.goto('/november-practice-tests.html');
  await expect(page.getByRole('textbox',{name:'Answer to question 1',exact:true})).toHaveValue('37');
  await expect(page.getByRole('textbox',{name:'Answer to question 2',exact:true})).toHaveValue('');
  await expect(page.locator('#progress')).toHaveText('2 of 20 answers entered');
  await page.getByRole('textbox',{name:'Answer to question 1',exact:true}).fill('38');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Turn in test',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Score',exact:true})).toHaveValue('1/20');
  await expect(page.locator('.problem').first()).toContainText('Check this one');
  await expect(page.locator('.problem').nth(2)).toContainText('Correct');
  await testInfo.attach('math-recovered-scoring.png',{body:await page.screenshot({fullPage:false}),contentType:'image/png'});
});
