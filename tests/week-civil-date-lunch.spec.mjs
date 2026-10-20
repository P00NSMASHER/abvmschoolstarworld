import {test,expect} from "@playwright/test";

// The school is in Eastern time. Treat dates as civil days, not UTC instants.
test.use({timezoneId:"America/New_York",serviceWorkers:"block"});

async function openWeek(page,instant="2026-10-20T16:00:00Z"){
  await page.clock.setFixedTime(new Date(instant));
  await page.goto("/#week");
  // Same-URL navigation may retain the existing document after a clock jump.
  await page.reload();
  await expect(page.locator(".day-picker")).toBeVisible();
}

async function selectExactDay(page,key,expectedHeading){
  const button=page.locator('.day-picker [data-day="'+key+'"]');
  await expect(button).toHaveCount(1);
  await button.click();
  await expect(button).toHaveClass(/active/);
  await expect(button).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".day-picker button.active")).toHaveCount(1);
  await expect(page.locator(".day-detail-title h2")).toHaveText(expectedHeading);
}

test("reviewed closure overrides Oct 20 menu without shifting Oct 21",async({page})=>{
  await openWeek(page);
  const response=await page.request.get("/data/study-pack.json");
  expect(response.ok()).toBe(true);
  const {pack}=await response.json();
  const datedLunches=new Map((pack.lunchArchive||[]).map(row=>[row.date,row]));
  const menu20=datedLunches.get("2026-10-20");
  const menu21=datedLunches.get("2026-10-21");
  expect(menu20?.items).toContain("Hot ham & cheese");
  expect(menu21?.items).toContain("Pasta with meatballs");
  const reviewedClosures=(pack.importantDates||[]).filter(row=>
    row.date==="Tuesday, Oct. 20"&&row.source==="uploaded-notice"&&/No School/i.test(row.label));
  expect(reviewedClosures.length).toBeGreaterThan(0);

  await selectExactDay(page,"2026-10-21","Wednesday, October 21");
  const lunch=page.locator(".lunch-card");
  for(const item of menu21.items)await expect(lunch).toContainText(item);
  await expect(lunch).not.toContainText(/No school lunch|Hot ham & cheese/i);

  await selectExactDay(page,"2026-10-20","Tuesday, October 20");
  await expect(page.locator(".day-detail-title > span")).toHaveText("No school");
  await expect(lunch).toContainText("No school lunch");
  for(const item of menu20.items)await expect(lunch).not.toContainText(item);
  for(const item of menu21.items)await expect(lunch).not.toContainText(item);

  await selectExactDay(page,"2026-10-21","Wednesday, October 21");
  for(const item of menu21.items)await expect(lunch).toContainText(item);
  await expect(lunch).not.toContainText("No school lunch");
});

test("week picker selects all five civil dates, including DST transition week",async({page})=>{
  await openWeek(page);
  for(const [key,heading] of [
    ["2026-10-19","Monday, October 19"],
    ["2026-10-20","Tuesday, October 20"],
    ["2026-10-21","Wednesday, October 21"],
    ["2026-10-22","Thursday, October 22"],
    ["2026-10-23","Friday, October 23"]
  ])await selectExactDay(page,key,heading);
  // The first school week after the November daylight-saving transition.
  await openWeek(page,"2026-11-02T17:00:00Z");
  await selectExactDay(page,"2026-11-03","Tuesday, November 3");
  await selectExactDay(page,"2026-11-02","Monday, November 2");
});
