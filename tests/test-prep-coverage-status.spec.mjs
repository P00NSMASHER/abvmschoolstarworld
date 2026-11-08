import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

async function mount(page,{readingCount=8,teacherTopic=true,readingGames=12,firstLabel='Reading'}={}){
 await page.goto('/#today');
 await page.evaluate(async ({readingCount,teacherTopic,readingGames,firstLabel})=>{
   history.replaceState(null,'','#study?prep=1');
   const {createMaterialsView}=await import('./study-games-materials-view.mjs?v=21');
   const labels=[firstLabel,'Grammar (singular & plural nouns)','Spelling (3 letter blends) / Handwriting'];
   const events=labels.map((label,i)=>({date:'2026-11-'+String(11+i),label,kind:'test'}));
   const counts=[readingCount,8,8];
   const model={
     upcomingTests(){const entries=events.map((t,index)=>({...t,index,key:t.date+'|'+t.label,count:counts[index]}));
       return {tests:events,supported:entries.filter(t=>t.count),missing:entries.filter(t=>!t.count),fallback:[],completed:[]};},
     testPreview(index){return {total:counts[index],teacherTopicOnly:index===0&&teacherTopic,
       practice:{label:'Original reviewed practice'},topics:[],retryCount:0};},
     forMode(mode){return {count:mode==='reading'?readingGames:0};},
   };
   const host=document.createElement('section');
   host.className='games-screen';
   document.body.replaceChildren(host);
   const view=createMaterialsView({win:window,onChange:()=>{host.innerHTML=view.priorityHtml({loading:false});view.bind(host);}});
   view.setModel(model);host.innerHTML=view.priorityHtml({loading:false});view.bind(host);
 },{readingCount,teacherTopic,readingGames,firstLabel});
}

test('phone Test Prep shows separate teacher-topic and exact-matching counts',async({page},info)=>{
 await mount(page);
 await expect(page.locator('[data-test-coverage]')).toHaveText('8 teacher-topic questions');
 await expect(page.locator('[data-test-topic-aligned]')).toContainText('Exact test coverage is not confirmed');
 await expect(page.locator('[data-test-select]')).toContainText([
   '8 teacher-topic questions','8 matching questions','8 matching questions',
 ]);
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:852});
  expect(await page.locator('.games-screen').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({animations:'disabled',path:info.outputPath('coverage-'+width+'.png')});
 }
 await page.locator('[data-test-select="1"]').click();
 await expect(page.locator('[data-test-coverage]')).toHaveText('8 matching questions');
 await expect(page.locator('[data-test-topic-aligned]')).toHaveCount(0);
});

test('unscoped Reading fallback returns to existing Study menu without claiming test coverage',async({page})=>{
 await mount(page,{readingCount:0,teacherTopic:false});
 await expect(page.locator('[data-test-coverage]')).toHaveText('0 matching questions');
 await expect(page.locator('[data-test-single]')).toBeDisabled();
 await expect(page.locator('[data-general-reading-link]')).toContainText('not confirmed test questions');
 await page.locator('[data-general-reading-link] [data-close-prep]').click();
 await expect(page.locator('[data-open-prep]')).toBeVisible();
 await expect(page.locator('[data-test-single]')).toHaveCount(0);
});
