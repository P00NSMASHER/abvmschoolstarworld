import {test,expect} from "@playwright/test";

async function openDestination(page,label){
  if(label==="Study Games"){
    await page.getByRole("button",{name:"Study",exact:true}).click();
    await page.locator(".study-games-cta").click();
    await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  }else await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
}

for(const viewport of [
  {name:"iPad portrait",width:768,height:1024},
  {name:"large tablet",width:820,height:1180},
]){
  test(`${viewport.name} keeps all five tabs and content usable`,async({browser})=>{
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},hasTouch:true});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#today");
    await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
    await expect(page.locator(".bottom-nav button")).toHaveCount(5);
    const hero=page.locator(".hero-card");
    await expect(hero).toBeVisible();
    const heroBox=await hero.boundingBox();
    const brandMark=await hero.locator(".hero-brand-mark").boundingBox();
    const titleSize=await hero.locator(".hero-copy h2").evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(heroBox.height).toBeGreaterThanOrEqual(240);
    expect(brandMark.width).toBeGreaterThanOrEqual(96);
    expect(titleSize).toBeGreaterThanOrEqual(30);
    for(const tab of ["Calendar","Study","Study Games","Family"]){
      await openDestination(page,tab);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      expect(overflow,viewport.name+" "+tab+" overflow").toBeFalsy();
    }
    const minTarget=await page.locator(".bottom-nav button").evaluateAll(nodes=>Math.min(...nodes.map(n=>n.getBoundingClientRect().height)));
    expect(minTarget).toBeGreaterThanOrEqual(44);
    await context.close();
  });
}

test("wide desktop layout does not collapse above 1366 pixels",async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop","Desktop-only breakpoint assertion");
  for(const width of [1366,1367,1440,1920]){
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#today");
    await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
    const layout=await page.locator(".phone-app").evaluate(el=>({
      width:el.getBoundingClientRect().width,
      columns:getComputedStyle(el.querySelector(".today-screen")).gridTemplateColumns
    }));
    expect(layout.width,`${width}px app width`).toBeGreaterThanOrEqual(1000);
    expect(layout.columns,`${width}px Today columns`).not.toBe("none");
    await context.close();
  }
});

test("desktop keeps the centered app, navigation, and long information pages readable",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop","Desktop-only assertion");
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
  const shell=await page.locator(".phone-app").evaluate(el=>({width:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left}));
  expect(shell.width).toBeGreaterThan(320);
  expect(shell.width).toBeLessThanOrEqual(1440);
  await expect(page.locator(".bottom-nav button")).toHaveCount(5);
  await openDestination(page,"Study Games");
  await page.getByRole("button",{name:"Family",exact:true}).click();
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});
