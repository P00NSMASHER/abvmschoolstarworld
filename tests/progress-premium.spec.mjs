import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const REFERENCE_DATE = new Date("2026-10-08T12:00:00-04:00");
const WIDTHS = [320, 375, 390, 402, 430];

async function openProgress(page, width) {
  await page.clock.setFixedTime(REFERENCE_DATE);
  await page.setViewportSize({ width, height: width === 320 ? 740 : 852 });
  await page.goto("/#family");
  await expect(page.locator(".progress-screen")).toBeVisible();
  await expect(page.locator(".progress-screen .badge-collection")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".progress-screen .rank-current")).toContainText("Eaglet");
  await expect(page.locator(".progress-screen .study-badge-grid li")).toHaveCount(21);
}

async function imageReady(locator, label) {
  await expect(locator, label + " should be visible").toBeVisible();
  await expect.poll(
    () => locator.evaluate(img => img.complete && img.naturalWidth > 0),
    { message: label + " could not decode", timeout: 15000 },
  ).toBe(true);
  await locator.evaluate(img => img.decode());
}

async function assertFit(page, width) {
  const metrics = await page.locator(".progress-screen").evaluate(root => ({
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    heading: getComputedStyle(root.querySelector(".badge-collection-heading h2")).fontSize,
    rankTop: root.querySelector(".rank-current").getBoundingClientRect().top,
    nextTop: root.querySelector(".study-badge-next").getBoundingClientRect().top,
    heroTop: root.querySelector(".family-hero").getBoundingClientRect().top,
  }));
  expect(metrics.scrollWidth, width + "px: horizontal overflow").toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(parseFloat(metrics.heading)).toBeGreaterThanOrEqual(20);
  expect(metrics.rankTop).toBeGreaterThan(metrics.heroTop);
  expect(metrics.nextTop).toBeGreaterThan(metrics.rankTop);
}

async function capture(page, info, name, full = false) {
  if (full) {
    await page.addStyleTag({
      content: ".phone-app{display:block!important;height:auto!important;min-height:100vh!important;overflow:visible!important}.screen-stack,.progress-screen{height:auto!important;overflow:visible!important}.bottom-nav{display:none!important}",
    });
  }
  await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: full, animations: "disabled" });
}

test("Progress uses verified Eaglet data, a real rank meter and all 21 promotions on five iPhone widths", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of WIDTHS) {
    await openProgress(page, width);
    await imageReady(page.locator(".family-hero img"), "Personalized learning illustration");
    await imageReady(page.locator(".rank-current > .study-badge-art"), "Current rank medal");
    await imageReady(page.locator(".study-badge-next > .study-badge-art"), "Next rank medal");

    const saved = await page.evaluate(() => window.ABVMStudyBadges.snapshot());
    expect(saved).toBeTruthy();
    const currentTitle = saved.current?.title || saved.latest?.title || "Eaglet";
    await expect(page.locator(".rank-current h3")).toHaveText(currentTitle);
    await expect(page.locator(".badge-balance")).toContainText(String(saved.balance));
    await expect(page.locator(".study-badge-next")).toContainText(saved.next?.title || currentTitle);
    const bar = page.getByRole("progressbar", { name: "Next rank progress" });
    await expect(bar).toHaveAttribute("aria-valuenow", String(saved.segmentProgress ?? 0));
    await expect(bar).toHaveAttribute("aria-valuemax", String(saved.segmentTarget ?? 1));

    const cards = page.locator(".progress-screen .study-badge-grid li");
    await expect(cards).toHaveCount(21);
    await expect(cards.first()).toContainText("Up next");
    expect(await page.locator(".progress-screen .study-badge-card.is-locked").count()).toBeGreaterThan(0);
    const children = await cards.locator("img").count();
    expect(children).toBe(21);
    await assertFit(page, width);
    if (width === 390) {
      await page.locator(".progress-screen").evaluate(node => { node.scrollTop = 0; });
    }
    await capture(page, info, "progress-premium-" + width + "-first");
    if (width === 390) await capture(page, info, "progress-premium-390-full", true);
  }
});

test("Progress class subjects and family notices keep their source-backed content and navigation", async ({ page }) => {
  await openProgress(page, 390);
  const source = await (await page.request.get("/data/study-pack-runtime.json")).json();
  const expected = (source.pack?.subjects || []).filter(s => s.subject !== "Specials").map(s => s.subject);
  const shown = await page.locator(".learning-library .learning-subject h3").allTextContents();
  expect(shown).toEqual(expected);
  await expect(page.locator(".badge-device-note")).toContainText("not school grades");
  await expect(page.locator(".device-note")).toContainText("not school grades");
  await expect(page.locator(".school-details")).toHaveAttribute("open", "");
  const notices = page.locator(".school-details > summary");
  await notices.click();
  await expect(page.locator(".school-details")).not.toHaveAttribute("open", "");
  await notices.click();
  await expect(page.locator(".school-details")).toHaveAttribute("open", "");
  await page.locator(".school-work-history [data-route='study?notes']").click();
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state", /ready|partial/, { timeout: 15000 });
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.locator(".progress-screen .badge-collection")).toBeVisible();
});

test("Rank ladder, school updates and important text remain readable at 200% size", async ({ page }) => {
  await openProgress(page, 375);
  await page.evaluate(() => { document.documentElement.style.fontSize = "34px"; });
  const root = page.locator(".progress-screen");
  const layout = await root.evaluate(node => ({
    scrollWidth: node.scrollWidth, width: node.clientWidth,
    balance: node.querySelector(".badge-balance").getBoundingClientRect(),
    rank: node.querySelector(".rank-current").getBoundingClientRect(),
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
  expect(layout.balance.width).toBeGreaterThan(0);
  expect(layout.rank.width).toBeGreaterThan(0);
  await expect(page.locator(".badge-device-note")).toBeVisible();
  await expect(page.locator(".school-details > summary")).toBeVisible();
});

test("Progress remains readable on iPad and wide desktop", async ({ page }) => {
  await page.clock.setFixedTime(REFERENCE_DATE);
  for (const width of [768, 820, 1440]) {
    await page.setViewportSize({ width, height: 1024 });
    await page.goto("/#family");
    await expect(page.locator(".progress-screen .badge-collection")).toBeVisible({ timeout: 15000 });
    await assertFit(page, width);
    const columns = await page.locator(".study-badge-grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
    expect(columns).toBeGreaterThanOrEqual(3);
  }
});
