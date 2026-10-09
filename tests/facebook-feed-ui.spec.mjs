import {test,expect} from '@playwright/test';

const school={
  sourceId:'ABVM_SCHOOL_FACEBOOK',
  organization:'Assumption BVM School',
  category:'School event',
  postId:'100057127132786_101',
  postUrl:'https://www.facebook.com/permalink.php?story_fbid=101&id=100057127132786'
};
const hsa={
  sourceId:'ABVM_HSA_FACEBOOK',
  organization:'Assumption BVM Home & School Association',
  category:'HSA event',
  postId:'61552549763989_102',
  postUrl:'https://www.facebook.com/permalink.php?story_fbid=102&id=61552549763989'
};
const item=overrides=>({
  id:'event:fall-event-2026-10-08',
  summary:'Autumn community gathering at school.',
  category:'School event',
  audience:'families',confidence:'high',noticeStatus:'active',
  verificationStatus:'verified-and-reviewed',
  postedAt:'2026-10-08T13:00:00.000Z',
  eventDates:['2026-10-08'],deadlineDates:[],conflict:false,
  sources:[school,hsa],...overrides
});
const fixture=rows=>({
  schemaVersion:1,generatedAt:'2026-10-08T14:00:00.000Z',
  posts:[],display:rows,conflicts:[],audit:[],quarantines:[]
});

test('actual iPhone/desktop Today and Week keep school and HSA post links separately accessible',async({browser})=>{
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-08T16:00:00.000Z'));
  await page.route('**/data/facebook-updates.json*',route=>route.fulfill({json:fixture([item()])}));
  await page.goto('/#today');
  await expect(page.locator('.today-screen')).toBeVisible();
  const today=page.locator('[data-facebook-feed="today"]');
  await expect(today.locator('.facebook-update-row')).toHaveCount(1);
  await expect(today).toContainText('ABVM school Facebook');
  await expect(today).toContainText('ABVM HSA Facebook');
  const links=today.locator('.facebook-update-sources a');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute('href',school.postUrl);
  await expect(links.nth(1)).toHaveAttribute('href',hsa.postUrl);
  await expect(links.first()).toHaveAttribute('rel',/noopener noreferrer/);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  expect(overflow).toBe(false);

  await page.goto('/#week');
  const week=page.locator('[data-facebook-feed="week"]');
  await expect(page.locator('.week-screen')).toBeVisible();
  await expect(week.locator('.facebook-update-row')).toHaveCount(1);
  await expect(week).toContainText('ABVM school Facebook');
  await expect(week).toContainText('ABVM HSA Facebook');
  await context.close();
});

test('source conflicts remain visible, and hostile text cannot become markup',async({browser})=>{
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-08T16:00:00.000Z'));
  const items=[
    item({id:'post:school',sources:[school],summary:'Conflicting <script>window.evil=1</script>',conflict:true}),
    item({id:'post:hsa',sources:[hsa],summary:'Different HSA time for the same event.',conflict:true})
  ];
  await page.route('**/data/facebook-updates.json*',route=>route.fulfill({json:fixture(items)}));
  await page.goto('/#today');
  await expect(page.locator('[data-facebook-feed="today"] .facebook-update-row')).toHaveCount(2);
  await expect(page.locator('[data-facebook-feed="today"]')).toContainText('Announcement details conflict');
  expect(await page.evaluate(()=>Boolean(window.evil))).toBe(false);
  await expect(page.locator('script').filter({hasText:'window.evil=1'})).toHaveCount(0);
  await context.close();
});

test('a failed Facebook request never hides the verified school app',async({browser})=>{
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/data/facebook-updates.json*',route=>route.fulfill({status:503,body:'Source not available'}));
  await page.goto('/#today');
  await expect(page.locator('.today-screen')).toBeVisible();
  await expect(page.locator('.hero-card')).toBeVisible();
  await expect(page.locator('.facebook-update-row')).toHaveCount(0);
  await context.close();
});

test('mobile Today rejects a cross-owned school/HSA post before rendering it',async({browser})=>{
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-08T16:00:00.000Z'));
  const malicious=[
    item({id:'mislabel-school',sources:[{...school,postUrl:hsa.postUrl}]}),
    item({id:'mislabel-hsa',sources:[{...hsa,postUrl:school.postUrl}]}),
    item({id:'fabricated-path',sources:[{...school,postUrl:'https://www.facebook.com/another/100057127132786/posts/101'}]}),
    item({id:'wrong-post-id',sources:[{...hsa,postId:school.postId}]}),
    item({id:'relative-date',postedAt:'2026-10-08'}),
    item({id:'valid-official-school',sources:[school]})
  ];
  await page.route('**/data/facebook-updates.json*',route=>route.fulfill({json:fixture(malicious)}));
  await page.goto('/#today');
  const rows=page.locator('[data-facebook-feed="today"] .facebook-update-row');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Autumn community gathering at school.');
  const links=rows.locator('a');
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute('href',school.postUrl);
  await expect(rows).not.toContainText('ABVM HSA Facebook');
  await context.close();
});
