import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });
async function mount(page, day) {
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
}) => {
  await mount(page, "2026-10-04");
  const prep = page.locator(".hub-card").first();
  await expect(prep).toContainText("2026-10-07");
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
  await expect(page.locator(".hub-card").first()).toContainText("2026-10-09");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("abvm-completed-tests")).length,
    ),
  ).toBe(2);
});
test("past tests roll forward; cumulative, STAR and mixed games work without an uploader", async ({
  page,
}) => {
  await mount(page, "2026-10-08");
  await expect(page.locator(".hub-card").first()).toContainText("2026-10-09");
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
