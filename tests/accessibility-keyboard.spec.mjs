import {test,expect} from "@playwright/test";

async function waitForApp(page,path="/#today"){
  await page.goto(path);
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
}

async function openDestination(page,label){
  if(label==="Study Games"){
    await page.goto(new URL("#games",page.url()).href);
  }else await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
  if(label==="Study"||label==="Study Games")await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
}

test("keyboard navigation reaches the skip link and all five primary tabs",async({page})=>{
  await waitForApp(page);
  await page.evaluate(()=>{document.body.setAttribute("tabindex","-1");document.body.focus()});
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  const focusStyle=await page.locator(".skip-link").evaluate(el=>{
    const s=getComputedStyle(el);return{style:s.outlineStyle,width:parseFloat(s.outlineWidth)||0};
  });
  expect(focusStyle.style).not.toBe("none");
  expect(focusStyle.width).toBeGreaterThanOrEqual(2);
  await page.evaluate(()=>document.body.removeAttribute("tabindex"));

  const seen=new Set();
  for(let i=0;i<18;i++){
    await page.keyboard.press("Tab");
    const tab=await page.evaluate(()=>document.activeElement?.getAttribute("data-tab"));
    if(tab)seen.add(tab);
    if(seen.size===5)break;
  }
  expect(seen).toEqual(new Set(["today","week","calendar","study","family"]));
});

test("Study sources, mix choices, and native disclosures work from keyboard",async({page})=>{
  await waitForApp(page,"/#study");
  const source=page.locator("select[data-study-source]");
  await expect(source).toBeEnabled({timeout:10_000});
  await source.focus();
  await expect(source).toBeFocused();
  await source.press("End");
  await source.press("Enter");
  await expect(source).toHaveValue("mix");
  await expect(source).toBeFocused();
  const star=page.locator('[data-study-mix] input[data-study-pick="star"]');
  await expect(star).not.toBeChecked();
  await star.focus();
  await page.keyboard.press("Space");
  await expect(star).toBeChecked();
  await expect(star).toBeFocused();
  await page.keyboard.press("Space");
  await expect(star).not.toBeChecked();

  for(const selector of ["details[data-study-notes]","details[data-study-test-options]"]){
    const details=page.locator(selector);
    const summary=details.locator(":scope > summary");
    await expect(details).not.toHaveAttribute("open","");
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open","");
    if(selector.includes("data-study-notes"))await expect(details.locator(".game-material-lesson").first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(details).not.toHaveAttribute("open","");
  }
});

test("checklist completion preserves scroll position and keyboard focus",async({page})=>{
  const source=await (await page.request.get("/data/study-pack.json")).json();
  const schoolDate=source.pack?.lunchMenu?.[0]?.date;
  expect(Number.isFinite(Date.parse(String(schoolDate)+"T12:00:00Z"))).toBe(true);
  await page.clock.setFixedTime(new Date(`${schoolDate}T17:00:00Z`));
  await page.setViewportSize({width:390,height:480});
  await waitForApp(page,"/#week");
  const checks=page.locator("[data-check]");
  expect(await checks.count()).toBeGreaterThan(1);
  const target=checks.last();
  const index=await target.getAttribute("data-check");
  await target.scrollIntoViewIfNeeded();
  await target.focus();
  const before=await page.locator(".screen").evaluate(el=>el.scrollTop);
  expect(before).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  const updated=page.locator(`[data-check="${index}"]`);
  await expect(updated).toBeFocused();
  const after=await page.locator(".screen").evaluate(el=>el.scrollTop);
  expect(Math.abs(after-before)).toBeLessThanOrEqual(4);
  await expect(page.locator("#toast")).toContainText(/Completed:|Marked incomplete:/);
});

test("bottom navigation can be activated by keyboard",async({page})=>{
  await waitForApp(page);
  for(const label of ["Week","Calendar","Study","Family","Today"]){
    const button=page.getByRole("button",{name:label,exact:true});
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-current","page");
    await expect(page.locator(".screen")).toBeVisible();
  }
});

test("125, 150, and 200 percent visual zoom preserve reflow",async({page})=>{
  await waitForApp(page);
  for(const zoom of [1.25,1.5,2]){
    await page.evaluate(value=>{document.documentElement.style.zoom=String(value)},zoom);
    for(const tab of ["Today","Week","Calendar","Study","Study Games","Family"]){
      await openDestination(page,tab);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
      expect(overflow,tab+" overflows at "+Math.round(zoom*100)+"% zoom").toBeFalsy();
    }
  }
});

test("headings, main landmark, navigation, and status region remain coherent",async({page})=>{
  await waitForApp(page);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("navigation",{name:"App navigation"})).toHaveCount(1);
  await expect(page.locator("#toast")).toHaveAttribute("role","status");
  await expect(page.locator("#toast")).toHaveAttribute("aria-live","polite");
  for(const tab of ["Today","Week","Calendar","Study","Study Games","Family"]){
    await openDestination(page,tab);
    await expect(page.locator(".screen")).toBeVisible();
    await expect(page.locator(".screen h1").first()).toBeVisible();
  }
});
