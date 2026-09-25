import {test,expect} from "@playwright/test";

async function openTab(page,label){
  await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
}

test.beforeEach(async({page})=>{
  await page.goto("/?rollback=gold#today");
});

test("gold-standard app boots without runtime errors",async({page})=>{
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.reload();
  await page.waitForTimeout(1500);
  expect(errors,errors.join("\n")).toEqual([]);
  await expect(page.locator(".screen")).toBeVisible({timeout:10000});
});

test("historical gold-standard visual hierarchy is restored",async({page})=>{
  await expect(page.locator(".app-header h1")).toBeVisible();
  await expect(page.locator(".today-panel")).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeVisible();

  await openTab(page,"Week");
  await expect(page.locator(".app-header h1")).toHaveText(/This week/i);
  await expect(page.locator(".day-picker")).toBeVisible();
  await expect(page.locator(".day-detail")).toBeVisible();

  await openTab(page,"Calendar");
  await expect(page.locator(".app-header p")).toContainText("SCHOOL MONTH AT A GLANCE");
  await expect(page.getByText("Tap any date")).toBeVisible();
  await expect(page.locator(".calendar-card")).toBeVisible();

  await openTab(page,"Study");
  await expect(page.locator(".app-header p")).toContainText("SMALL STEPS, CALM PRACTICE");
  await expect(page.locator(".study-intro")).toBeVisible();
  await expect(page.locator(".study-at-a-glance")).toBeVisible();

  await openTab(page,"Family");
  await expect(page.locator(".app-header h1")).toHaveText(/Family dashboard/i);
  await expect(page.locator(".family-hero")).toBeVisible();
  await expect(page.locator(".family-stats")).toBeVisible();
});

test("historical layout remains phone-safe and interactive",async({page})=>{
  for(const label of ["Today","Week","Calendar","Study","Family"]){
    await openTab(page,label);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow,label+" has horizontal overflow").toBeFalsy();
  }
  await openTab(page,"Week");
  const days=page.locator("[data-day]");
  if(await days.count()>1){
    await days.nth(1).click();
    await expect(days.nth(1)).toHaveClass(/active/);
  }
  await openTab(page,"Calendar");
  const dates=page.locator("[data-cal-day]");
  if(await dates.count()>5){
    await dates.nth(5).click();
    await expect(dates.nth(5)).toHaveClass(/active/);
  }
});
