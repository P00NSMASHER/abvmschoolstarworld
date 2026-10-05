import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
async function openRoom(page){
  await page.goto('/#study');
  await expect(page.locator('.study-room-v2')).toBeVisible();
  await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await expect(page.locator('.room-destination-label')).toHaveCount(4);
}
for(const [width,height] of [[393,852],[768,1024]]){
  test(`child-first Study Room is readable and reflows at ${width}x${height}`,async({page},info)=>{
    await page.setViewportSize({width,height});
    await openRoom(page);
    await expect(page.locator('.room-daily')).toHaveCount(1);
    await expect(page.locator('.room-subject-grid > .study-accordion')).toHaveCount(6);
    const geometry=await page.evaluate(()=>{
      const daily=document.querySelector('.room-daily'),hub=document.querySelector('#study-hub');
      const controls=[...document.querySelectorAll('.room-daily button,.hub-tabs button,.study-accordion > summary')];
      return {dailyFirst:!!(daily.compareDocumentPosition(hub)&Node.DOCUMENT_POSITION_FOLLOWING),
        smallest:Math.min(...controls.map(el=>el.getBoundingClientRect().height)),
        navType:Math.min(...[...document.querySelectorAll('.room-destination-label')].map(el=>parseFloat(getComputedStyle(el).fontSize))),
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2};
    });
    expect(geometry.dailyFirst).toBe(true);
    expect(geometry.smallest).toBeGreaterThanOrEqual(44);
    expect(geometry.navType).toBeGreaterThanOrEqual(16);
    expect(geometry.overflow).toBe(false);
    await info.attach(`study-room-${width}`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
    await page.locator('#study-reading > summary').click();
    await expect(page.locator('#study-reading')).toHaveAttribute('open','');
    await page.evaluate(()=>document.documentElement.style.zoom='2');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2)).toBe(false);
    await page.emulateMedia({reducedMotion:'reduce'});
    const motion=await page.locator('.hub-tabs button').first().evaluate(el=>getComputedStyle(el).transitionDuration);
    expect(motion).toBe('0s');
  });
}

test('all four destinations retain their controller actions and keyboard focus',async({page})=>{
  await openRoom(page);
  for(const key of ['cumulative','star','games','weekly']){
    const button=page.locator(`.hub-tabs [data-tab="${key}"]`);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(`.hub-tabs [data-tab="${key}"]`)).toBeFocused();
    await expect(page.locator(`.hub-tabs [data-tab="${key}"]`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.room-destination-icon')).toHaveCount(4);
    await expect(page.locator('.room-subject-icon')).toHaveCount(6);
    if(key==='weekly')await expect(page.locator('.room-daily')).toBeVisible();
    else await expect(page.locator('.room-daily')).toBeHidden();
  }
  await expect(page.locator('[data-subject-practice="daily"]')).toBeVisible();
  await page.locator('[data-subject-practice="daily"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
});

test('focused practice supports explicit read-aloud without recording an answer',async({page},info)=>{
  await page.addInitScript(()=>{
    window.__roomSpeech={spoken:[],cancelled:0};
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      cancel(){window.__roomSpeech.cancelled++;},
      speak(utterance){window.__roomSpeech.spoken.push(utterance.text);}
    }});
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  });
  await openRoom(page);
  await page.locator('.hub-tabs [data-tab="star"]').click();
  await page.locator('[data-star="Math"]').click();
  await expect(page.locator('.hub-round')).toBeVisible();
  await expect(page.locator('.hub-tabs')).toBeHidden();
  await expect(page.locator('.room-daily')).toBeHidden();
  const prompt=await page.locator('.hub-round h3').textContent();
  const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));
  await page.getByRole('button',{name:'Read to me',exact:true}).click();
  expect(await page.evaluate(()=>window.__roomSpeech.spoken)).toHaveLength(1);
  expect(await page.evaluate(()=>window.__roomSpeech.spoken[0])).toContain(prompt);
  expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);
  await expect(page.locator('.hub-feedback')).toHaveCount(0);
  await page.locator('[data-answer]').first().click();
  await expect(page.locator('.room-feedback-title')).toBeVisible();
  await expect(page.locator('[data-next]')).toBeVisible();
  await info.attach('study-room-practice',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await page.locator('[data-end]').click();
  await expect(page.locator('.hub-tabs')).toBeVisible();
  expect(await page.evaluate(()=>window.__roomSpeech.cancelled)).toBeGreaterThanOrEqual(2);
});

test('slow collection loading does not move the primary daily action',async({page})=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route('**/data/schoolwork.json',async route=>{await pending;await route.continue();});
  await page.goto('/#study');
  try{
    await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','loading');
    const before=await page.locator('.room-daily').boundingBox();
    expect(before).not.toBeNull();
    release();
    await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','ready',{timeout:15000});
    const after=await page.locator('.room-daily').boundingBox();
    expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(8);
    await expect(page.locator('.room-daily')).toHaveCount(1);
  }finally{release();}
});

test('collection failure retains source notes and daily practice without an uploader',async({page})=>{
  await page.route('**/data/schoolwork.json',route=>route.abort());
  await page.goto('/#study');
  await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','error');
  await expect(page.locator('.room-daily')).toBeVisible();
  await expect(page.locator('.room-subject-grid > .study-accordion')).toHaveCount(6);
  await page.locator('#study-religion > summary').click();
  await expect(page.locator('#study-religion')).toHaveAttribute('open','');
  await expect(page.locator('.hub-error [data-retry]')).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});


test('wrong Study Room answers stay rejected and do not consume another attempt',async({page})=>{
  await openRoom(page);
  await page.locator('.hub-tabs [data-tab="star"]').click();
  await page.locator('[data-star="Math"]').click();
  await expect(page.locator('.hub-round')).toBeVisible();

  const prompt=await page.locator('.hub-round h3').textContent();
  const row=await page.evaluate(async currentPrompt=>{
    const envelope=await fetch('./data/study-pack.json',{cache:'no-store'}).then(r=>r.json());
    const sourceKey=window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack,envelope);
    const catalog=window.ABVMStudyGames.buildCatalog(envelope.pack,{sourceKey});
    const {buildStarBank}=await import('./star-practice.mjs');
    const q=[...catalog.questions.filter(item=>item.tier==='star-fallback'),...buildStarBank()]
      .find(item=>item.prompt===currentPrompt);
    return q?{answer:q.answer,choices:q.choices,skill:q.skill}:null;
  },prompt);
  expect(row).not.toBeNull();
  const wrongs=row.choices.map((choice,index)=>choice!==row.answer?index:-1).filter(index=>index>=0);
  const correct=row.choices.indexOf(row.answer);
  expect(wrongs.length).toBeGreaterThanOrEqual(1);

  const firstWrong=page.locator('[data-answer]').nth(wrongs[0]);
  await firstWrong.click();
  await expect(firstWrong).toBeDisabled();
  await expect(firstWrong).toHaveClass(/hub-rejected/);
  await expect(page.locator('.hub-try')).toContainText('Try another');
  await expect(page.locator('[data-next]')).toHaveCount(0);
  const focusedAfterWrong=await page.evaluate(()=>({
    answer:document.activeElement?.getAttribute('data-answer'),
    disabled:document.activeElement?.disabled===true
  }));
  expect(focusedAfterWrong.answer).not.toBeNull();
  expect(focusedAfterWrong.disabled).toBe(false);

  await firstWrong.evaluate(button=>button.click());
  await expect(page.locator('[data-next]')).toHaveCount(0);

  const correctButton=page.locator('[data-answer]').nth(correct);
  await correctButton.click();
  await expect(page.locator('.hub-feedback-correct')).toBeVisible();
  await expect(page.locator('[data-next]')).toBeVisible();
  await expect(firstWrong).toBeDisabled();
});

test('test completion has immediate Undo and survives reload with a restore control',async({page})=>{
  await page.goto('/#today');
  await page.evaluate(()=>localStorage.removeItem('abvm-completed-tests'));
  await openRoom(page);
  const prep=page.locator('.hub-prep');
  const original=await prep.locator('h3').textContent();
  expect(original?.trim()).toBeTruthy();

  const grownups=page.locator('.room-test-options');
  await expect(grownups).toBeVisible();
  await grownups.locator('summary').click();
  await page.locator('[data-complete-test]').click();
  await expect(page.locator('.hub-undo')).toContainText('marked finished');
  await expect(page.locator('[data-undo-test]')).toBeVisible();
  // The real Oct. 9 spelling test currently has no reviewed test-specific bank.
  // It may use only exact-skill Grade 2 fallback items, and that substitution
  // must be disclosed rather than passed off as teacher-authored test material.
  await expect(page.locator('.hub-fallback-note')).toContainText('Spelling (short i / long i)');
  await expect(page.locator('.hub-fallback-note')).toContainText('Grade-level skill practice');
  await page.locator('[data-undo-test]').click();
  await expect(page.locator('.hub-undo')).toContainText('restored');
  await expect(prep.locator('h3')).toHaveText(original||'');

  await page.locator('.room-test-options summary').click();
  await page.locator('[data-complete-test]').click();
  await page.reload();
  await expect(page.locator('#study-hub')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  const hidden=page.locator('.hub-completed-tests');
  await expect(hidden).toBeVisible();
  await hidden.locator('summary').click();
  await expect(hidden.locator('[data-restore-test]').first()).toBeVisible();
  await hidden.locator('[data-restore-test]').first().click();
  await expect(page.locator('.hub-prep h3')).toHaveText(original||'');
});
