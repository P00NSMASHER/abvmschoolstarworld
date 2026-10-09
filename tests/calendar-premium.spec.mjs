import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const date = new Date("2026-10-08T12:00:00-04:00");
const widths = [375, 390, 402, 430];

async function noOverflow(page, selector, width) {
  const box = await page.locator(selector).evaluate(node => ({
    viewport: node.clientWidth, scroll: node.scrollWidth
  }));
  expect(box.scroll, width + "px: " + selector + " overflows")
    .toBeLessThanOrEqual(box.viewport + 1);
}
async function capture(page, info, name, full = false) {
  if (full) {
    await page.addStyleTag({
      content: ".phone-app{display:block!important;height:auto!important;min-height:100vh!important;overflow:visible!important}.screen-stack,.calendar-screen,.week-screen{height:auto!important;overflow:visible!important}.bottom-nav{display:none!important}"
    });
  }
  await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: full, animations: "disabled" });
}
async function sealReady(page) {
  const seal = page.locator(".calendar-screen .school-mark, .week-screen .school-mark");
  await expect(seal).toBeVisible();
  await expect.poll(() => seal.evaluate(img => img.complete && img.naturalWidth >= 180)).toBe(true);
  await seal.evaluate(img => img.decode());
}

test("Month: source-backed day grid, legend and premium layout on iPhone", async ({ page }, info) => {
  await page.clock.setFixedTime(date);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 852 });
    await page.goto("/#calendar");
    await expect(page.locator(".calendar-screen")).toBeVisible();
    await expect(page.locator(".calendar-month-nav strong")).toHaveText("October 2026");
    await expect(page.locator(".calendar-grid button[data-cal-day]")).toHaveCount(31);
    await expect(page.locator(".calendar-day-card")).toContainText("Progress Reports Issued");
    await expect(page.locator(".calendar-day-card")).toContainText("Beef cheesesteak");
    await expect(page.locator(".calendar-segments [data-route=calendar]")).toHaveAttribute("aria-pressed", "true");
    await sealReady(page);
    const controls = await page.locator(".calendar-segments button,.calendar-month-nav button,.calendar-grid button").evaluateAll(nodes => nodes.map(el => {
      const b = el.getBoundingClientRect();
      return { width: b.width, height: b.height };
    }));
    for (const b of controls) {
      expect(b.width, JSON.stringify({width, b})).toBeGreaterThanOrEqual(32);
      expect(b.height, JSON.stringify({width, b})).toBeGreaterThanOrEqual(44);
    }
    const legend = page.locator(".calendar-legend");
    for (const title of ["Test", "Faith", "Family", "Due", "Lunch"]) await expect(legend).toContainText(title);
    expect(await legend.locator("i.test").evaluate(el => getComputedStyle(el, "::before").content)).toBe('"T"');
    await noOverflow(page, ".calendar-screen", width);
    if (width === 390) {
      const art = page.locator(".calendar-day-card .agenda-lunch .lunch-art img");
      await expect(art).toHaveCount(1);
      await art.scrollIntoViewIfNeeded();
      await expect.poll(() => art.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      await art.evaluate(img => img.decode());
      await page.locator(".calendar-screen").evaluate(el => { el.scrollTop = 0; });
    }
    await capture(page, info, "calendar-month-" + width + "-first");
    if (width === 390) await capture(page, info, "calendar-month-390-full", true);
  }
});

test("Week: five-day study plan and verified lunch/test information", async ({ page }, info) => {
  await page.clock.setFixedTime(date);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 852 });
    await page.goto("/#week");
    await expect(page.locator(".week-screen")).toBeVisible();
    await expect(page.locator(".week-nav strong")).toContainText("Oct 5 – 9");
    await expect(page.locator(".day-picker button")).toHaveCount(5);
    await expect(page.locator(".calendar-segments [data-route=week]")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".day-detail")).toContainText("Progress Reports Issued");
    await expect(page.locator(".day-detail")).toContainText("Read");
    await expect(page.locator(".week-overview .week-lunches .week-overview-row")).toHaveCount(5);
    await expect(page.locator(".week-overview .week-tests")).toContainText("Spelling");
    await sealReady(page);
    await noOverflow(page, ".week-screen", width);
    const controls = await page.locator(".day-picker button,.week-nav button").evaluateAll(nodes => nodes.map(el => {
      const b = el.getBoundingClientRect(); return { width: b.width, height: b.height };
    }));
    for (const b of controls) {
      expect(b.width, JSON.stringify({width, b})).toBeGreaterThanOrEqual(44);
      expect(b.height, JSON.stringify({width, b})).toBeGreaterThanOrEqual(44);
    }
    await capture(page, info, "calendar-week-" + width + "-first");
    if (width === 390) await capture(page, info, "calendar-week-390-full", true);
  }
});

test("Calendar navigation, school closure and enlarged text remain functional", async ({ page }) => {
  await page.clock.setFixedTime(date);
  await page.setViewportSize({ width: 375, height: 852 });
  await page.goto("/#calendar");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".calendar-month-nav strong")).toHaveText("November 2026");
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.locator(".calendar-month-nav strong")).toHaveText("October 2026");
  const day12 = page.locator("[data-cal-day]").filter({ hasText: /^12$/ });
  await day12.click();
  await expect(page.locator(".calendar-day-card")).toContainText("Columbus Day");
  await expect(page.locator(".calendar-day-card .agenda-lunch")).toContainText("No school lunch");
  await page.evaluate(() => { document.documentElement.style.fontSize = "34px"; });
  await noOverflow(page, ".calendar-screen", 375);
  await page.locator(".calendar-segments [data-route=week]").click();
  await expect(page.locator(".week-screen")).toBeVisible();
  await noOverflow(page, ".week-screen", 375);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  const friday = page.locator(".day-picker button").last();
  await friday.click();
  await expect(friday).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".day-detail")).toContainText("Spelling");
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.locator(".week-nav strong")).toContainText("Oct 12 – 16");
  await page.locator(".calendar-segments [data-route=calendar]").click();
  await expect(page.locator(".calendar-screen")).toBeVisible();
});
