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

// The status link is useful only when families can reach and activate it.
// A nominally visible element can still sit under the bottom navigation,
// especially on compact iPhones and when iOS text size is enlarged.
test("live teacher link clears the bottom bar on compact and enlarged-text phones",async({page},info)=>{
  test.setTimeout(120_000);
  await page.emulateMedia({reducedMotion:"reduce"});
  await openWithPack(page,mockPack(staleAt));

  for(const viewport of [{width:375,height:667},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const enlarged of [false,true]){
      await page.evaluate(enlarge=>{
        document.documentElement.style.fontSize=enlarge?"32px":"";
      },enlarged);
      for(const tab of ["today","calendar","week","study","family"]){
        await page.goto("/#"+tab);
        // Study can finish an asynchronous materials render after the route
        // changes; scrolling its temporary DOM is not a reachability check.
        if(tab==="study"){
          await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:15000});
        }
        const link=page.locator("a.teacher-live-source");
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("aria-label",/official Grade 2 teacher page/i);
        await link.scrollIntoViewIfNeeded();
        const measured=await link.evaluate(el=>{
          const target=el.getBoundingClientRect();
          const nav=document.querySelector(".bottom-nav")?.getBoundingClientRect();
          const screen=el.closest(".screen");
          const surface=screen?.getBoundingClientRect();
          return {
            left:target.left,right:target.right,top:target.top,bottom:target.bottom,
            height:target.height,navTop:nav?.top ?? innerHeight,
            screenTop:surface?.top ?? 0,
            screenWidth:screen?.clientWidth,scrollWidth:screen?.scrollWidth
          };
        });
        const context=JSON.stringify({viewport,enlarged,tab,measured});
        expect(measured.height,context).toBeGreaterThanOrEqual(44);
        expect(measured.left,context).toBeGreaterThanOrEqual(-1);
        expect(measured.right,context).toBeLessThanOrEqual(viewport.width+1);
        expect(measured.top,context).toBeGreaterThanOrEqual(measured.screenTop-1);
        expect(measured.bottom,context).toBeLessThanOrEqual(measured.navTop-2);
        expect(measured.scrollWidth,context).toBeLessThanOrEqual(measured.screenWidth+1);
        if(viewport.width===375 && enlarged && tab==="today"){
          await page.screenshot({path:info.outputPath("teacher-source-clearance-375-enlarged.png"),animations:"disabled"});
        }
      }
    }
  }
  await page.evaluate(()=>{document.documentElement.style.fontSize="";});
});
