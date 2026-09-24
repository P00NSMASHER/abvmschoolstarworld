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
  const focusStyle=await page.locator(".skip-link").evaluate(el=>{
    const style=getComputedStyle(el);
    return{outlineStyle:style.outlineStyle,outlineWidth:parseFloat(style.outlineWidth)||0};
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
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

test("125, 150, and 200 percent visual zoom preserve app reflow",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  for(const zoom of [1.25,1.5,2]){
    await page.evaluate(value=>{document.documentElement.style.zoom=String(value)},zoom);
    for(const tab of ["Today","Week","Calendar","Study","Family"]){
      await page.getByRole("button",{name:tab,exact:true}).click();
      const metrics=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
        activeVisible:Boolean(document.querySelector(".screen")?.getBoundingClientRect().height),
      }));
      expect(metrics.overflow,`${tab} overflows at ${Math.round(zoom*100)}% zoom`).toBeFalsy();
      expect(metrics.activeVisible).toBeTruthy();
    }
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


test("calendar and checklist actions work from the keyboard and restore state",async({page})=>{
  await page.goto("/#calendar");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const heading=page.locator(".calendar-heading h2");
  const before=(await heading.textContent())?.trim();
  const next=page.getByRole("button",{name:"Next month"});
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(heading).not.toHaveText(before||"");

  await page.getByRole("button",{name:"Family",exact:true}).click();
  const check=page.locator("[data-family-check]").first();
  if(await check.count()){
    const original=await check.getAttribute("aria-pressed");
    await check.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-family-check]").first()).toHaveAttribute("aria-pressed",original==="true"?"false":"true");
    await page.locator("[data-family-check]").first().focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-family-check]").first()).toHaveAttribute("aria-pressed",original||"false");
  }
});
