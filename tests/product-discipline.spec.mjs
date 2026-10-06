import {test,expect} from '@playwright/test';

test('initial shell never presents a blank content area',async({page})=>{
  const html=await page.request.get('/index.html').then(r=>r.text());
  expect(html).toContain('app-loading-screen');
  expect(html).toContain('Loading school information');
});

test('Study opens child-first with four games before quieter adult controls',async({page})=>{
  await page.goto('/#games');
  const grid=page.locator('.study-game-grid');
  await expect(grid).toBeVisible({timeout:10_000});
  await expect(page.locator('.study-games-hero h2')).toHaveText('What do you want to play?');
  await expect(grid.locator(':scope > .study-game-tile')).toHaveCount(4);
  const source=page.locator('[data-study-source]');
  await expect(source).toBeVisible();
  const order=await page.evaluate(()=>({
    games:document.querySelector('.study-game-grid').getBoundingClientRect().top,
    source:document.querySelector('[data-study-source]').getBoundingClientRect().top
  }));
  expect(order.source).toBeGreaterThan(order.games);
  const about=page.locator('.game-practice-info');
  await expect(about).toBeVisible();
  await expect(about).not.toHaveAttribute('open','');
  await expect(page.locator('.games-screen')).not.toContainText('Questions prioritize current school skills');
});

test('Family makes actions primary and progressively discloses notices',async({page})=>{
  await page.goto('/#family');
  await expect(page.locator('.family-screen')).toBeVisible({timeout:10_000});
  const actions=page.locator('.family-actions-card');
  await expect(actions).toBeVisible();
  const notices=page.locator('.notices-card');
  if(await notices.count()){
    const immediate=notices.locator(':scope > .static-notice-list > .notice-row');
    expect(await immediate.count()).toBeLessThanOrEqual(3);
    const overflow=notices.locator('.family-notices-overflow');
    if(await overflow.count())await expect(overflow).not.toHaveAttribute('open','');
  }
  await expect(page.locator('.family-screen')).not.toContainText('You’re all caught up.');
  const order=await page.evaluate(()=>({
    action:[...document.querySelectorAll('.family-screen > *')].indexOf(document.querySelector('.family-actions-card')),
    school:[...document.querySelectorAll('.family-screen > *')].indexOf(document.querySelector('.family-school-secondary'))
  }));
  expect(order.action).toBeGreaterThanOrEqual(0);
  expect(order.school).toBeGreaterThan(order.action);
});

test('freshness language answers whether visible school info is trustworthy',async({page})=>{
  await page.goto('/#today');
  const label=(await page.locator('.freshness strong').innerText()).trim();
  expect(label).toMatch(/School info current|Last checked|May be outdated|Offline|status unavailable/i);
  expect(label).not.toMatch(/^Verified\b/);
});

test('current Tier A photography survives the discipline pass without duplicate branding',async({page})=>{
  await page.goto('/#today');
  await expect(page.locator('.school-sign-inset img')).toHaveAttribute('src',/abvm-school-sign\.webp/);
  await expect(page.locator('.hero-brand')).toHaveCount(0);
  await page.getByRole('button',{name:'Family',exact:true}).click();
  await expect(page.locator('.school-community-hero')).toBeVisible();
  await expect(page.locator('.school-portrait-card')).toBeVisible();
});

test('installed app advances all discipline assets as one cache identity',async({page})=>{
  const [index,sw]=await Promise.all([
    page.request.get('/index.html').then(r=>r.text()),
    page.request.get('/sw.js').then(r=>r.text())
  ]);
  expect(index).toContain('./visual-polish.css?v=2');
  expect(index).toContain('./school-photos.css?v=2');
  expect(index).toContain('./school-updates.js?v=3');
  expect(index).toContain('abvm-sw-reloaded-v127');
  expect(sw).toContain('abvm-grade2-parent-companion-v127-product-discipline');
  expect(sw).toContain('./visual-polish.css?v=2');
  expect(sw).toContain('./school-photos.css?v=2');
  expect(sw).toContain('./school-updates.js?v=3');
  expect(sw).not.toContain('""');
});
