import {governedBrowserQuestions} from './helpers/governed-browser-questions.mjs';
import {test,expect} from '@playwright/test';

async function catalog(page){
  return governedBrowserQuestions(page);
}
async function visibleQuestion(page,questions){
  const prompt=(await page.locator('.game-question-card>h2').innerText()).trim();
  const choices=(await page.locator('[data-game-answer] strong').allTextContents()).map(x=>x.trim());
  const matching=questions.filter(row=>row.prompt===prompt&&row.choices.length===choices.length&&row.choices.every(choice=>choices.includes(choice)));
  if(new Set(matching.map(row=>row.answer)).size!==1)throw new Error('question not found or conflicting governed answers');
  const q=matching[0];
  return {q,correct:choices.indexOf(q.answer),wrong:choices.findIndex(choice=>choice!==q.answer)};
}

test.beforeEach(async({page})=>{
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase('abvm-study-stars-v1');req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('blocked'))}));
});

test('first-response correct and incorrect streaks progress in opposite directions without retry gaming',async({page})=>{
  const questions=await catalog(page);
  await page.getByRole('button',{name:/Mix/i}).click();

  for(let i=1;i<=3;i++){
    const item=await visibleQuestion(page,questions);
    await page.locator('[data-game-answer]').nth(item.correct).click();
    await expect(page.locator('.game-streak')).toContainText(`Correct streak ${i}`);
    await expect(page.locator('.game-streak')).toContainText(`+${i}`);
    await page.locator('[data-game-next]').click();
  }

  const miss1=await visibleQuestion(page,questions);
  await page.locator('[data-game-answer]').nth(miss1.wrong).click();
  await expect(page.locator('.game-streak')).toContainText('Miss streak 1');
  await expect(page.locator('.game-streak')).toContainText('No stars lost');
  await expect(page.locator('.study-star-penalty')).toContainText('No stars lost — your balance is at zero.');
  expect(await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance())).toBe(0);
  await page.locator('[data-game-answer]').nth(miss1.correct).click();
  await expect(page.locator('.game-streak')).toContainText('Miss streak 1');
  await page.locator('[data-game-next]').click();

  const miss2=await visibleQuestion(page,questions);
  await page.locator('[data-game-answer]').nth(miss2.wrong).click();
  await expect(page.locator('.game-streak')).toContainText('Miss streak 2');
  await expect(page.locator('.game-streak')).toContainText('No stars lost');
  await expect(page.locator('.study-star-penalty')).toContainText('No stars lost — your balance is at zero.');
  expect(await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance())).toBe(0);
  await page.locator('[data-game-answer]').nth(miss2.correct).click();
  await page.locator('[data-game-next]').click();

  const recovery=await visibleQuestion(page,questions);
  await page.locator('[data-game-answer]').nth(recovery.correct).click();
  await expect(page.locator('.game-streak')).toContainText('Correct streak 1');
  await expect(page.locator('.game-streak')).toContainText('+1');
});

test('perfect round saves the capped +10 streak reward plus +25 perfect bonus and +10 completion',async({page})=>{
  const questions=await catalog(page);
  await page.getByRole('button',{name:/Mix/i}).click();
  for(let i=0;i<8;i++){
    const item=await visibleQuestion(page,questions);
    await page.locator('[data-game-answer]').nth(item.correct).click();
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await expect(page.locator('.game-streak-summary')).toContainText('+10 Study Stars');
  await expect(page.locator('.study-star-earned')).toContainText('+45 Study Stars');
  await expect(page.locator('.study-perfect-bonus')).toContainText('+25');
  expect(await page.evaluate(()=>window.ABVMStudyGames.studyStarBalance())).toBe(45);
});
