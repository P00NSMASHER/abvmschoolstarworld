import {test,expect} from "@playwright/test";

async function waitForApp(page,path="/#today"){
  await page.goto(path);
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
}

async function openDestination(page,label){
  if(label==="Week"){
    await page.locator('.bottom-nav [data-tab="calendar"]').click();
    await page.locator('[data-route="week"]').click();
  }else if(label==="Study Games"){
    await page.goto(new URL("#games",page.url()).href);
  }else await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
  if(label==="Study"||label==="Study Games")await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
}

test("keyboard navigation reaches the skip link and all four primary destinations",async({page})=>{
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
    if(seen.size===4)break;
  }
  expect(seen).toEqual(new Set(["today","calendar","study","family"]));
});

test("Calendar remains primary while Month and Week are keyboard-accessible",async({page})=>{
  await waitForApp(page,"/#week");
  const nav=page.getByRole("navigation",{name:"App navigation"});
  const calendar=nav.getByRole("button",{name:"Calendar",exact:true});
  await expect(calendar).toHaveAttribute("aria-current","page");
  await expect(page.locator('[data-route="week"]')).toHaveAttribute("aria-pressed","true");
  await expect(page.locator('[data-day]')).toHaveCount(5);
  const views=page.getByRole("navigation",{name:"Calendar view"});
  for(const target of await views.getByRole("button").all()){
    const box=await target.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const month=views.getByRole("button",{name:"Month",exact:true});
  await month.focus();await page.keyboard.press("Enter");
  await expect(page.locator('.calendar-card')).toBeVisible();
  await expect(page.locator('[data-route="calendar"]')).toHaveAttribute("aria-pressed","true");
  await expect(page.locator('[data-route="week"]')).toHaveAttribute("aria-pressed","false");
  await expect(calendar).toHaveAttribute("aria-current","page");
  expect(new URL(page.url()).hash).toBe("#calendar");
  await views.getByRole("button",{name:"Week",exact:true}).focus();
  await page.keyboard.press("Space");
  await expect(page.locator('.day-picker')).toBeVisible();
  await expect(page.locator('[data-route="week"]')).toHaveAttribute("aria-pressed","true");
  await expect(page.locator('[data-route="calendar"]')).toHaveAttribute("aria-pressed","false");
  await expect(calendar).toHaveAttribute("aria-current","page");
  expect(new URL(page.url()).hash).toBe("#week");
});

test("subject choices, Test Prep buttons, and native disclosures work from keyboard",async({page})=>{
  await waitForApp(page,"/#study");
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready");
  const openPrep=page.locator('[data-open-prep]');
  await expect(openPrep).toBeEnabled({timeout:10000});await openPrep.focus();await page.keyboard.press('Enter');
  const chooser=page.locator('[data-test-select]').last();
  await expect(chooser).toBeEnabled();await chooser.focus();await page.keyboard.press('Space');
  await expect(chooser).toBeFocused();await expect(chooser).toHaveAttribute('aria-pressed','true');
  const back=page.locator('[data-close-prep]');await back.focus();await page.keyboard.press('Enter');
  await expect(openPrep).toBeFocused();
  for(const selector of ['details[data-study-notes]','details[data-study-test-options]']){
    const details=page.locator(selector),summary=details.locator(':scope > summary');
    await expect(details).not.toHaveAttribute('open','');
    await summary.focus();await page.keyboard.press('Enter');await expect(details).toHaveAttribute('open','');
    await expect(summary).toBeFocused();await page.keyboard.press('Enter');await expect(details).not.toHaveAttribute('open','');
  }
  for(const mode of ['reading','spelling','math','religion','mix']){
    const button=page.locator('.study-game-grid [data-game-start="'+mode+'"]');
    await expect(button).toBeEnabled();await button.focus();await page.keyboard.press('Enter');
    await expect(page.locator('.game-question-card')).toBeVisible();
    await page.locator('[data-game-home]').click();
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
  for(const label of ["Calendar","Study","Progress","Today"]){
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
    for(const tab of ["Today","Week","Calendar","Study","Study Games","Progress"]){
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
  for(const tab of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openDestination(page,tab);
    await expect(page.locator(".screen")).toBeVisible();
    await expect(page.locator(".screen h1").first()).toBeVisible();
  }
});
