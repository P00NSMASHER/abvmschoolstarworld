import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

for(const viewport of [{width:393,height:852},{width:320,height:740},{width:768,height:1024}]){
  test(`Tier A school photography fits at ${viewport.width}x${viewport.height}`,async({page},info)=>{
    await page.setViewportSize(viewport);
    await page.goto('/#today');
    await expect(page.locator('.school-photo-hero')).toBeVisible();
    await expect(page.locator('.school-photo-hero')).toHaveCSS('background-image',/abvm-school-hero\.webp/);
    const sign=page.locator('.school-sign-inset img');
    await expect(sign).toHaveAttribute('src','./assets/school/abvm-school-sign.webp');
    await expect(sign).toHaveAttribute('alt',/Assumption BVM School sign/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const todayPath=info.outputPath(`school-today-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({path:todayPath,fullPage:false});
    await info.attach('Today school photography',{path:todayPath,contentType:'image/png'});

    await page.getByRole('button',{name:'Family',exact:true}).click();
    await expect(page.locator('.school-community-hero')).toHaveCSS('background-image',/abvm-school-aerial\.webp/);
    const portrait=page.locator('.school-portrait-card');
    await expect(portrait).toBeVisible();
    const facadeBackground=await portrait.evaluate(node=>getComputedStyle(node,'::before').backgroundImage);
    expect(facadeBackground).toContain('abvm-school-facade.webp');
    await expect(portrait).toContainText('Assumption BVM School');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const familyPath=info.outputPath(`school-family-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({path:familyPath,fullPage:false});
    await info.attach('Family school photography',{path:familyPath,contentType:'image/png'});
  });
}

test('only the four approved Tier A school photos are registered for offline delivery',async({page})=>{
  await page.goto('/#today');
  const sw=await page.request.get('/sw.js').then(r=>r.text());
  const registered=[...sw.matchAll(/\.\/assets\/school\/[^"']+\.webp/g)].map(m=>m[0]);
  expect(registered).toEqual([
    './assets/school/abvm-school-sign.webp',
    './assets/school/abvm-school-hero.webp',
    './assets/school/abvm-school-aerial.webp',
    './assets/school/abvm-school-facade.webp'
  ]);
});
