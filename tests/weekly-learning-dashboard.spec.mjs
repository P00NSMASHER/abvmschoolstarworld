import {test,expect} from '@playwright/test';

async function currentSkills(page){
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  return (envelope.pack?.contentPipeline?.skills||[]).slice(0,4).map(row=>({id:row.id,label:row.label||row.id}));
}

test('removing the Games report preserves current seven-day learning evidence and stored history',async({page})=>{
  const skills=await currentSkills(page);
  expect(skills.length).toBeGreaterThanOrEqual(4);
  const now=Date.now();
  await page.addInitScript(({skills,now})=>{
    localStorage.setItem('abvm-study-learning:v2',JSON.stringify({
      [skills[0].id]:{LastSeenAt:now-300000,LastIndependentCorrectAt:now-300000,LastResolution:{correct:true,independent:true,resolvedAt:now-300000}},
      [skills[1].id]:{LastSeenAt:now-600000,LastComebackAt:now-600000,LastComebackCorrectAt:now-600000,RememberedLater:1},
      [skills[2].id]:{LastSeenAt:now-900000,LastResolution:{correct:false,independent:false,resolvedAt:now-900000}},
      [skills[3].id]:{LastSeenAt:now-(8*86400000),LastResolution:{correct:false,independent:false,resolvedAt:now-(8*86400000)}},
      'not-current-anymore':{LastSeenAt:now-1000,LastIndependentCorrectAt:now-1000,LastResolution:{correct:true,independent:true,resolvedAt:now-1000}}
    }));
  },{skills,now});
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await expect(page.locator('[data-learning-panel],section[aria-labelledby="weekly-learning-title"]')).toHaveCount(0);
  await expect(page.locator('.games-screen')).not.toContainText('Learning on this device');
  // The report is intentionally gone. Its existing evidence model must still
  // distinguish independent, recalled and recent unsuccessful learning.
  const snapshot=await page.evaluate(async now=>{
    const envelope=await fetch('./data/study-pack.json').then(response=>response.json());
    return window.ABVMWeeklyLearning.snapshot({pack:envelope.pack,learning:JSON.parse(localStorage.getItem('abvm-study-learning:v2')),now});
  },now);
  expect(snapshot.strong.map(row=>row.id)).toEqual([skills[0].id]);
  expect(snapshot.remembered.map(row=>row.id)).toEqual([skills[1].id]);
  expect(snapshot.practice.map(row=>row.id)).toEqual([skills[2].id]);
  const before=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));
  await page.locator('[data-study-notes] > summary').click();
  await page.locator('[data-study-test-options] > summary').click();
  await expect(page.locator('[data-learning-panel],section[aria-labelledby="weekly-learning-title"]')).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(before);
  const stored=JSON.parse(before);
  expect(stored[skills[3].id]).toBeTruthy();
  expect(stored['not-current-anymore']).toBeTruthy();
});

test('more recent unsuccessful practice still supersedes older independent evidence without a report',async({page})=>{
  const [skill]=await currentSkills(page);
  const now=Date.now();
  await page.addInitScript(({skill,now})=>{
    localStorage.setItem('abvm-study-learning:v2',JSON.stringify({
      [skill.id]:{
        LastIndependentCorrectAt:now-7200000,
        LastSeenAt:now-3600000,
        LastResolution:{correct:false,independent:false,resolvedAt:now-3600000}
      }
    }));
  },{skill,now});
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  const snapshot=await page.evaluate(async now=>{
    const envelope=await fetch('./data/study-pack.json').then(response=>response.json());
    return window.ABVMWeeklyLearning.snapshot({pack:envelope.pack,learning:JSON.parse(localStorage.getItem('abvm-study-learning:v2')),now});
  },now);
  expect(snapshot.practice.map(row=>row.id)).toEqual([skill.id]);
  expect(snapshot.strong).toEqual([]);
  await expect(page.locator('[data-learning-panel],section[aria-labelledby="weekly-learning-title"]')).toHaveCount(0);
});
