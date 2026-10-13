import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

for(const viewport of [{width:393,height:852},{width:320,height:740},{width:768,height:1024}]){
  test(`Tier A school photography fits at ${viewport.width}x${viewport.height}`,async({page},info)=>{
    await page.setViewportSize(viewport);
    await page.goto('/#today');
    await expect(page.locator('.school-photo-hero')).toBeVisible();
    const sign=page.locator('.school-sign-photo');
    await expect(sign).toBeVisible();
    await expect(sign).toHaveAttribute('src','./assets/school/abvm-school-sign.webp');
    await expect.poll(()=>sign.evaluate(img=>img.complete&&img.naturalWidth===420&&img.naturalHeight===280)).toBe(true);
    const photo=page.locator('.hero-photo');
    await expect(photo).toHaveAttribute('src','./assets/school/abvm-school-hero.webp');
    await expect(photo).toHaveAttribute('alt',/Assumption BVM School/);
    expect(Number(await photo.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(await photo.getAttribute('height'))).toBeGreaterThan(0);
    await expect.poll(()=>photo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const todayPath=info.outputPath(`school-today-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({path:todayPath,fullPage:false});
    await info.attach('Today school photography',{path:todayPath,contentType:'image/png'});

    await page.getByRole('button',{name:'Progress',exact:true}).click();
    await expect(page.locator('.learning-library')).toBeVisible();
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


test("restored original Howard Avenue sign decodes in the rendered premium Today card",async({page})=>{
  await page.goto("/#today");
  const sign=page.locator(".school-sign-card .school-sign-photo");
  await expect(sign).toBeVisible();
  await expect(sign).toHaveAttribute("alt",/original photograph.*school sign/i);
  await expect.poll(()=>sign.evaluate(img=>img.complete&&img.naturalWidth===420&&img.naturalHeight===280)).toBe(true);
  const metadata=await sign.evaluate(async img=>{await img.decode();const r=img.getBoundingClientRect();return {naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,inViewport:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1}});
  expect(metadata).toEqual({naturalWidth:420,naturalHeight:280,inViewport:true});
});
