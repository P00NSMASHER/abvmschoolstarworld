import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });
const SCHOOL_DATE = new Date("2026-10-08T12:00:00-04:00");

test("Premium Today, Calendar, Study, Test Prep and Progress form one coherent iPhone journey",async({page},info)=>{
  test.setTimeout(90_000);
  await page.clock.setFixedTime(SCHOOL_DATE);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:390,height:852});
  await page.goto("/#today");
  await expect(page.locator(".today-screen")).toBeVisible();
  await expect(page.locator(".school-photo-hero")).toContainText("Ready for today?");
  await expect(page.locator(".today-primary .priority-card")).toContainText("Spelling");
  await page.locator(".bottom-nav [data-tab=calendar]").click();
  await expect(page.locator(".calendar-screen")).toBeVisible();
  await expect(page.locator(".calendar-month-nav strong")).toHaveText("October 2026");
  await page.locator(".calendar-segments [data-route=week]").click();
  await expect(page.locator(".week-screen .day-picker button")).toHaveCount(5);
  await page.locator(".bottom-nav [data-tab=study]").click();
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:15000});
  await expect(page.locator(".study-game-grid > button")).toHaveCount(5);
  await expect(page.locator("[data-open-prep]")).toBeVisible();
  await page.locator("[data-open-prep]").click();
  await expect(page.locator(".prep-header")).toBeVisible();
  await expect(page.locator(".prep-test-choice")).not.toHaveCount(0);
  await page.locator("[data-close-prep]").click();
  await expect(page.locator(".study-game-grid > button")).toHaveCount(5);
  await page.locator(".bottom-nav [data-tab=family]").click();
  const screen=page.locator(".progress-screen");
  await expect(screen).toBeVisible();
  await expect(screen.locator(".rank-current")).toContainText("Eaglet");
  await expect(screen.locator(".study-badge-grid > li")).toHaveCount(21);
  const rail=screen.locator(".study-badge-grid");
  await expect(rail).toHaveAttribute("tabindex","0");
  await expect(rail).toHaveAttribute("aria-label",/scroll horizontally/);
  const metrics=await rail.evaluate(el=>({
    scroll:el.scrollWidth,client:el.clientWidth,overflow:getComputedStyle(el).overflowX
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client+100);
  expect(metrics.overflow).toBe("auto");
  const spelling=screen.locator(".learning-subject").filter({hasText:/Spelling/i}).first();
  await expect(spelling.locator(".feature-icon")).toHaveClass(/spelling/);
  expect(await screen.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await screen.evaluate(el=>{el.scrollTop=0});
  const shot=info.outputPath("integrated-premium-progress-390-first.png");
  await page.screenshot({path:shot,animations:"disabled"});
  await info.attach("integrated-progress-first",{path:shot,contentType:"image/png"});
  await page.locator(".bottom-nav [data-tab=study]").click();
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready");
});

test("Study and Progress stay usable with enlarged text and existing saved milestones",async({page})=>{
  test.setTimeout(90_000);
  await page.clock.setFixedTime(SCHOOL_DATE);
  await page.setViewportSize({width:375,height:852});
  await page.goto("/#family");
  await expect(page.locator(".progress-screen .study-badge-grid li")).toHaveCount(21);
  await page.evaluate(()=>{document.documentElement.style.fontSize="34px"});
  expect(await page.locator(".progress-screen").evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await page.locator(".bottom-nav [data-tab=study]").click();
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:15000});
  expect(await page.locator(".games-screen").evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(()=>{document.documentElement.style.fontSize=""});
});
