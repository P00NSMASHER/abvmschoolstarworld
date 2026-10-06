import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test.use({video:{mode:'on',size:{width:393,height:852}},viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'});

test.describe('recorded Games walkthrough',()=>{
  test('iPhone home, question, hint, retry, correct answer, result and return remain one Games experience',async({page},testInfo)=>{
    test.setTimeout(60000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-05T16:00:00-04:00'));
    await page.goto('/#study');
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
    await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
    await expect(page.locator('[data-study-source]')).toHaveValue('weekly');
    const catalog=await page.evaluate(async()=>{
      const envelope=await fetch('./data/study-pack-runtime.json').then(response=>response.json());
      const engine=window.ABVMStudyGames;
      return engine.buildCatalog(envelope.pack,{sourceKey:engine.sourceKeyFromEnvelope(envelope.pack,envelope)}).questions;
    });
    // These short holds intentionally make each learning state reviewable in
    // the retained recording; synchronization is provided by the assertions.
    await page.waitForTimeout(350);
    await page.locator('[data-game-start="math"]').click();
    await expect(page.locator('.game-topbar')).toContainText('Math Dash');
    for(let index=0;index<8;index++){
      await expect(page.locator('.game-topbar')).toContainText(`${index+1} of 8`);
      const prompt=await page.locator('.game-question-card > h2').innerText();
      const choices=await page.locator('[data-game-answer] strong').allTextContents();
      const question=catalog.find(q=>q.prompt===prompt&&q.choices.length===choices.length&&q.choices.every(choice=>choices.includes(choice)));
      expect(question,'walkthrough question resolves from its public weekly source').toBeTruthy();
      const correct=choices.indexOf(question.answer);expect(correct).toBeGreaterThanOrEqual(0);
      if(index===0){
        await page.waitForTimeout(350);
        await page.locator('[data-game-hint]').click();
        await expect(page.locator('.game-hint')).toBeVisible();
        await page.waitForTimeout(350);
        const wrong=choices.findIndex(choice=>choice!==question.answer);
        await page.locator('[data-game-answer]').nth(wrong).click();
        await expect(page.locator('[data-game-answer]').nth(wrong)).toBeDisabled();
        await expect(page.locator('.game-feedback.retry')).toBeVisible();
        await expect(page.locator('[data-game-next]')).toHaveCount(0);
        await page.waitForTimeout(350);
      }
      await page.locator('[data-game-answer]').nth(correct).click();
      await expect(page.locator('.game-feedback.correct')).toBeVisible();
      if(index===0){
        const evidence=await page.evaluate(skill=>window.ABVMStudyGames.loadLearning()[skill].LastResolution,question.skill);
        expect(evidence).toEqual(expect.objectContaining({independent:false,attemptCount:2,incorrectCount:1,hintCount:1}));
        await page.waitForTimeout(350);
      }
      await page.locator('[data-game-next]').click();
    }
    await expect(page.locator('.game-finish')).toBeVisible();
    await expect(page.locator('.study-star-earned')).toContainText('+10 Study Stars');
    const finishActions=page.locator('.game-finish-actions > button');
    await expect(finishActions).toHaveText(['Play again','All study games']);
    const actionFonts=await finishActions.evaluateAll(buttons=>buttons.map(button=>({label:button.textContent.trim(),fontSize:parseFloat(getComputedStyle(button).fontSize)})));
    for(const action of actionFonts)expect(action.fontSize,`${action.label} label is at least 16px`).toBeGreaterThanOrEqual(16);
    const metricsPath=testInfo.outputPath('games-finish-text-metrics.json');
    await writeFile(metricsPath,JSON.stringify({viewport:{width:393,height:852},actions:actionFonts},null,2));
    await testInfo.attach('Games finish action text metrics',{path:metricsPath,contentType:'application/json'});
    await expect(page.locator('.learning-summary-note')).toContainText('One round does not prove mastery');
    await page.waitForTimeout(350);
    await page.getByRole('button',{name:'All study games',exact:true}).click();
    await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
    await expect(page.locator('.study-game-grid [data-game-start="math"]')).toContainText('Best 8 / 8');
    await page.waitForTimeout(350);
    expect(errors).toEqual([]);
    const video=page.video();
    expect(video).not.toBeNull();
    await page.close();
    const path=testInfo.outputPath('games-walkthrough-iphone.webm');
    await video.saveAs(path);
    await testInfo.attach('Games iPhone walkthrough',{path,contentType:'video/webm'});
  });
});
