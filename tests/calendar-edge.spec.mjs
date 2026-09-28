import {test,expect} from "@playwright/test";

async function openCalendar(page){
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
}
function day(page,isoDate){return page.locator('[data-cal-day^="'+isoDate+'"]')}

test("busy Sept 30 keeps all independently verified events visible",async({page})=>{
  await openCalendar(page);
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
  await openCalendar(page);
  for(const iso of ["2026-09-21","2026-09-25"]){
    const button=day(page,iso);await button.click();
    await expect(page.locator(".calendar-day-card")).toContainText(/STAR testing/i);
  }
});

test("regular date gives a calm empty state",async({page})=>{
  await openCalendar(page);
  const button=day(page,"2026-09-14");
  await button.click();
  await expect(page.locator(".calendar-day-card")).toBeVisible();
  await expect(page.locator(".calendar-empty")).toContainText(/No special school events/i);
});

test("month agenda includes every school weekday and lunch state",async({page})=>{
  await openCalendar(page);
  expect(await page.locator(".agenda-day").count()).toBeGreaterThan(15);
  await expect(page.locator(".month-agenda")).toContainText("Lunch");
  await expect(page.locator(".agenda-lunch").first()).toBeVisible();
});

test("busy date and month agenda do not cause horizontal overflow",async({page})=>{
  await openCalendar(page);
  await day(page,"2026-09-30").click();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});

test("next-month summary exposes upcoming October school items",async({page})=>{
  await openCalendar(page);
  await expect(page.locator(".next-month-card")).toContainText("October");
  const text=await page.locator(".next-month-card").innerText();
  expect(text).toMatch(/Picture Day|Business Casual|HSA|Spelling/);
});
