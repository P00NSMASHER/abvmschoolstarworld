import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(()=>localStorage.removeItem('abvm-study-stars-goal:v1'));
});

test('Dream Goal is exactly one cosmetic target at 50 Study Stars', async ({ page }) => {
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    return {goal:e.studyStarDreamGoal(),before:e.loadStudyStarGoal(),after:e.selectStudyStarGoal()};
  });
  expect(result.goal).toEqual(expect.objectContaining({
    id:'starlight-study-badge',title:'Starlight Study Badge',target:50,cosmetic:true
  }));
  expect(result.before.selected).toBe(false);
  expect(result.after.selected).toBe(true);
});

test('Dream Goal progress is bounded, simple, and never spends Stars', async ({ page }) => {
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    e.selectStudyStarGoal();
    return [-5,0,12,49,50,90].map(balance=>e.studyStarGoalProgress(balance));
  });
  expect(result[0]).toEqual(expect.objectContaining({balance:0,remaining:50,percent:0,unlocked:false}));
  expect(result[2]).toEqual(expect.objectContaining({balance:12,remaining:38,percent:24,unlocked:false}));
  expect(result[3]).toEqual(expect.objectContaining({balance:49,remaining:1,percent:98,unlocked:false}));
  expect(result[4]).toEqual(expect.objectContaining({balance:50,remaining:0,percent:100,unlocked:true}));
  expect(result[5]).toEqual(expect.objectContaining({balance:90,remaining:0,percent:100,unlocked:true}));
});

test('Dream Goal renderer exposes one accessible progress bar and no store or catalog', async ({ page }) => {
  const html=await page.evaluate(()=>{
    const e=window.ABVMStudyGames,v=window.ABVMStudyGameView;
    e.selectStudyStarGoal();
    return v.goal({state:e.studyStarGoalProgress(12)});
  });
  expect(html).toContain('aria-label="Dream Goal"');
  expect(html).toContain('role="progressbar"');
  expect(html).toContain('aria-valuenow="12"');
  expect(html).toContain('12 / 50 Stars');
  expect(html).not.toMatch(/store|shop|catalog|purchase/i);
});

test('unknown Dream Goals are rejected rather than creating a hidden catalog', async ({ page }) => {
  const result=await page.evaluate(()=>{
    try{window.ABVMStudyGames.selectStudyStarGoal('second-goal');return 'accepted'}catch(error){return String(error.message)}
  });
  expect(result).toContain('Unknown Study Star Dream Goal');
});


test('Dream Goal caps accessible progress at the goal target after unlock', async ({ page }) => {
  const html=await page.evaluate(()=>{
    const e=window.ABVMStudyGames,v=window.ABVMStudyGameView;
    e.selectStudyStarGoal();
    return v.goal({state:e.studyStarGoalProgress(90)});
  });
  expect(html).toContain('90 / 50 Stars');
  expect(html).toContain('aria-valuemax="50"');
  expect(html).toContain('aria-valuenow="50"');
  expect(html).not.toContain('aria-valuenow="90"');
});
