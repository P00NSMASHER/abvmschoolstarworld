import {test,expect} from "@playwright/test";

async function waitForApp(page,path){
  await page.goto(path);
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
}

test("primary views expose stable screen-reader regions and navigation state",async({page})=>{
  await waitForApp(page,"/#today");
  const tabs=[
    ["Today","Today"],
    ["Week","This week"],
    ["Calendar",/calendar/i],
    ["Study","Study room"],
    ["Family","Family dashboard"],
  ];
  for(const [tab,regionName] of tabs){
    await page.getByRole("button",{name:tab,exact:true}).click();
    await expect(page.getByRole("button",{name:tab,exact:true})).toHaveAttribute("aria-current","page");
    await expect(page.getByRole("region",{name:regionName})).toBeVisible();
    const other=page.locator('.bottom-nav button[data-tab]:not([aria-current="page"])');
    await expect(other).toHaveCount(4);
  }
});

test("calendar announces full dates, selection, and view state",async({page})=>{
  await waitForApp(page,"/#calendar");
  const selected=page.locator('[data-cal-day][aria-pressed="true"]').first();
  await expect(selected).toHaveAttribute("aria-label",/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}/);
  await expect(page.getByRole("button",{name:"Month View"})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"List View"}).click();
  await expect(page.getByRole("button",{name:"List View"})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("button",{name:"Month View"})).toHaveAttribute("aria-pressed","false");
});

test("Week day buttons expose date and selected state to assistive technology",async({page})=>{
  await waitForApp(page,"/#week");
  const days=page.locator("[data-day]");
  await expect(days).toHaveCount(5);
  for(let i=0;i<5;i++){
    await expect(days.nth(i)).toHaveAttribute("aria-label",/(Monday|Tuesday|Wednesday|Thursday|Friday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}/);
    await expect(days.nth(i)).toHaveAttribute("aria-pressed",/true|false/);
  }
});

test("checklist names communicate both action and completion state",async({page})=>{
  await waitForApp(page,"/#today");
  const check=page.locator("[data-check]").first();
  await expect(check).toBeVisible();
  const original=await check.getAttribute("aria-pressed");
  const originalLabel=await check.getAttribute("aria-label");
  expect(originalLabel).toMatch(/Mark complete|Completed/);
  await check.click();
  const after=page.locator("[data-check]").first();
  await expect(after).toHaveAttribute("aria-pressed",original==="true"?"false":"true");
  const changedLabel=await after.getAttribute("aria-label");
  expect(changedLabel).not.toBe(originalLabel);
  await after.click();
  await expect(page.locator("[data-check]").first()).toHaveAttribute("aria-pressed",original||"false");
});

test("Family notices are exposed as heading plus list rather than controls",async({page})=>{
  await waitForApp(page,"/#family");
  const heading=page.getByRole("heading",{name:"Current notices"});
  await expect(heading).toBeVisible();
  const section=heading.locator("xpath=..");
  await expect(section.getByRole("list")).toHaveCount(1);
  await expect(section.getByRole("button")).toHaveCount(0);
});

test("freshness and toast status regions remain available to screen readers",async({page})=>{
  await waitForApp(page,"/#today");
  await expect(page.locator("#app-content")).toHaveAttribute("aria-live","polite");
  await expect(page.locator("#toast")).toHaveAttribute("role","status");
  await expect(page.locator("#toast")).toHaveAttribute("aria-live","polite");
  await expect(page.locator(".freshness")).toContainText(/Checked|Verified/);
});
