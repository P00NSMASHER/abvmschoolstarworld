import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});
const fixedDate=new Date('2026-10-05T12:00:00-04:00');
const sizes=[{name:'iphone',width:390,height:844},{name:'ipad',width:820,height:1180}];

async function noOverflow(page){
  expect(await page.locator('.screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
}
async function capture(page,testInfo,name){
  await page.screenshot({path:testInfo.outputPath(name+'.png'),animations:'disabled'});
}

for(const size of sizes){
  test(`Family messages remain readable and complete on ${size.name}`,async({page},testInfo)=>{
    await page.setViewportSize(size);
    await page.clock.setFixedTime(fixedDate);
    const data=await(await page.request.get('/data/study-pack-runtime.json')).json();
    const longUpdate='School reminder: '+('Please review the school information with your family. ').repeat(18)+'End of complete source update.';
    data.pack.parentNotices=[longUpdate,...data.pack.parentNotices];
    await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:data}));
    await page.addInitScript(()=>localStorage.setItem('abvm-updates-seen:v1','[]'));
    await page.goto('/#family');
    const unread=page.locator('.unread-updates');
    await expect(unread).toBeVisible();
    await expect(page.locator('.family-more')).toHaveCount(0);
    const previews=unread.locator(':scope > ul > li > .family-message');
    await expect(previews).toHaveCount(3);
    for(const preview of await previews.all()){
      expect(await preview.getAttribute('open')).toBeNull();
      const box=await preview.boundingBox();
      expect(box.height).toBeLessThanOrEqual(180);
    }
    await page.locator('.screen').evaluate(el=>el.scrollTop=0);
    await capture(page,testInfo,`${size.name}-family-top`);
    await previews.first().scrollIntoViewIfNeeded();
    await capture(page,testInfo,`${size.name}-family-unread`);
    await previews.first().locator('summary').click();
    await expect(previews.first().locator('.family-message-body')).toHaveText(longUpdate);
    await expect(previews.first().locator('.family-message-body')).toBeVisible();
    await previews.first().locator('summary').click();
    await unread.locator('.family-update-overflow > summary').click();
    await expect(unread.locator('.family-update-overflow .family-message').first()).toBeVisible();
    await unread.locator('.family-update-overflow > summary').click();
    const notices=page.locator('[aria-labelledby="family-current-notices"]');
    await notices.scrollIntoViewIfNeeded();
    await noOverflow(page);
    await capture(page,testInfo,`${size.name}-family-notices`);
    const registrationNotice=notices.locator('.family-message').filter({hasText:'CYO registration for 2nd graders'});
    await registrationNotice.locator('summary').click();
    const registration=registrationNotice.getByRole('link',{name:'tools.signupgenius.com/c/st-nicholas-basketball-registration-k-1st-grade-copy'});
    await expect(registration).toBeVisible();
    await expect(registration).toHaveAttribute('href','https://tools.signupgenius.com/c/st-nicholas-basketball-registration-k-1st-grade-copy');
    await expect(registration).toHaveAttribute('rel',/noopener/);
    await noOverflow(page);
    await page.getByRole('button',{name:'Mark updates as read',exact:true}).click();
    await expect(unread).toHaveCount(0);
  });

  test(`October lunch artwork is visible and bounded on ${size.name}`,async({page},testInfo)=>{
    await page.setViewportSize(size);
    await page.clock.setFixedTime(fixedDate);
    for(const tab of ['today','week','calendar']){
      await page.goto('/#'+tab);
      await expect(page.locator('.screen')).toBeVisible();
      if(tab==='calendar')await page.locator('[data-cal-day]').filter({hasText:/^5$/}).click();
      const art=page.locator('.lunch-art').first();
      await expect(art).toBeVisible();
      await art.scrollIntoViewIfNeeded();
      const image=art.locator('img');
      await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBeTruthy();
      await expect(art).toContainText('Meal illustration');
      expect(await image.getAttribute('alt')).toMatch(/^Illustration of /);
      const bounded=await art.evaluate(el=>{
        const frame=el.closest('.lunch-card,.agenda-lunch').getBoundingClientRect();
        const image=el.querySelector('img').getBoundingClientRect();
        return image.width>0&&image.height>0&&image.left>=frame.left-1&&image.right<=frame.right+1;
      });
      expect(bounded).toBeTruthy();
      await noOverflow(page);
      await capture(page,testInfo,`${size.name}-${tab}-lunch`);
    }
  });
}
