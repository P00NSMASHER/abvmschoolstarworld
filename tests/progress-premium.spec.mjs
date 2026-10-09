import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });
const DATE = new Date("2026-10-08T12:00:00-04:00");
const WIDTHS = [320, 375, 390, 402, 430];

async function openProgress(page, width) {
  await page.clock.setFixedTime(DATE);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height: width === 320 ? 740 : 852 });
  await page.goto("/#family");
  await expect(page.locator(".progress-screen")).toBeVisible();
  await expect(page.locator(".progress-screen [data-badge-collection]")).toBeVisible({ timeout: 15000 });
}
async function noOverflow(page, width) {
  const dims = await page.locator(".progress-screen").evaluate(el => ({
    width: el.clientWidth, scroll: el.scrollWidth
  }));
  expect(dims.scroll, "Progress screen overflow at " + width + "px")
    .toBeLessThanOrEqual(dims.width + 1);
}
async function decoded(locator) {
  await expect(locator).toBeVisible();
  await expect.poll(() => locator.evaluate(img => img.complete && img.naturalWidth > 0), {timeout: 15000}).toBe(true);
  await locator.evaluate(img => img.decode());
}
async function capture(page, info, label, full = false) {
  if (full) {
    await page.addStyleTag({
      content: ".phone-app{display:block!important;height:auto!important;min-height:100vh!important;overflow:visible!important}.screen-stack,.progress-screen{height:auto!important;overflow:visible!important}.bottom-nav{display:none!important}"
    });
  }
  await page.screenshot({ path: info.outputPath(label + ".png"), fullPage: full, animations: "disabled" });
}

test("Premium Progress retains rank evidence and 21 browsable milestones on five phone widths", async ({page}, info) => {
  for (const width of WIDTHS) {
    await openProgress(page, width);
    const screen = page.locator(".progress-screen");
    await expect(screen.locator(".app-header h1")).toHaveText("Progress");
    await expect(screen.locator(".family-hero")).toContainText("Growing every week");
    await expect(screen.locator(".rank-current")).toContainText("Eaglet");
    await expect(screen.locator(".study-badge-next")).toContainText("Nest Explorer");
    const rail = screen.locator(".study-badge-grid");
    await expect(rail).toHaveAttribute("tabindex", "0");
    await expect(rail).toHaveAttribute("aria-label", /scroll horizontally/i);
    await expect(rail.getByRole("listitem")).toHaveCount(21);
    await expect(screen.locator(".badge-rail-hint")).toContainText("Swipe to explore");
    const geometry = await rail.evaluate(el => ({
      scroll: el.scrollWidth, client: el.clientWidth, left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right, styles: getComputedStyle(el).overflowX
    }));
    expect(geometry.scroll, String(width) + "px full rank list must be browsable").toBeGreaterThan(geometry.client + 100);
    expect(geometry.styles).toBe("auto");
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
    await rail.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    expect(await rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    // Preserve the genuine first-open viewport in screenshot evidence.
    await rail.evaluate(el => { el.scrollLeft = 0; });
    expect(await rail.evaluate(el => el.scrollLeft)).toBe(0);
    await expect(rail.getByRole("listitem").first()).toContainText("Nest Explorer");

    const cards = screen.locator(".learning-subject");
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    const metrics = await cards.evaluateAll(nodes => nodes.map(el => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, height: b.height, scroll: el.scrollWidth, width: el.clientWidth };
    }));
    for (const card of metrics) {
      expect(card.left, JSON.stringify({width,card})).toBeGreaterThanOrEqual(-1);
      expect(card.right, JSON.stringify({width,card})).toBeLessThanOrEqual(width + 1);
      expect(card.scroll, JSON.stringify({width,card})).toBeLessThanOrEqual(card.width + 1);
      expect(card.height, JSON.stringify({width,card})).toBeGreaterThanOrEqual(70);
    }
    await decoded(screen.locator(".family-hero img"));
    await decoded(screen.locator(".rank-current img"));
    const imgs = cards.locator("img");
    for (let i = 0; i < await imgs.count(); i++) {
      await imgs.nth(i).scrollIntoViewIfNeeded();
      await decoded(imgs.nth(i));
    }
    await screen.evaluate(el => { el.scrollTop = 0; });
    await expect(page.locator(".bottom-nav [data-tab=family]")).toHaveAttribute("aria-current", "page");
    await noOverflow(page,width);
    await capture(page, info, "progress-premium-" + width + "-first");
    if (width === 390) await capture(page, info, "progress-premium-390-full", true);
  }
});

test("Progress preserves learning interpretation, badge rank, and navigation actions", async ({page}) => {
  await openProgress(page,390);
  const screen = page.locator(".progress-screen");
  await expect(screen.locator(".progress-empty")).toContainText("Watch learning grow");
  const rank = screen.locator(".badge-collection");
  await expect(rank.getByRole("progressbar",{name:"Next rank progress"})).toHaveAttribute("aria-valuemax","25");
  await expect(rank.getByRole("listitem")).toHaveCount(21);
  const school = screen.locator(".school-details");
  await expect(school).toHaveAttribute("open","");
  await school.locator(":scope > summary").click();
  await expect(school).not.toHaveAttribute("open","");
  await school.locator(":scope > summary").click();
  await expect(school).toHaveAttribute("open","");
  await screen.locator(".progress-empty [data-route=study]").click();
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready");
  await expect(page.locator(".study-game-grid > .study-game-tile")).toHaveCount(5);
  await page.locator(".bottom-nav [data-tab=family]").click();
  await expect(page.locator(".progress-screen .rank-current")).toContainText("Eaglet");
  await expect(page.locator(".progress-screen .study-badge-grid > li")).toHaveCount(21);
  await page.locator(".school-work-history [data-route='study?notes']").click();
  await expect(page.locator(".games-screen")).toBeVisible();
});

test("Progress cards remain readable with enlarged text and long verified topics", async ({page}) => {
  await openProgress(page,375);
  await page.locator(".learning-subject h3").first().evaluate(node => {
    node.textContent = "Reading, Spelling, Handwriting and Creative Language Studies";
  });
  await page.evaluate(() => {
    const html=document.documentElement;
    html.style.fontSize=(parseFloat(getComputedStyle(html).fontSize)*2)+"px";
  });
  await noOverflow(page,375);
  const els = page.locator(".progress-screen .progress-empty .primary-button,.progress-screen .school-details>summary,.progress-screen .school-work-history .text-button");
  const buttons=await els.evaluateAll(nodes=>nodes.map(el=>{
    const b=el.getBoundingClientRect();
    return {height:b.height,left:b.left,right:b.right,scroll:el.scrollWidth,width:el.clientWidth};
  }));
  for(const b of buttons) {
    expect(b.height,JSON.stringify(b)).toBeGreaterThanOrEqual(44);
    expect(b.left,JSON.stringify(b)).toBeGreaterThanOrEqual(-1);
    expect(b.right,JSON.stringify(b)).toBeLessThanOrEqual(376);
    expect(b.scroll,JSON.stringify(b)).toBeLessThanOrEqual(b.width+1);
  }
  await expect(page.locator(".progress-screen .study-badge-grid")).toHaveAttribute("tabindex","0");
});

test("Progress retains readable evidence cards when verified practice exists",async({page})=>{
  const fixture=await (await page.request.get("/data/study-pack.json")).json();
  const skill=fixture.pack.contentPipeline.skills[0]?.id;
  expect(skill).toBeTruthy();
  const now=DATE.getTime();
  await page.addInitScript(({skill,now})=>{
    localStorage.setItem("abvm-study-learning:v2",JSON.stringify({
      [skill]:{LastSeenAt:now-5*60_000,LastIndependentCorrectAt:now-5*60_000,
        LastResolution:{correct:true,independent:true,resolvedAt:now-5*60_000}}
    }));
  },{skill,now});
  await openProgress(page,390);
  await expect(page.locator(".progress-screen")).toContainText("Strong today",{timeout:15000});
  // Multiple independent notice cards legitimately have this header class.
  // Target only the source-backed weekly learning evidence card.
  await expect(page.locator('.progress-screen .parent-card[aria-labelledby="weekly-learning-title"] .notices-head')).toBeVisible();
  await expect(page.locator(".progress-screen .progress-empty")).toHaveCount(0);
  await noOverflow(page,390);
});
