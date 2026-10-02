import {test,expect} from '@playwright/test';

test('Family shows the verified What changed at school feed',async({page})=>{
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  envelope.pack.schoolChangeFeed={
    schemaVersion:1,
    generatedAt:'2026-10-01T14:00:00.000Z',
    sourceHash:'feed-test',
    changed:true,
    items:[
      {id:'a',kind:'new-skill',subject:'Reading / ELA',text:'New: Reading / ELA — Subject and predicate, test Friday, Oct. 9'},
      {id:'b',kind:'review-skill',subject:'Reading / ELA',text:'Moved to recent review: Reading / ELA — Sentence types'},
      {id:'c',kind:'lunch',subject:'Lunch',text:'Lunch menu updated.'},
      {id:'d',kind:'unchanged',subject:'Religion',text:'No changes to Religion.'}
    ]
  };
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope)}));
  await page.goto('/?school-change-feed-test=1#family');
  const card=page.locator('section[aria-labelledby="school-change-title"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('What changed at school?');
  await expect(card).toContainText('Subject and predicate');
  await expect(card).toContainText('Moved to recent review');
  await expect(card).toContainText('Lunch menu updated');
  await expect(card).toContainText('No changes to Religion');
});

test('Family does not invent a change feed before verified refresh evidence exists',async({page})=>{
  const envelope=await (await page.request.get('/data/study-pack.json')).json();
  delete envelope.pack.schoolChangeFeed;
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(envelope)}));
  await page.goto('/?school-change-feed-empty=1#family');
  await expect(page.locator('section[aria-labelledby="school-change-title"]')).toHaveCount(0);
});
