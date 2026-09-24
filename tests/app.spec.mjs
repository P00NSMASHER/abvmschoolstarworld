import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openTab(page,label){
  await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
}

test.beforeEach(async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
});

test("all primary tabs render without horizontal overflow",async({page})=>{
  for(const label of ["Today","Week","Calendar","Study","Family"]){
    await openTab(page,label);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow,label+" has horizontal overflow").toBeFalsy();
  }
});

test("calendar controls remain interactive",async({page})=>{
  await openTab(page,"Calendar");
  const heading=page.locator(".calendar-heading h2");
  const initial=(await heading.textContent())?.trim();
  await page.getByRole("button",{name:"Next month"}).click();
  await expect(heading).not.toHaveText(initial||"");
  await page.getByRole("button",{name:"Previous month"}).click();
  await page.getByRole("button",{name:"List View"}).click();
  await expect(page.locator(".calendar-list-panel.active")).toBeVisible();
  await page.getByRole("button",{name:"Month View"}).click();
  await expect(page.locator(".calendar-month-panel.active")).toBeVisible();
  const firstDay=page.locator("[data-cal-day]").first();
  await firstDay.click();
  await expect(firstDay).toHaveAttribute("aria-pressed","true");
});

test("study jump controls open their target sections",async({page})=>{
  await openTab(page,"Study");
  const before=await page.evaluate(()=>document.querySelector(".screen")?.scrollTop||window.scrollY);
  await page.locator('[data-study-jump="study-math"]').click();
  await expect(page.locator("#study-math")).toHaveAttribute("open","");
  const after=await page.evaluate(()=>document.querySelector(".screen")?.scrollTop||window.scrollY);
  expect(after).toBeGreaterThanOrEqual(before);
});

test("family notices are static and checklist semantics are explicit",async({page})=>{
  await openTab(page,"Family");
  await expect(page.locator("#family-current-notices")).toBeVisible();
  await expect(page.locator("details").filter({has:page.locator("#family-current-notices")})).toHaveCount(0);
  await expect(page.getByText("Progress is saved on this device.").first()).toBeVisible();
  const check=page.locator("[data-family-check]").first();
  if(await check.count()){
    await expect(check).toHaveAttribute("aria-pressed",/true|false/);
    await expect(check).toHaveAttribute("aria-label",/Mark complete|Completed/);
  }
});

test("desktop uses native page flow and a left navigation rail",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop","Desktop-only layout assertion");
  const layout=await page.evaluate(()=>{
    const nav=document.querySelector(".bottom-nav");
    const screen=document.querySelector(".screen");
    const app=document.querySelector(".phone-app");
    const ns=getComputedStyle(nav),ss=getComputedStyle(screen),as=getComputedStyle(app);
    return{navDisplay:ns.display,navPosition:ns.position,screenOverflow:ss.overflowY,appHeight:as.height,bodyScroll:document.body.scrollHeight};
  });
  expect(layout.navDisplay).toBe("flex");
  expect(layout.navPosition).toBe("sticky");
  expect(layout.screenOverflow).toBe("visible");
  expect(layout.bodyScroll).toBeGreaterThan(700);
});

test("no serious or critical automated accessibility violations",async({page})=>{
  for(const label of ["Today","Calendar","Study","Family"]){
    await openTab(page,label);
    const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze();
    const severe=result.violations.filter(v=>v.impact==="serious"||v.impact==="critical");
    expect(severe,label+" accessibility violations: "+severe.map(v=>v.id).join(", ")).toEqual([]);
  }
});
