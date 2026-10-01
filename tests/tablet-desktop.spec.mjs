import {test,expect} from "@playwright/test";

for(const viewport of [
  {name:"iPad portrait",width:768,height:1024},
  {name:"large tablet",width:820,height:1180},
]){
  test(`${viewport.name} keeps all six tabs and content usable`,async({browser})=>{
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},hasTouch:true});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#today");
    await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
    await expect(page.locator(".bottom-nav button")).toHaveCount(6);
    for(const tab of ["Calendar","Study","Study Games","Family"]){
      await page.getByRole("button",{name:tab,exact:true}).click();
      await expect(page.locator(".screen")).toBeVisible();
      if(tab==="Study Games")await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      expect(overflow,viewport.name+" "+tab+" overflow").toBeFalsy();
    }
    const minTarget=await page.locator(".bottom-nav button").evaluateAll(nodes=>Math.min(...nodes.map(n=>n.getBoundingClientRect().height)));
    expect(minTarget).toBeGreaterThanOrEqual(44);
    await context.close();
  });
}

test("desktop keeps the centered app, navigation, and long information pages readable",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop","Desktop-only assertion");
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
  const shell=await page.locator(".phone-app").evaluate(el=>({width:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left}));
  expect(shell.width).toBeGreaterThan(320);
  expect(shell.width).toBeLessThanOrEqual(1440);
  await expect(page.locator(".bottom-nav button")).toHaveCount(6);
  await page.getByRole("button",{name:"Study Games",exact:true}).click();
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await page.getByRole("button",{name:"Family",exact:true}).click();
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});
