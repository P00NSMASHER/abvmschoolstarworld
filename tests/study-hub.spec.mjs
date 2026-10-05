import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });
async function mount(page, day, testInfo) {
  await page.addInitScript((iso) => {
    const OriginalDate = Date,
      instant = OriginalDate.parse(iso);
    class FixedDate extends OriginalDate {
      constructor(...args) {
        super(...(args.length ? args : [instant]));
      }
      static now() {
        return instant;
      }
    }
    globalThis.Date = FixedDate;
  }, day + "T16:00:00-04:00");
  await page.goto("/#study");
  await expect(page.locator("#study-hub .hub-tabs")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("study-weekly.png"),
    fullPage: true,
  });
  await page.evaluate(async () => {
    document.body.innerHTML =
      '<main><div id="fixture-hub"></div><div data-study-legacy></div></main>';
    const { mountStudyHub } = await import("/study-hub.mjs");
    const questions = ["Math", "Religion"].flatMap((subject) =>
      Array.from({ length: 6 }, (_, i) => ({
        id: subject + i,
        subject,
        skill: subject === "Religion" ? "religion-chapter-2" : "addition",
        tier: "material",
        prompt: subject + " fixture " + i,
        choices: ["Yes", "No"],
        answer: "Yes",
        explanation: "A checked example.",
      })),
    );
    await mountStudyHub(document.querySelector("#fixture-hub"), {
      pack: { subjects: [{ subject: "Religion", topics: ["Chapter 2"] }] },
      catalog: { questions },
      engine: { recordLearning() {} },
      events: [
        { date: "2026-10-07", label: "Math test" },
        { date: "2026-10-07", label: "Religion Chapter 2 test" },
        { date: "2026-10-09", label: "Math test" },
      ],
    });
  });
  await expect(page.locator(".hub-tabs")).toBeVisible();
}
test("weekly test prep covers same-day subjects and completion persists", async ({
  page,
}, testInfo) => {
  await mount(page, "2026-10-04", testInfo);
  const prep = page.locator(".hub-card").first();
  await expect(prep.locator("time")).toHaveAttribute("datetime", "2026-10-07");
  await expect(prep.locator("time")).toHaveText("Wednesday, Oct 7");
  await expect(prep).toContainText("Math test");
  await expect(prep).toContainText("Religion Chapter 2 test");
  await page.locator("[data-test]").click();
  const subjects = [];
  while (await page.locator(".hub-round").count()) {
    subjects.push(
      (await page.locator(".hub-round .hub-caption").textContent()).split(
        " · ",
      )[1],
    );
    await page.locator("[data-answer]").first().click();
    await page.locator("[data-next]").click();
  }
  expect(subjects.filter((s) => s === "Math").length).toBe(
    subjects.filter((s) => s === "Religion").length,
  );
  await page.locator("[data-end]").click();
  await page.locator("[data-complete-test]").click();
  await expect(
    page.locator(".hub-card").first().locator("time"),
  ).toHaveAttribute("datetime", "2026-10-09");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("abvm-completed-tests")).length,
    ),
  ).toBe(2);
});
test("past tests roll forward; cumulative, STAR and mixed games work without an uploader", async ({
  page,
}, testInfo) => {
  await mount(page, "2026-10-08", testInfo);
  await expect(
    page.locator(".hub-card").first().locator("time"),
  ).toHaveAttribute("datetime", "2026-10-09");
  await expect(page.locator(".hub-card").first()).not.toContainText(
    "2026-10-07",
  );
  await page.locator("[data-tab=cumulative]").click();
  await expect(page.locator(".hub-content")).toContainText(
    "Everything learned, kept together",
  );
  await page.locator("[data-tab=star]").click();
  await page.locator('[data-star="Math"]').click();
  await expect(page.locator(".hub-round .hub-caption")).toContainText("Math");
  await page.locator("[data-end]").click();
  await page.locator('[data-star="Reading / ELA"]').click();
  await expect(page.locator(".hub-round .hub-caption")).toContainText(
    "Reading / ELA",
  );
  await page.locator("[data-end]").click();
  await page.locator("[data-tab=games]").click();
  await page.locator("[data-pick=cumulative]").check();
  await page.locator("[data-pick=star]").check();
  await page.locator("[value=cards]").check();
  await page.locator("[data-play]").click();
  await expect(page.locator("[data-reveal]")).toBeVisible();
  await page.locator("[data-reveal]").click();
  await expect(page.locator(".hub-feedback")).toBeVisible();
  await page.locator("[data-end]").click();
  await expect(page.locator(".study-hub input[type=file]")).toHaveCount(0);
  expect(
    await page
      .locator(".study-hub")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
});

test("Study has clear mobile and tablet layouts across every section", async ({
  page,
}, testInfo) => {
  await page.goto("/#study");
  const hub = page.locator("#study-hub");
  await expect(hub.locator(".hub-tabs")).toBeVisible();
  await expect(hub.locator(".hub-faith")).toHaveCount(0);
  await expect(hub).not.toContainText("Dated schoolwork this week");
  for (const width of [390, 820]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of ["weekly", "cumulative", "star", "games"]) {
      await hub.locator(`[data-tab=${section}]`).click();
      await expect(hub.locator(`[data-tab=${section}]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(
        await hub.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBeTruthy();
      await page.screenshot({
        path: testInfo.outputPath(`study-${section}-${width}.png`),
        fullPage: true,
      });
    }
    await hub.locator("[data-tab=star]").click();
    await hub.locator('[data-star="Math"]').click();
    await expect(hub.locator(".hub-round")).toBeVisible();
    await expect(hub.locator("[data-answer]").first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`study-quiz-${width}.png`),
      fullPage: true,
    });
    await hub.locator("[data-end]").click();
  }
});
