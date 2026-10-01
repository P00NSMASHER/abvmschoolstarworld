import {test,expect} from "@playwright/test";

async function openCalendar(page){
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
}
function day(page,isoDate){return page.locator('[data-cal-day^="'+isoDate+'"]')}
async function openSeptemberCalendar(page){
  await page.clock.setFixedTime(new Date("2026-09-15T16:00:00Z"));
  await openSeptemberCalendar(page);
}

test("busy Sept 30 keeps all independently verified events visible",async({page})=>{
  await openSeptemberCalendar(page);
  const button=day(page,"2026-09-30");
  await expect(button).toBeVisible();
  await button.click();
  const card=page.locator(".calendar-day-card");
  await expect(card).toContainText("Mass");
  await expect(card).toContainText("Communication Folder");
  await expect(card).toContainText("Chick-fil-A sale starts");
  await expect(card).toContainText("Grammar");
});

test("multi-day STAR range applies at both ends",async({page})=>{
  await openSeptemberCalendar(page);
  for(const iso of ["2026-09-21","2026-09-25"]){
    const button=day(page,iso);await button.click();
    await expect(page.locator(".calendar-day-card")).toContainText(/STAR testing/i);
  }
});

test("regular date gives a calm empty state",async({page})=>{
  await openSeptemberCalendar(page);
  const button=day(page,"2026-09-14");
  await button.click();
  await expect(page.locator(".calendar-day-card")).toBeVisible();
  await expect(page.locator(".calendar-empty")).toContainText(/No special school events/i);
});

test("month agenda includes every school weekday and lunch state",async({page})=>{
  await openSeptemberCalendar(page);
  expect(await page.locator(".agenda-day").count()).toBeGreaterThan(15);
  await expect(page.locator(".month-agenda")).toContainText("Lunch");
  await expect(page.locator(".agenda-lunch").first()).toBeVisible();
});

test("busy date and month agenda do not cause horizontal overflow",async({page})=>{
  await openSeptemberCalendar(page);
  await day(page,"2026-09-30").click();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});

test("next-month summary exposes upcoming October school items",async({page})=>{
  await openCalendar(page);
  const card=page.locator(".next-month-card");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("October");
  const text=await card.textContent();
  expect(text||"").toMatch(/Picture Day|Business Casual|HSA|Spelling/);
});


test("school-year date parsing crosses December into January in the actual app",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-12-31T17:00:00Z"));
  await page.goto("http://127.0.0.1:4173/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
  await page.locator('[data-cal-day^="2026-12-31"]').click();
  await expect(page.locator(".calendar-day-card")).toContainText("Christmas Holiday");
  await page.getByRole("button",{name:"Next month"}).click();
  await page.locator('[data-cal-day^="2027-01-01"]').click();
  await expect(page.locator(".calendar-day-card")).toContainText("New Year");
  await context.close();
});
