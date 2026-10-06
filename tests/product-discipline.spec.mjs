import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('initial shell never presents a blank content area',async({page})=>{
  const html=await page.request.get('/index.html').then(r=>r.text());
  expect(html).toContain('app-loading-screen');
  expect(html).toContain('Loading school information');
});

test('Study puts the four games before adult practice controls',async({page})=>{
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
  await expect(page.locator('.study-games-hero h2')).toHaveText('What do you want to play?');
  await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
  const order=await page.evaluate(()=>({
    games:[...document.querySelectorAll('.games-screen *')].indexOf(document.querySelector('.study-game-grid')),
    materials:[...document.querySelectorAll('.games-screen *')].indexOf(document.querySelector('.game-materials'))
  }));
  expect(order.games).toBeGreaterThanOrEqual(0);
  expect(order.materials).toBeGreaterThan(order.games);
  const about=page.locator('.game-practice-info');
  await expect(about).toBeVisible();
  await expect(about).not.toHaveAttribute('open','');
  await expect(page.locator('.games-screen')).not.toContainText('Questions prioritize current school skills');
});

test('Family leads with actions and progressively discloses long notice feeds',async({page})=>{
  await page.goto('/#family');
  await expect(page.locator('.family-screen')).toBeVisible({timeout:10_000});
  await expect(page.locator('.family-hero.compact')).toHaveCount(0);
  const actions=page.locator('.family-actions-card');
  await expect(actions).toBeVisible();
  const notices=page.locator('.notices-card');
  if(await notices.count()){
    const immediate=notices.locator(':scope > .static-notice-list > .notice-row');
    expect(await immediate.count()).toBeLessThanOrEqual(3);
  }
  await expect(page.locator('.family-screen')).not.toContainText('You’re all caught up.');
});

test('freshness language answers whether the visible school info is trustworthy',async({page})=>{
  await page.goto('/#today');
  const label=(await page.locator('.freshness strong').innerText()).trim();
  expect(label).toMatch(/School info current|Last checked|May be outdated|Offline|status unavailable/i);
  expect(label).not.toMatch(/^Verified\b/);
});

test('installed app advances final UX assets as one cache identity',async({page})=>{
  const [index,sw]=await Promise.all([
    page.request.get('/index.html').then(r=>r.text()),
    page.request.get('/sw.js').then(r=>r.text())
  ]);
  expect(index).toContain('./visual-polish.css?v=5');
  expect(index).toContain('./school-updates.js?v=4');
  expect(index).toContain('abvm-sw-reloaded-v130');
  expect(sw).toContain('abvm-grade2-parent-companion-v130-product-discipline-final');
  expect(sw).toContain('./visual-polish.css?v=5');
  expect(sw).toContain('./school-updates.js?v=4');
});
