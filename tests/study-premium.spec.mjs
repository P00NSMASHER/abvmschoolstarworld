import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const FIXED_DATE = new Date("2026-10-08T12:00:00-04:00");
const WIDTHS = [320, 375, 390, 402, 430];

async function study(page, width) {
  await page.setViewportSize({width, height:width===320 ? 740 : 852});
  await page.clock.setFixedTime(FIXED_DATE);
  await page.goto("/#study");
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:15000});
  await expect(page.locator(".study-launch-layout")).toBeVisible();
  await expect(page.locator(".study-game-grid > .study-game-tile")).toHaveCount(5);
  await expect(page.locator(".study-badge-tracker")).toBeVisible();
}
async function noOverflow(page,width) {
  const box=await page.locator(".games-screen").evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));
  expect(box.scroll,String(width)+"px: Study horizontal overflow").toBeLessThanOrEqual(box.width+1);
}
async function decoded(locator) {
  await expect(locator).toBeVisible();
  await expect.poll(()=>locator.evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:15000}).toBe(true);
  await locator.evaluate(img=>img.decode());
}
async function capture(page,info,name,full=false) {
  if(full)await page.addStyleTag({content:".phone-app{display:block!important;height:auto!important;overflow:visible!important;min-height:100vh!important}.screen-stack,.games-screen{height:auto!important;overflow:visible!important}.bottom-nav{display:none!important}"});
  await page.screenshot({path:info.outputPath(name+".png"),animations:"disabled",fullPage:full});
}

test("premium Study retains five source-backed modes, artwork, and subject-color semantics",async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of WIDTHS) {
    await study(page,width);
    const tiles=page.locator(".study-game-grid > .study-game-tile");
    expect(await tiles.evaluateAll(nodes=>nodes.map(el=>el.dataset.gameStart))).toEqual(["reading","spelling","math","religion","mix"]);
    const colors=await tiles.evaluateAll(nodes=>Object.fromEntries(nodes.map(el=>[el.dataset.gameStart,getComputedStyle(el).backgroundColor])));
    expect(colors).toEqual({reading:"rgb(229, 243, 255)",spelling:"rgb(255, 239, 172)",math:"rgb(223, 241, 232)",religion:"rgb(230, 214, 255)",mix:"rgb(238, 243, 255)"});
    const fonts=await tiles.locator(".study-game-copy strong").evaluateAll(nodes=>nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)));
    expect(Math.min(...fonts)).toBeGreaterThanOrEqual(16);
    const geometry=await tiles.evaluateAll(nodes=>nodes.map(el=>{
      const b=el.getBoundingClientRect(),inner=el.querySelector(".study-game-copy").getBoundingClientRect();
      return {left:b.left,right:b.right,height:b.height,innerLeft:inner.left,innerRight:inner.right,
        shadow:getComputedStyle(el).boxShadow,gloss:getComputedStyle(el,"::before").backgroundImage};
    }));
    for(const box of geometry) {
      const context=JSON.stringify({width,box});
      expect(box.height,context).toBeGreaterThanOrEqual(76);
      expect(box.left,context).toBeGreaterThanOrEqual(-1);
      expect(box.right,context).toBeLessThanOrEqual(width+1);
      expect(box.innerLeft,context).toBeGreaterThanOrEqual(box.left-1);
      expect(box.innerRight,context).toBeLessThanOrEqual(box.right+1);
      expect(box.gloss,context).toContain("gradient");
      expect(box.shadow,context).not.toBe("none");
    }
    for(const selector of [
      ".study-hero .school-mark",
      ".study-hero-art",
      ".study-game-tile[data-game-start=reading] .study-game-icon img",
      ".study-game-tile[data-game-start=spelling] .study-game-icon img",
      ".study-badge-tracker .study-badge-art"
    ])await decoded(page.locator(selector));
    await expect(page.locator(".study-prep-launch")).toContainText("Test Prep");
    await expect(page.locator(".study-badge-tracker")).toContainText("Study Stars");
    await expect(page.locator(".bottom-nav [data-tab=study]")).toHaveAttribute("aria-current","page");
    await noOverflow(page,width);
    await capture(page,info,"study-premium-"+width+"-first");
    if(width===390)await capture(page,info,"study-premium-390-full",true);
  }
});

test("Test Prep, notes, Study Stars, and a subject round retain real interactions",async({page},info)=>{
  await study(page,390);
  await page.locator("[data-open-prep]").click();
  await expect(page.locator(".prep-header")).toBeVisible();
  await expect(page.locator(".prep-sheet")).toBeVisible();
  await capture(page,info,"study-premium-prep-390-first");
  await page.locator("[data-close-prep]").first().click();
  await expect(page.locator(".study-game-grid > button")).toHaveCount(5);
  const notes=page.locator("details[data-study-notes]");
  const summary=notes.locator(":scope > summary");
  await expect(notes).not.toHaveAttribute("open","");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(notes).toHaveAttribute("open","");
  await page.locator("details[data-study-test-options] > summary").click();
  await expect(page.locator("details[data-study-test-options]")).toHaveAttribute("open","");
  await noOverflow(page,390);
  await page.locator(".study-badge-tracker").click();
  await expect(page.locator(".badge-collection")).toBeVisible();
  await expect(page.locator(".bottom-nav [data-tab=family]")).toHaveAttribute("aria-current","page");
  await page.getByRole("button",{name:"Study",exact:true}).click();
  await expect(page.locator(".study-game-grid")).toBeVisible();
  await page.locator("[data-game-start=reading]").click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  await page.locator("[data-game-home]").first().click();
  await expect(page.locator(".study-game-grid")).toBeVisible();
});

test("200-percent Study text remains fully readable without clipped controls",async({page})=>{
  await study(page,375);
  const heading=page.locator(".study-game-tile[data-game-start=reading] .study-game-copy strong");
  const normal=await heading.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  await page.evaluate(()=>{const root=document.documentElement;root.style.fontSize=2*parseFloat(getComputedStyle(root).fontSize)+"px";});
  await expect.poll(()=>heading.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(normal*2-.1);
  await noOverflow(page,375);
  const rows=await page.locator(".study-game-grid > .study-game-tile,.study-prep-launch,.study-badge-tracker,details[data-study-notes] > summary").evaluateAll(nodes=>nodes.map(el=>{
    const b=el.getBoundingClientRect();
    return {height:b.height,left:b.left,right:b.right,width:el.clientWidth,scroll:el.scrollWidth};
  }));
  for(const box of rows) {
    const context=JSON.stringify(box);
    expect(box.height,context).toBeGreaterThanOrEqual(44);
    expect(box.left,context).toBeGreaterThanOrEqual(-1);
    expect(box.right,context).toBeLessThanOrEqual(376);
    expect(box.scroll,context).toBeLessThanOrEqual(box.width+1);
  }
});
