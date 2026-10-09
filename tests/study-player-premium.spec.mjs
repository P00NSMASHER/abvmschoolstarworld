import {test, expect} from "@playwright/test";
import {resolveGovernedBrowserQuestion} from "./helpers/governed-browser-questions.mjs";

test.use({serviceWorkers:"block"});
const FIXED = new Date("2026-10-08T12:00:00-04:00");
const WIDTHS = [320,375,402,430,390];

async function round(page,width) {
  await page.setViewportSize({width,height:width===320?740:852});
  await page.clock.setFixedTime(FIXED);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/#study");
  // Navigating to the same SPA hash can preserve an active round between
  // viewport iterations. Explicit reload tests a clean real Study entry.
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:15000});
  await expect(page.locator('[data-game-start="mix"]')).toBeVisible({timeout:15000});
  await page.locator('[data-game-start="mix"]').click();
  await expect(page.locator(".games-screen.is-playing .game-question-card")).toBeVisible();
}

async function noOverflow(page,width) {
  const r=await page.locator(".games-screen").evaluate(el=>({
    scroll:el.scrollWidth,client:el.clientWidth
  }));
  expect(r.scroll,JSON.stringify({width,r})).toBeLessThanOrEqual(r.client+1);
  const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(documentWidth,"document overflows "+width+"px").toBeLessThanOrEqual(1);
}

async function capture(page,info,name,{full=false}={}) {
  let tag=null;
  if(full) tag=await page.addStyleTag({content:
    ".phone-app{display:block!important;height:auto!important;min-height:100vh!important;overflow:visible!important}"+
    ".screen-stack,.games-screen{height:auto!important;overflow:visible!important}"+
    ".bottom-nav{display:none!important}"});
  try{
    await page.screenshot({path:info.outputPath(name+".png"),fullPage:full,animations:"disabled"});
  }finally{
    if(tag)await tag.evaluate(node=>node.remove());
  }
}

test("governed Study player presents high-contrast premium question and answer controls at five phone widths",async({page},info)=>{
  for(const width of WIDTHS){
    await round(page,width);
    const header=page.locator(".study-player-header");
    const question=page.locator(".game-question-card");
    await expect(header).toBeVisible();
    await expect(header.locator('[role="progressbar"]')).toHaveAttribute("aria-valuemin","0");
    await expect(header.locator(".game-live-score")).toBeVisible();
    await expect(header.locator(".game-streak")).toBeVisible();
    await expect(header.locator(".game-star-balance")).toBeVisible();
    await expect(question.locator("h2")).not.toBeEmpty();
    await expect(question.locator(".game-question-meta")).toBeVisible();
    const answers=question.locator("[data-game-answer]");
    expect(await answers.count()).toBeGreaterThanOrEqual(2);
    const dimensions=await answers.evaluateAll(nodes=>nodes.map(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {width:r.width,height:r.height,left:r.left,right:r.right,font:parseFloat(getComputedStyle(el.querySelector("strong")).fontSize),gradient:s.backgroundImage};
    }));
    for(const d of dimensions){
      const ctx=JSON.stringify({width,d});
      expect(d.height,ctx).toBeGreaterThanOrEqual(60);
      expect(d.left,ctx).toBeGreaterThanOrEqual(-1);
      expect(d.right,ctx).toBeLessThanOrEqual(width+1);
      expect(d.font,ctx).toBeGreaterThanOrEqual(15);
      expect(d.gradient,ctx).toContain("gradient");
    }
    const appearance=await header.evaluate(el=>({
      background:getComputedStyle(el).backgroundImage,
      borderBottom:getComputedStyle(el).borderBottomWidth
    }));
    expect(appearance.background).toContain("gradient");
    expect(parseFloat(appearance.borderBottom)).toBeGreaterThanOrEqual(3);
    await noOverflow(page,width);
    await capture(page,info,"study-player-"+width+"-first");
    if(width===390)await capture(page,info,"study-player-390-full",{full:true});
  }
});

test("hint, wrong-answer retry and correct explanation keep meaning and readable layout",async({page},info)=>{
  await round(page,390);
  const question=await resolveGovernedBrowserQuestion(page);
  const hintButton=page.locator("[data-game-hint]");
  await hintButton.click();
  await expect(page.locator(".game-hint")).toBeVisible();
  await expect(hintButton).toContainText("Hide hint");
  await capture(page,info,"study-player-hint-390-full",{full:true});
  await page.locator("[data-game-answer]").nth(question.wrong[0]).click();
  const wrong=page.locator(".game-feedback.incorrect");
  await expect(wrong).toBeVisible();
  await expect(wrong).toContainText("Incorrect");
  await expect(page.locator("[data-game-answer]").nth(question.wrong[0])).toBeDisabled();
  await capture(page,info,"study-player-retry-390-full",{full:true});
  const right=page.locator("[data-game-answer]").nth(question.correct);
  await expect(right).toBeEnabled({timeout:15000});
  await right.click();
  await expect(page.locator(".game-feedback.correct")).toBeVisible();
  await expect(page.locator("[data-game-next]")).toBeVisible();
  await expect(page.locator(".game-feedback.correct p")).not.toBeEmpty();
  await capture(page,info,"study-player-correct-390-full",{full:true});
  const semanticColors=await page.locator(".game-feedback.correct,.game-answer.correct,.game-answer.wrong").evaluateAll(nodes=>nodes.map(el=>({
    background:getComputedStyle(el).backgroundImage,
    border:getComputedStyle(el).borderColor,
    opacity:Number(getComputedStyle(el).opacity)
  })));
  for(const s of semanticColors){
    expect(s.background).toContain("gradient");
    expect(s.opacity,"Resolved answer choices must remain readable").toBeGreaterThanOrEqual(.95);
  }
  await noOverflow(page,390);
  await page.locator("[data-game-next]").click();
  await expect(page.locator(".game-question-card")).toBeVisible();
});

test("double-sized text and real test-prep selection remain navigable without changing content",async({page},info)=>{
  await round(page,375);
  await page.evaluate(()=>{const root=document.documentElement;root.style.fontSize=2*parseFloat(getComputedStyle(root).fontSize)+"px"});
  await noOverflow(page,375);
  const controls=await page.locator(".game-topbar > button,.game-answer,.game-hint-button").evaluateAll(nodes=>nodes.map(el=>{
    const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};
  }));
  for(const d of controls){
    expect(d.height,JSON.stringify(d)).toBeGreaterThanOrEqual(44);
    expect(d.left,JSON.stringify(d)).toBeGreaterThanOrEqual(-1);
    expect(d.right,JSON.stringify(d)).toBeLessThanOrEqual(376);
  }
  await page.evaluate(()=>{document.documentElement.style.fontSize=""});
  await page.locator("[data-game-home]").first().click();
  await expect(page.locator(".study-game-grid")).toBeVisible();
  await page.locator("[data-open-prep]").click();
  await expect(page.locator(".prep-header")).toBeVisible();
  await expect(page.locator(".prep-sheet")).toBeVisible();
  await expect(page.locator(".prep-test-choice").first()).toBeVisible();
  const topics=await page.locator(".prep-test-choice").allTextContents();
  expect(topics.some(value=>/spelling|handwriting|grammar/i.test(value))).toBe(true);
  await capture(page,info,"study-player-test-prep-375-first");
  await page.locator("[data-close-prep]").first().click();
  await expect(page.locator("[data-game-start=reading]")).toBeVisible();
  await noOverflow(page,375);
});
