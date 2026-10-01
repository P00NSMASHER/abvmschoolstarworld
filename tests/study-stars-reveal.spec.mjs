import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
});

test('reward reveal is a short 1.2 second Study Stars acknowledgement', async ({ page }) => {
  const html=await page.evaluate(()=>window.ABVMStudyGameView.rewardReveal({amount:12,currency:'Study Stars'}));
  expect(html).toContain('data-duration-ms="1200"');
  expect(html).toContain('+12 Study Stars');
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).not.toMatch(/continue|claim|open|shop|store/i);
  expect(html).not.toMatch(/<button|<a\b|tabindex=/i);
});

test('reward reveal cannot introduce a second currency', async ({ page }) => {
  const html=await page.evaluate(()=>window.ABVMStudyGameView.rewardReveal({amount:10,currency:'Coins'}));
  expect(html).toContain('+10 Study Stars');
  expect(html).not.toContain('Coins');
});

test('zero or duplicate-only awards produce no reveal', async ({ page }) => {
  const html=await page.evaluate(()=>window.ABVMStudyGameView.rewardReveal({amount:0,currency:'Study Stars'}));
  expect(html).toBe('');
});

test('invalid, negative, and non-finite reward amounts render nothing', async ({ page }) => {
  const result=await page.evaluate(()=>({
    negative:window.ABVMStudyGameView.rewardReveal({amount:-2}),
    infinity:window.ABVMStudyGameView.rewardReveal({amount:Infinity}),
    text:window.ABVMStudyGameView.rewardReveal({amount:'not-a-number'})
  }));
  expect(result).toEqual({negative:'',infinity:'',text:''});
});


test('reward reveal is noninteractive and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const html=await page.evaluate(()=>window.ABVMStudyGameView.rewardReveal({amount:10,currency:'Study Stars'}));
  await page.locator('#app-content').evaluate((node,markup)=>{node.innerHTML=markup},html);
  const reveal=page.locator('[data-reward-reveal]');
  await expect(reveal).toBeVisible();
  expect(await reveal.evaluate(node=>getComputedStyle(node).pointerEvents)).toBe('none');
  expect(await reveal.evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
});

test('normal motion remains bounded to 1.2 seconds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const html=await page.evaluate(()=>window.ABVMStudyGameView.rewardReveal({amount:10}));
  await page.locator('#app-content').evaluate((node,markup)=>{node.innerHTML=markup},html);
  const duration=await page.locator('[data-reward-reveal]').evaluate(node=>getComputedStyle(node).animationDuration);
  expect(duration).toBe('1.2s');
});
