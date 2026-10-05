import {test,expect} from "@playwright/test";

test("one missing same-day bank does not hide supported targeted practice",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-05T16:00:00-04:00"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.sourceHash=String(fixture.pack.sourceHash||"current")+"-partial-test-prep";
  fixture.pack.importantDates=[
    {date:"Friday, Oct. 9",label:"Grammar (subject & predicate)",kind:"test"},
    {date:"Friday, Oct. 9",label:"Science test",kind:"test"}
  ];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#study");
  await expect(page.locator('[data-study-state="ready"]')).toBeVisible({timeout:10_000});
  await expect(page.locator(".hub-prep")).toContainText("Grammar (subject & predicate)");
  await expect(page.locator(".hub-prep")).toContainText("Science test");
  await expect(page.locator(".hub-prep .hub-caption")).toContainText("Review the teacher notes below for Science test");
  await expect(page.getByRole("button",{name:/Practice Grammar \(subject & predicate\)/i})).toBeVisible();
  await expect(page.getByRole("button",{name:/Practice Science/i})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Start test practice/i})).toHaveCount(0);

  await page.getByRole("button",{name:/Practice Grammar \(subject & predicate\)/i}).click();
  await expect(page.locator(".hub-round")).toBeVisible();
  await expect(page.locator(".hub-row")).toContainText("Grammar (subject & predicate) practice");
  await expect(page.locator(".hub-round")).not.toContainText("Science test");
  await context.close();
});
