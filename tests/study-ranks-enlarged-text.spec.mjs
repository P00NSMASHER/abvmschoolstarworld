import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function rankTextBounds(page){
  return page.locator('[data-badge-collection]').evaluate(root=>{
    const selectors=['.rank-current h3','.rank-current p','.rank-current .badge-eyebrow','.study-badge-next h3','.study-badge-next p','.study-badge-next .badge-eyebrow','.study-badge-card strong','.study-badge-card>span','.study-badge-card small','.badge-progress-label strong'];
    const clipped=[];
    for(const selector of selectors)for(const node of root.querySelectorAll(selector)){
      const box=node.getBoundingClientRect(),panel=(node.closest('.rank-current,.study-badge-next,.study-badge-card')||root).getBoundingClientRect(),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
      for(let text=walker.nextNode();text;text=walker.nextNode()){
        if(!text.textContent.trim())continue;
        const range=document.createRange();range.selectNodeContents(text);
        for(const rect of range.getClientRects())if(rect.width>0&&(rect.left<box.left-1||rect.right>box.right+1||rect.left<panel.left-1||rect.right>panel.right+1))clipped.push({selector,text:text.textContent.trim(),textLeft:rect.left,textRight:rect.right,boxLeft:box.left,boxRight:box.right,panelLeft:panel.left,panelRight:panel.right});
      }
    }
    return clipped;
  });
}

for(const width of [375,390,744,820])test(`starter and top rank text remain readable at 2x on ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width<700?852:1060});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
    const style=document.createElement('style');
    style.textContent='@media(max-width:699px){.phone-app{height:calc(100dvh - 93px);margin-top:59px}body{padding-bottom:34px}}';
    document.head.append(style);
  }));
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:15000});
  await page.locator('[data-open-badges]').first().click();
  const collection=page.locator('[data-badge-collection]');
  await expect(collection.locator('.rank-current h3')).toHaveText('Eaglet');
  await page.evaluate(()=>document.fonts.ready);
  for(const rank of ['Eaglet','ABVM Legend']){
    if(rank==='ABVM Legend'){
      await page.evaluate(async()=>{
        const e=window.ABVMStudyGames;
        for(let i=0;i<34;i++)await e.commitStudyStarRewards({sourcePack:'enlarged-rank-layout',mode:'quick',sessionSeed:String(i),completed:true,streakAdjustment:10,firstTryCorrect:8,questionCount:8});
        window.ABVMStudyBadges.sync(await e.studyBadgeCollection());
      });
      await expect(collection.locator('.rank-current h3')).toHaveText('ABVM Legend');
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='');
    expect(await rankTextBounds(page),`${rank}: normal text must fit its layout boxes`).toEqual([]);
    if(width<700){
      const art=await collection.locator('.rank-current>.study-badge-art').boundingBox(),copy=await collection.locator('.rank-current>div').boundingBox();
      expect(copy.x,`${rank}: normal phone layout stays compact beside the emblem`).toBeGreaterThanOrEqual(art.x+art.width+8);
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='34px');
    expect(await rankTextBounds(page),`${rank}: enlarged glyphs must fit, including inside overflow-hidden tiles`).toEqual([]);
    expect(await collection.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  }
});
