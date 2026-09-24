import {test,expect} from "@playwright/test";

test("keyboard navigation reaches the skip link and all primary tabs",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await page.evaluate(()=>{
    document.body.setAttribute("tabindex","-1");
    document.body.focus();
  });
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.evaluate(()=>document.body.removeAttribute("tabindex"));

  const seen=[];
  for(let i=0;i<12;i++){
    await page.keyboard.press("Tab");
    const focused=await page.evaluate(()=>({
      text:(document.activeElement?.textContent||"").trim(),
      tab:document.activeElement?.getAttribute("data-tab"),
      cls:document.activeElement?.className||"",
    }));
    if(focused.tab)seen.push(focused.tab);
    if(new Set(seen).size===5)break;
  }
  expect(new Set(seen)).toEqual(new Set(["today","week","calendar","study","family"]));
});

test("native disclosure controls work from keyboard",async({page})=>{
  await page.goto("/#study");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const details=page.locator("#study-spelling");
  const summary=details.locator("summary");
  await summary.focus();
  await expect(summary).toBeFocused();
  const before=await details.getAttribute("open");
  await page.keyboard.press("Enter");
  if(before===null) await expect(details).toHaveAttribute("open","");
  else await expect(details).not.toHaveAttribute("open","");
});

test("calendar and checklist controls expose useful spoken state",async({page})=>{
  await page.goto("/#calendar");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const day=page.locator("[data-cal-day]").first();
  await expect(day).toHaveAttribute("aria-label",/.+/);
  await expect(day).toHaveAttribute("aria-pressed",/true|false/);

  await page.getByRole("button",{name:"Family",exact:true}).click();
  const familyCheck=page.locator("[data-family-check]").first();
  if(await familyCheck.count()){
    await expect(familyCheck).toHaveAttribute("aria-label",/Mark complete|Completed/);
    await expect(familyCheck).toHaveAttribute("aria-pressed",/true|false/);
  }
  await expect(page.locator("#family-current-notices")).toHaveRole("heading");
  await expect(page.locator(".static-notice-list").first()).toHaveAttribute("role","list");
});

test("screen changes and status messages have live-region semantics",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator("#app-content")).toHaveAttribute("aria-live","polite");
  await expect(page.locator("#toast")).toHaveAttribute("role","status");
  await expect(page.locator("#toast")).toHaveAttribute("aria-live","polite");
});

test("200 percent visual zoom does not create horizontal page overflow",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await page.evaluate(()=>{document.documentElement.style.zoom="2"});
  for(const tab of ["Today","Week","Calendar","Study","Family"]){
    await page.getByRole("button",{name:tab,exact:true}).click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
    expect(overflow,`${tab} overflows at 200% zoom`).toBeFalsy();
  }
});

test("heading and landmark semantics stay coherent",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  for(const tab of ["Today","Week","Calendar","Study","Family"]){
    await page.getByRole("button",{name:tab,exact:true}).click();
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("navigation",{name:"App navigation"})).toHaveCount(1);
    await expect(page.locator(".screen h1").first()).toBeVisible();
  }
});
