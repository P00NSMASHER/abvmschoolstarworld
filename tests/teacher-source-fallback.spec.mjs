import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Network-backed source fixtures must not be replaced by a prior PWA cache.
// Other test suites continue to exercise the real service worker normally.
test.use({ serviceWorkers:"block" });

const frozenNow=new Date("2026-10-10T20:00:00-04:00");
const staleAt="2026-10-08T11:00:00-04:00";
const currentAt="2026-10-10T19:00:00-04:00";
function mockPack(checkedAt){
  const data=structuredClone(JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8")));
  data.sourceLastCheckedAt=checkedAt;
  data.pack.sourceCheckedAt=checkedAt;
  return data;
}
async function openWithPack(page,pack){
  let reads=0;
  await page.clock.setFixedTime(frozenNow);
  await page.route("**/data/study-pack*.json*",route=>{reads++;return route.fulfill({json:pack});});
  await page.goto("/#today");
  await expect(page.locator(".freshness")).toBeVisible();
  expect(reads,"the teacher source fixture must actually load").toBeGreaterThan(0);
}

test("stale teacher verification provides a legible official link on all parent views",async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  const data=mockPack(staleAt);
  // Newly captured Yahoo notices must not substitute for a teacher check.
  data.sourceLastSeenAt="2026-10-10T19:55:00-04:00";
  data.sourceCapturedAt=data.sourceLastSeenAt;
  data.pack.sourceCapturedAt=data.sourceLastSeenAt;
  await openWithPack(page,data);
  for(const tab of ["today","calendar","week","study","family"]){
    await page.goto("/#"+tab);
    await expect(page.locator(".freshness")).toContainText("Teacher pages need refresh");
    await expect(page.locator(".freshness")).toContainText("Oct 8");
    await expect(page.locator(".freshness")).not.toContainText("Teacher pages verified");
    const link=page.locator("a.teacher-live-source");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href","https://sites.google.com/view/abvmgr2/home");
    await expect(link).toHaveAttribute("target","_blank");
    await expect(link).toHaveAttribute("rel","noopener noreferrer");
    const rect=await link.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.height,tab+" source fallback touch height").toBeGreaterThanOrEqual(44);
    expect(await page.locator(".screen").evaluate(el=>el.scrollWidth<=el.clientWidth+1),tab+" overflows").toBe(true);
    if(tab==="today"){
      await link.scrollIntoViewIfNeeded();
      await page.screenshot({path:info.outputPath("teacher-source-stale-iphone.png"),animations:"disabled"});
    }
  }
});

test("stale retries do not duplicate a link, and fresh teacher evidence removes it",async({page})=>{
  let active=mockPack(staleAt),reads=0;
  await page.clock.setFixedTime(frozenNow);
  await page.route("**/data/study-pack*.json*",route=>{reads++;return route.fulfill({json:active});});
  await page.goto("/#today");
  const link=page.locator(".today-screen > .teacher-live-source");
  await expect(link).toHaveCount(1);
  await page.locator(".freshness").click();
  await expect(page.locator(".freshness")).toContainText("Teacher pages need refresh");
  await expect(link).toHaveCount(1);
  active=mockPack(currentAt);
  await page.locator(".freshness").click();
  await expect(page.locator(".freshness")).toContainText("Teacher pages verified");
  await expect(link).toHaveCount(0);
  expect(reads,"stale and current checks must hit the explicit teacher-source fixture").toBeGreaterThanOrEqual(3);
});

test("offline data stays clearly offline and never offers a live teacher link",async({page,context})=>{
  await openWithPack(page,mockPack(staleAt));
  await expect(page.locator(".teacher-live-source")).toHaveCount(1);
  await context.setOffline(true);
  await expect(page.locator(".freshness")).toContainText("Offline");
  await expect(page.locator(".teacher-live-source")).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.locator(".freshness")).toContainText("Teacher pages need refresh");
  await expect(page.locator(".teacher-live-source")).toHaveCount(1);
});

test("current verified teacher pages do not show an unnecessary fallback",async({page})=>{
  await openWithPack(page,mockPack(currentAt));
  await expect(page.locator(".freshness")).toContainText("Teacher pages verified");
  await expect(page.locator(".teacher-live-source")).toHaveCount(0);
});
