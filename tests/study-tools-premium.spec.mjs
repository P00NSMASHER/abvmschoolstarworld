import {test,expect} from "@playwright/test";
test.use({serviceWorkers:"block"});
const TIME=new Date("2026-10-08T12:00:00-04:00");
async function openStudy(page,width) {
  await page.clock.setFixedTime(TIME);
  await page.setViewportSize({width,height:width===320?740:852});
  await page.goto("/#study");
  await page.reload();
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:15000});
}
async function noOverflow(page,width) {
  const r=await page.locator(".games-screen").evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  expect(r.scroll,JSON.stringify({width,r})).toBeLessThanOrEqual(r.client+1);
}
async function decoded(locator) {
  await expect(locator).toBeVisible();
  await expect.poll(()=>locator.evaluate(img=>img.complete&&img.naturalWidth>0),{timeout:15000}).toBe(true);
  await locator.evaluate(img=>img.decode());
}
async function capture(page,info,name,full=false) {
  if(full)await page.addStyleTag({content:".phone-app{display:block!important;height:auto!important;min-height:100vh!important;overflow:visible!important}.screen-stack,.games-screen{height:auto!important;overflow:visible!important}.bottom-nav{display:none!important}"});
  await page.screenshot({path:info.outputPath(name+".png"),fullPage:full,animations:"disabled"});
}

test("real verified Test Prep has premium visuals and no clipped controls on iPhone",async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [320,375,390,402,430]) {
    await openStudy(page,width);
    await page.locator("[data-open-prep]").click();
    await expect(page.locator(".prep-header")).toBeVisible();
    await expect(page.locator(".prep-topic-card > h3")).not.toBeEmpty();
    await expect(page.locator(".prep-test-choice")).not.toHaveCount(0);
    await decoded(page.locator(".prep-seal"));
    await decoded(page.locator(".prep-eagle"));
    await decoded(page.locator(".prep-test-choice[aria-pressed=true] img").first());
    const surfaces=await page.locator(".prep-header,.prep-topic-card,.prep-test-choice[aria-pressed=true],.prep-sheet > .prep-start").evaluateAll(nodes=>nodes.map(el=>({background:getComputedStyle(el).backgroundImage,border:getComputedStyle(el).borderColor})));
    for(const surface of surfaces)expect(surface.background,JSON.stringify(surface)).toContain("gradient");
    const buttons=await page.locator(".prep-back,.prep-test-choice,.prep-start,.prep-guide").evaluateAll(nodes=>nodes.map(el=>{
      const box=el.getBoundingClientRect();return {left:box.left,right:box.right,height:box.height,scroll:el.scrollWidth,client:el.clientWidth};
    }));
    for(const box of buttons) {
      expect(box.height,JSON.stringify({width,box})).toBeGreaterThanOrEqual(44);
      expect(box.left,JSON.stringify({width,box})).toBeGreaterThanOrEqual(-1);
      expect(box.right,JSON.stringify({width,box})).toBeLessThanOrEqual(width+1);
      expect(box.scroll,JSON.stringify({width,box})).toBeLessThanOrEqual(box.client+1);
    }
    await noOverflow(page,width);
    if(width===390) {
      await capture(page,info,"study-tools-prep-390-first");
      await capture(page,info,"study-tools-prep-390-full",true);
    }
  }
});

test("native Test Prep, notes and guide history preserve verified interactions",async({page},info)=>{
  await openStudy(page,390);
  await page.locator("[data-open-prep]").click();
  const choice=page.locator(".prep-test-choice");
  await expect(choice.first()).toHaveAttribute("aria-pressed","true");
  if(await choice.count()>1){
    await choice.nth(1).click();
    await expect(page.locator(".prep-test-choice").nth(1)).toHaveAttribute("aria-pressed","true");
  }
  await page.locator("[data-close-prep]").click();
  await expect(page.locator(".study-game-grid > button")).toHaveCount(5);
  const notes=page.locator("details[data-study-notes]");
  await notes.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(notes).toHaveAttribute("open","");
  await expect(notes.locator("[data-notes-source]")).toHaveCount(2);
  await notes.locator("[data-notes-source=saved]").click();
  await expect(notes.locator("[data-notes-source=saved]")).toHaveAttribute("aria-pressed","true");
  await notes.locator("[data-notes-source=weekly]").click();
  await expect(notes.locator("[data-notes-source=weekly]")).toHaveAttribute("aria-pressed","true");
  const subjects=notes.locator("[data-notes-subject]");
  expect(await subjects.count()).toBeGreaterThan(0);
  await subjects.first().click();
  await expect(notes.locator(".study-note-panel:not([hidden])")).toHaveCount(1);
  await noOverflow(page,390);
  await notes.locator(":scope > summary").scrollIntoViewIfNeeded();
  await capture(page,info,"study-tools-notes-390-first");
  const history=page.locator("details[data-study-test-options]");
  await history.locator(":scope > summary").click();
  await expect(history).toHaveAttribute("open","");
  const guides=history.locator("[data-test-guide]");
  expect(await guides.count()).toBeGreaterThan(0);
  const heights=await guides.evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  await noOverflow(page,390);
  await history.locator(":scope > summary").scrollIntoViewIfNeeded();
  await capture(page,info,"study-tools-history-390-first");
});

test("resource navigation remains accessible at 200% text and tablet size",async({page},info)=>{
  await openStudy(page,375);
  await page.locator("[data-open-prep]").click();
  await page.evaluate(()=>{const e=document.documentElement;e.style.fontSize=2*parseFloat(getComputedStyle(e).fontSize)+"px"});
  await noOverflow(page,375);
  for(const b of await page.locator(".prep-back,.prep-test-choice,.prep-start,.prep-guide").evaluateAll(nodes=>nodes.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
  }))){
    expect(b.height,JSON.stringify(b)).toBeGreaterThanOrEqual(44);
    expect(b.left,JSON.stringify(b)).toBeGreaterThanOrEqual(-1);
    expect(b.right,JSON.stringify(b)).toBeLessThanOrEqual(376);
  }
  await page.evaluate(()=>{document.documentElement.style.fontSize=""});
  await page.locator("[data-close-prep]").click();
  await page.locator("details[data-study-notes] > summary").click();
  await page.evaluate(()=>{const e=document.documentElement;e.style.fontSize=2*parseFloat(getComputedStyle(e).fontSize)+"px"});
  await noOverflow(page,375);
  const heights=await page.locator("details[data-study-notes] > summary,.study-note-scope button,.study-note-subjects button").evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  await page.evaluate(()=>{document.documentElement.style.fontSize=""});
  for(const width of [820,1440]) {
    await openStudy(page,width);
    await page.locator("[data-open-prep]").click();
    await expect(page.locator(".prep-topic-card")).toBeVisible();
    await noOverflow(page,width);
    if(width===820)await capture(page,info,"study-tools-prep-ipad-820-first");
  }
});
