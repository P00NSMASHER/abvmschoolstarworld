import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

for(const viewport of [{width:390,height:844},{width:820,height:1024}]){
  test(`Study has one clear route to tests, subjects, notes and printables at ${viewport.width}px`,async({page},info)=>{
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date('2026-11-16T14:00:00-05:00'));
    await page.goto('/#study');
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});

    const subjects=page.locator('.study-game-section');
    await expect(subjects.getByRole('heading',{name:'Practice a subject'})).toBeVisible();
    await expect(subjects.locator('[data-game-start]')).toHaveCount(5);
    await expect(page.locator('[data-open-prep]')).toBeVisible();
    await expect(page.locator('[data-study-notes] > summary')).toContainText('Class notes');
    await expect(page.locator('[data-study-test-options] > summary')).toContainText('Worksheets & test history');
    await expect(page.locator('[data-study-notes]')).not.toHaveAttribute('open','');
    await expect(page.locator('[data-study-test-options]')).not.toHaveAttribute('open','');
    const saved=await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'));

    await page.locator('[data-open-prep]').click();
    await expect(page.locator('.prep-sheet > h2')).toHaveText('Choose a test');
    const choices=page.locator('.prep-chooser-panel [data-test-select]');
    expect(await choices.count()).toBeGreaterThan(0);
    expect(await page.locator('.prep-chooser-panel').evaluate(el=>
      Boolean(el.compareDocumentPosition(document.querySelector('#study-test-details'))&Node.DOCUMENT_POSITION_FOLLOWING)
    ),'test chooser precedes details, not buried underneath actions').toBe(true);
    const first=choices.first();
    await expect(first).toHaveAttribute('aria-controls','study-test-details');
    await expect(first).toHaveAttribute('aria-pressed','true');
    if(await choices.count()>1){
      await choices.last().click();
      await expect(choices.last()).toHaveAttribute('aria-pressed','true');
      await expect(choices.first()).toHaveAttribute('aria-pressed','false');
    }
    await expect(page.locator('[data-study-tests]')).toBeVisible();
    await expect(page.locator('.prep-material-actions [data-test-guide]')).toBeVisible();
    await expect(page.locator('.prep-material-actions [data-test-worksheet]')).toBeVisible();
    await expect(page.locator('.prep-learning-more')).not.toHaveAttribute('open','');
    await expect(page.locator('[data-jump-tests]')).toHaveCount(0);

    expect(await page.locator('.games-screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await info.attach('Study simple Test Prep '+viewport.width,{
      body:await page.screenshot({animations:'disabled',fullPage:true}),contentType:'image/png'
    });
    await page.locator('.prep-header [data-close-prep]').click();
    await expect(subjects).toBeVisible();
    await page.locator('[data-study-notes] > summary').click();
    await expect(page.locator('[data-study-notes]')).toHaveAttribute('open','');
    await page.locator('[data-study-test-options] > summary').click();
    await expect(page.locator('[data-study-test-options]')).toHaveAttribute('open','');
    expect(await page.evaluate(()=>localStorage.getItem('abvm-study-learning:v2'))).toBe(saved);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
}
