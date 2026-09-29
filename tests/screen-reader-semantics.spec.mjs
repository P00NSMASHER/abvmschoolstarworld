import {test,expect} from "@playwright/test";

async function waitForApp(page,path){
  await page.goto(path);
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
}

test("primary views expose stable regions and navigation state",async({page})=>{
  await waitForApp(page,"/#today");
  const tabs=[
    ["Today","Today"],["Week","This week"],["Calendar",/calendar/i],
    ["Study","Study room"],["Study Games","Study games"],["Family","Family dashboard"]
  ];
  for(const [tab,regionName] of tabs){
    await page.getByRole("button",{name:tab,exact:true}).click();
    await expect(page.getByRole("button",{name:tab,exact:true})).toHaveAttribute("aria-current","page");
    await expect(page.getByRole("region",{name:regionName})).toBeVisible({timeout:10_000});
    await expect(page.locator('.bottom-nav button[data-tab]:not([aria-current="page"])')).toHaveCount(5);
  }
});

test("Week day controls retain useful visible accessible names",async({page})=>{
  await waitForApp(page,"/#week");
  const days=page.locator("[data-day]");
  await expect(days).toHaveCount(5);
  for(let i=0;i<5;i++){
    const name=(await days.nth(i).innerText()).trim();
    expect(name).toMatch(/Mon|Tue|Wed|Thu|Fri/);
    expect(name).toMatch(/\d{1,2}/);
  }
});

test("Calendar date controls remain buttons with visible day numbers",async({page})=>{
  await waitForApp(page,"/#calendar");
  const days=page.locator("[data-cal-day]");
  expect(await days.count()).toBeGreaterThan(27);
  for(let i=0;i<Math.min(5,await days.count());i++){
    await expect(days.nth(i)).toHaveRole("button");
    expect((await days.nth(i).innerText()).trim()).toMatch(/\d+/);
  }
});

test("checklist controls communicate action text and completion visually",async({page})=>{
  await waitForApp(page,"/#today");
  const check=page.locator("[data-check]").first();
  await expect(check).toBeVisible();
  const label=(await check.innerText()).trim();
  expect(label.length).toBeGreaterThan(3);
  const before=await check.evaluate(el=>el.classList.contains("is-done"));
  await check.click();
  const after=await page.locator("[data-check]").first().evaluate(el=>el.classList.contains("is-done"));
  expect(after).toBe(!before);
});

test("Family notices are static information rather than accidental controls",async({page})=>{
  await waitForApp(page,"/#family");
  await expect(page.getByRole("heading",{name:"Current notices"})).toBeVisible();
  await expect(page.locator(".notices-card .notice-row").first()).toBeVisible();
  await expect(page.locator(".notices-card button")).toHaveCount(0);
});

test("freshness and toast status remain available to assistive technology",async({page})=>{
  await waitForApp(page,"/#today");
  await expect(page.locator("#toast")).toHaveAttribute("role","status");
  await expect(page.locator("#toast")).toHaveAttribute("aria-live","polite");
  const freshness=page.locator(".freshness");
  await expect(freshness).toContainText(/Verified|Older data|Needs refresh|Offline|Source verification unavailable/);
  await expect(freshness).toHaveRole("button");
  await expect(freshness).toHaveAttribute("aria-label",/Refresh school information/);
});
