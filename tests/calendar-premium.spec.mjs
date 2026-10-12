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
    // Verify actual glyph geometry, not just the month grid container.
    // Busy days may wrap markers; none may shrink or protrude outside a date.
    const markers = await page.locator(".calendar-grid button[data-cal-day]").evaluateAll(buttons =>
      buttons.map(button => {
        const parent = button.getBoundingClientRect();
        const children = Array.from(button.querySelectorAll(".calendar-mark"));
        return {
          date: button.querySelector("strong")?.textContent,
          gridOverflow: button.scrollWidth - button.clientWidth,
          icons: children.map(icon => {
            const rect = icon.getBoundingClientRect();
            return {
              left: rect.left - parent.left,
              right: rect.right - parent.left,
              top: rect.top - parent.top,
              bottom: rect.bottom - parent.top,
              width: rect.width,
              height: rect.height,
              font: parseFloat(getComputedStyle(icon).fontSize)
            };
          }),
          parentWidth: parent.width
        };
      })
    );
    expect(markers.some(day => day.icons.length === 3)).toBe(true);
    for (const day of markers) {
      expect(day.gridOverflow, width + "px calendar date " + day.date).toBeLessThanOrEqual(1);
      for (const icon of day.icons) {
        const context = JSON.stringify({ width, date: day.date, icon });
        expect(icon.width, context).toBeGreaterThanOrEqual(14);
        expect(icon.height, context).toBeGreaterThanOrEqual(14);
        expect(icon.font, context).toBeGreaterThanOrEqual(10);
        expect(icon.left, context).toBeGreaterThanOrEqual(-1);
        expect(icon.right, context).toBeLessThanOrEqual(day.parentWidth + 1);
      }
      for (let i = 0; i < day.icons.length; i++) {
        for (let j = i + 1; j < day.icons.length; j++) {
          const a = day.icons[i], b = day.icons[j];
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          expect(overlapX > 1 && overlapY > 1, "Overlapping markers on " + day.date).toBe(false);
        }
      }
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
    // The Week meal illustration is lazy-loaded below the initial viewport.
    // Capture its real rendered pixels instead of a transient blank frame.
    if (width === 390) {
      const art = page.locator(".week-screen .week-rail .lunch-art img");
      await expect(art).toHaveCount(1);
      await art.scrollIntoViewIfNeeded();
      await expect.poll(() => art.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      await art.evaluate(img => img.decode());
      await page.locator(".week-screen").evaluate(el => { el.scrollTop = 0; });
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
  // Month retained October 12; explicitly return to the current week before
  // verifying this week's spelling and the next-week navigation.
  await page.getByRole("button", { name: "Back to this week" }).click();
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

test("Month and Week keyboard selections preserve the reading position and focused control", async ({ page }) => {
  await page.clock.setFixedTime(date);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-screen")).toBeVisible();

  const monthScreen = page.locator(".calendar-screen");
  const scrollMonth = async () => monthScreen.evaluate(el => el.scrollTop);
  await monthScreen.evaluate(el => { el.scrollTop = 120; });
  const monthBefore = await scrollMonth();
  expect(monthBefore).toBeGreaterThan(40);

  const day12 = page.locator(".calendar-grid button[data-cal-day]").nth(11);
  await day12.evaluate(el => el.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect(day12).toBeFocused();
  await expect(day12).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".calendar-day-card")).toContainText("Columbus Day");
  expect(Math.abs(await scrollMonth() - monthBefore)).toBeLessThanOrEqual(2);

  const nextMonth = page.getByRole("button", { name: "Next month" });
  await nextMonth.evaluate(el => el.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect(page.locator(".calendar-month-nav strong")).toHaveText("November 2026");
  await expect(nextMonth).toBeFocused();
  expect(Math.abs(await scrollMonth() - monthBefore)).toBeLessThanOrEqual(2);

  await page.goto("/#week");
  // Start a fresh Week screen for this isolated focus/scroll test. The
  // preceding Month interaction intentionally retains its browsing date.
  await page.reload();
  const weekScreen = page.locator(".week-screen");
  await expect(weekScreen).toBeVisible();
  const scrollWeek = async () => weekScreen.evaluate(el => el.scrollTop);
  await weekScreen.evaluate(el => { el.scrollTop = 120; });
  const weekBefore = await scrollWeek();
  expect(weekBefore).toBeGreaterThan(40);

  const friday = page.locator(".day-picker button").last();
  await friday.evaluate(el => el.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect(friday).toBeFocused();
  await expect(friday).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".day-detail")).toContainText("Spelling");
  expect(Math.abs(await scrollWeek() - weekBefore)).toBeLessThanOrEqual(2);

  const nextWeek = page.getByRole("button", { name: "Next week" });
  await nextWeek.evaluate(el => el.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect(page.locator(".week-nav strong")).toContainText("Oct 12 – 16");
  await expect(nextWeek).toBeFocused();
  expect(Math.abs(await scrollWeek() - weekBefore)).toBeLessThanOrEqual(2);
});

test("Month and Week retain the chosen weekday across their view switch, including another month", async ({ page }) => {
  await page.clock.setFixedTime(date);
  await page.setViewportSize({ width: 390, height: 852 });
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-screen")).toBeVisible();
  await page.locator(".calendar-grid button[data-cal-day]").nth(15).click(); // October 16
  await expect(page.locator(".calendar-day-heading")).toContainText("October 16");
  await page.locator(".calendar-segments [data-route=week]").click();
  await expect(page.locator(".week-nav strong")).toContainText("Oct 12 – 16");
  await expect(page.locator(".day-picker button[aria-pressed=true] strong")).toHaveText("16");
  await page.locator(".calendar-segments [data-route=calendar]").click();
  await expect(page.locator(".calendar-month-nav strong")).toHaveText("October 2026");
  await expect(page.locator(".calendar-grid button.active strong")).toHaveText("16");

  await page.getByRole("button", { name: "Next month" }).click();
  await page.locator(".calendar-grid button[data-cal-day]").nth(5).click(); // November 6
  await page.locator(".calendar-segments [data-route=week]").click();
  await expect(page.locator(".week-nav strong")).toContainText("Nov 2 – 6");
  await expect(page.locator(".day-picker button[aria-pressed=true] strong")).toHaveText("6");
  await page.locator(".calendar-segments [data-route=calendar]").click();
  await expect(page.locator(".calendar-month-nav strong")).toHaveText("November 2026");
  await expect(page.locator(".calendar-grid button.active strong")).toHaveText("6");
});

test("Today's gold date is distinct from the selected day and is announced as current", async ({ page }) => {
  await page.clock.setFixedTime(date);
  await page.setViewportSize({ width: 375, height: 852 });
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-grid button[aria-current=date] strong")).toHaveText("8");
  await page.locator(".calendar-grid button[data-cal-day]").nth(11).click(); // October 12
  await expect(page.locator(".calendar-grid button.active strong")).toHaveText("12");
  await expect(page.locator(".calendar-grid button[aria-current=date]")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".calendar-grid button[aria-current=date]")).toHaveClass(/is-today/);
  await noOverflow(page, ".calendar-screen", 375);
});

test("Bottom Calendar navigation retains the Week date, and weekend selection maps to the school week", async ({ page }) => {
  await page.clock.setFixedTime(date);
  await page.setViewportSize({ width: 390, height: 852 });
  await page.goto("/#week");
  await expect(page.locator(".week-screen")).toBeVisible();

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.locator(".week-nav strong")).toContainText("Oct 12 – 16");
  await page.locator(".day-picker button").nth(3).click(); // Thursday, Oct 15
  await page.locator(".bottom-nav button[data-tab=calendar]").click();
  await expect(page.locator(".calendar-month-nav strong")).toHaveText("October 2026");
  await expect(page.locator(".calendar-grid button.active strong")).toHaveText("15");
  await expect(page.locator(".calendar-day-heading")).toContainText("October 15");

  await page.locator(".calendar-grid button[data-cal-day]").nth(17).click(); // Sunday, Oct 18
  await expect(page.locator(".calendar-grid button.active strong")).toHaveText("18");
  await page.locator(".calendar-segments [data-route=week]").click();
  await expect(page.locator(".week-nav strong")).toContainText("Oct 12 – 16");
  await expect(page.locator(".day-picker button[aria-pressed=true] strong")).toHaveText("12");
  await page.locator(".bottom-nav button[data-tab=calendar]").click();
  await expect(page.locator(".calendar-grid button.active strong")).toHaveText("12");
});

test("Selected-day actions scroll fully clear of the bottom bar on compact phones", async ({ page }, info) => {
  await page.clock.setFixedTime(date);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/#calendar");
    await expect(page.locator(".calendar-screen")).toBeVisible();
    const action = page.locator(".calendar-study-action");
    await action.evaluate(node => node.scrollIntoView({ block: "center" }));
    await expect(action).toBeVisible();
    const month = await page.evaluate(() => {
      const nav = document.querySelector(".bottom-nav").getBoundingClientRect();
      const action = document.querySelector(".calendar-study-action").getBoundingClientRect();
      const screen = document.querySelector(".calendar-screen");
      return { navTop: nav.top, actionTop: action.top, actionBottom: action.bottom, scrolled: screen.scrollTop };
    });
    expect(month.scrolled, JSON.stringify({ viewport, month })).toBeGreaterThan(0);
    expect(month.actionTop, JSON.stringify({ viewport, month })).toBeGreaterThanOrEqual(0);
    expect(month.actionBottom, JSON.stringify({ viewport, month })).toBeLessThanOrEqual(month.navTop - 2);
    await page.screenshot({ path: info.outputPath(`calendar-clearance-${viewport.width}x${viewport.height}-month.png`), animations: "disabled" });

    // Navigate to a fresh Week view so the selected school date is deterministic.
    await page.goto("/#week");
    await page.reload();
    await expect(page.locator(".week-screen")).toBeVisible();
    const task = page.locator(".day-detail .check-item").first();
    await expect(task).toBeVisible();
    await task.evaluate(node => node.scrollIntoView({ block: "center" }));
    const week = await page.evaluate(() => {
      const nav = document.querySelector(".bottom-nav").getBoundingClientRect();
      const task = document.querySelector(".day-detail .check-item").getBoundingClientRect();
      const screen = document.querySelector(".week-screen");
      return { navTop: nav.top, taskTop: task.top, taskBottom: task.bottom, scrolled: screen.scrollTop };
    });
    expect(week.scrolled, JSON.stringify({ viewport, week })).toBeGreaterThan(0);
    expect(week.taskTop, JSON.stringify({ viewport, week })).toBeGreaterThanOrEqual(0);
    expect(week.taskBottom, JSON.stringify({ viewport, week })).toBeLessThanOrEqual(week.navTop - 2);
    await page.screenshot({ path: info.outputPath(`calendar-clearance-${viewport.width}x${viewport.height}-week.png`), animations: "disabled" });
  }
});

test("Month summaries separate every reviewed same-day event into an accessible list", async ({ page }, info) => {
  await page.clock.setFixedTime(date);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const expected = [
    "Chick-fil-A orders and money due — $7 each",
    "12:00 dismissal",
    "Conference schedule portal closes",
    "Spelling (short i / long i) / Handwriting",
    "Grammar (subject & predicate)",
  ];
  for (const width of [375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#calendar");
    await expect(page.locator(".calendar-screen")).toBeVisible();
    const busyDay = page.locator(".current-month-summary > div").filter({
      has: page.locator("span", { hasText: "Fri 9" }),
    });
    await expect(busyDay).toHaveCount(1);
    const items = busyDay.locator('ul[role="list"] > li');
    await expect(items).toHaveText(expected);
    await expect(page.locator(".current-month-summary p")).toHaveCount(0);
    const geometry = await items.evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(), c = getComputedStyle(node);
      return { top: r.top, bottom: r.bottom, font: parseFloat(c.fontSize) };
    }));
    for (let i = 0; i < geometry.length; i++) {
      expect(geometry[i].font, width + "px event text").toBeGreaterThanOrEqual(13);
      if (i) expect(geometry[i].top, width + "px events overlap").toBeGreaterThanOrEqual(geometry[i-1].bottom + 3);
    }
    await noOverflow(page, ".calendar-screen", width);
    await expect(page.locator(".next-month-card ul[role='list'] > li").first()).toContainText(/./);
    await busyDay.scrollIntoViewIfNeeded();
    await busyDay.screenshot({ path: info.outputPath("calendar-month-events-" + width + ".png"), animations: "disabled" });
  }
});
