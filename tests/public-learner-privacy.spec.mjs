import {test,expect} from "@playwright/test";

// Every snapshot starts from a genuinely empty anonymous browser context.
test("anonymous learner greetings and on-device rank labels fit four iPhone widths",async({browser},info)=>{
  const context=await browser.newContext({
    serviceWorkers:"block",
    storageState:{cookies:[],origins:[]},
    viewport:{width:390,height:852},
    isMobile:true,
    hasTouch:true
  });
  const page=await context.newPage();
  for(const width of [375,390,402,430]){
    await page.setViewportSize({width,height:852});
    await page.goto("/#today");
    await expect(page.locator(".hero-copy h2")).toHaveText("Ready for today?");
    const rank=page.locator(".study-badge-latest");
    await expect(rank).toBeVisible();
    await expect(rank).toContainText("STUDY RANK");
    await expect(rank).not.toContainText("EMMA");
    const fit=()=>page.locator(".screen").evaluate(el=>el.scrollWidth<=el.clientWidth+1);
    expect(await fit(),width+"px Today overflows").toBe(true);
    if(width===390){
      await page.screenshot({
        path:info.outputPath("anonymous-today-390.png"),
        animations:"disabled"
      });
    }
    await page.locator('[data-tab="study"]').click();
    const heading=page.locator(".study-hero-copy h2");
    await expect(heading).toContainText("eagle!");
    await expect(heading).not.toContainText("Emma");
    expect(await fit(),width+"px Study overflows").toBe(true);
    if(width===390){
      await page.screenshot({
        path:info.outputPath("anonymous-study-390.png"),
        animations:"disabled"
      });
    }
  }
  await context.close();
});
