import {test,expect} from '@playwright/test';

async function currentSkills(page){
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  return (envelope.pack?.contentPipeline?.skills||[]).slice(0,4).map(row=>({id:row.id,label:row.label||row.id}));
}

test('Weekly Learning shows only current skills from the last seven days without grades or percentages',async({page})=>{
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
  const card=page.getByRole('region',{name:'Study room'}).locator('section[aria-labelledby="weekly-learning-title"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Strong today');
  await expect(card).toContainText('Remembered later');
  await expect(card).toContainText('Practice again');
  await expect(card).toContainText(skills[0].label);
  await expect(card).toContainText(skills[1].label);
  await expect(card).toContainText(skills[2].label);
  await expect(card).not.toContainText(skills[3].label);
  await expect(card).not.toContainText('not-current-anymore');
  const text=(await card.textContent())||'';
  expect(text).not.toMatch(/mastery|ranking|\brank\b|\bscore\b|\bstreak\b|\d+%/i);
  expect(text).toMatch(/not a grade/i);
});

test('more recent practice evidence moves a skill back to Practice again',async({page})=>{
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
  const card=page.locator('section[aria-labelledby="weekly-learning-title"]');
  const strong=card.locator('.notice-row').filter({hasText:'Strong today'});
  const practice=card.locator('.notice-row').filter({hasText:'Practice again'});
  await expect(practice).toContainText(skill.label);
  await expect(strong).not.toContainText(skill.label);
});
