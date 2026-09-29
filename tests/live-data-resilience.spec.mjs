import {test,expect} from "@playwright/test";

test("school date follows Eastern time even when the device is elsewhere",async({browser})=>{
  const context=await browser.newContext({timezoneId:"America/Los_Angeles",serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T05:30:00Z"));
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.getByRole("heading",{name:"Tuesday, September 29"})).toBeVisible();
  await context.close();
});

test("online refresh applies changed school data without losing checklist state",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  let current=structuredClone(source);
  await page.route("**/data/study-pack.json*",route=>route.fulfill({json:current}));
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});

  const firstTask=page.locator("[data-check]").first();
  await expect(firstTask).toBeVisible();
  if(!await firstTask.evaluate(el=>el.classList.contains("is-done")))await firstTask.click();
  await expect(page.locator("[data-check]").first()).toHaveClass(/is-done/);

  current=structuredClone(source);
  current.pack.sourceHash="teacher-pages-live-refresh-regression";
  current.pack.lunchMenuHash="lunch-live-refresh-regression";
  const lunch=current.pack.lunchMenu.find(item=>item.date==="2026-09-29"||/Tuesday, Sept\. 29/.test(item.day||""));
  expect(lunch).toBeTruthy();
  lunch.items=["Freshly updated lunch"];
  current.sourceLastSeenAt=new Date().toISOString();
  current.pack.sourceCapturedAt=current.sourceLastSeenAt;

  await page.evaluate(()=>window.dispatchEvent(new Event("online")));
  await expect(page.locator(".lunch-card")).toContainText("Freshly updated lunch");
  await expect(page.locator("#toast")).toContainText("School info updated");
  await expect(page.locator("[data-check]").first()).toHaveClass(/is-done/);

  const keys=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith("abvm-task:v2:")));
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.every(key=>!key.includes("teacher-pages-"))).toBe(true);
  await context.close();
});

test("Family hides dated notices after they expire",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.parentNotices=[
    "Old family item Monday, Sept. 28.",
    "Current family item Tuesday, Sept. 29.",
    "Future family item Wednesday, Sept. 30.",
    "Standing undated family information."
  ];
  await page.route("**/data/study-pack.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#family");
  await expect(page.locator(".family-screen")).toBeVisible({timeout:10_000});
  await expect(page.locator(".notices-card")).not.toContainText("Old family item");
  await expect(page.locator(".notices-card")).toContainText("Current family item");
  await expect(page.locator(".notices-card")).toContainText("Future family item");
  await expect(page.locator(".notices-card")).toContainText("Standing undated family information");
  await context.close();
});

test("versioned app code bypasses an older cache entry while online",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await page.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await page.reload();
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});

  const result=await page.evaluate(async()=>{
    const cache=await caches.open("abvm-grade2-parent-companion-v72-live-data");
    await cache.put("./app.js?v=72",new Response("OLD_CACHED_APP_MARKER",{headers:{"Content-Type":"application/javascript"}}));
    const text=await (await fetch("./app.js?v=72")).text();
    return {old:text.includes("OLD_CACHED_APP_MARKER"),fresh:text.includes("PACK_REFRESH_MS")};
  });
  expect(result.old).toBe(false);
  expect(result.fresh).toBe(true);
});

test("service worker install tolerates optional school-data precache failure",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  expect(source).toContain('const CACHE = "abvm-grade2-parent-companion-v72-live-data"');
  expect(source).toContain("Promise.allSettled");
  expect(source).toContain("OPTIONAL_DATA");
  expect(source).toContain('url.searchParams.has("v")');
  expect(source).toContain("networkFirst(event.request,null)");
});


test("index promotes a newly activated service worker before relying on versioned code",async({request})=>{
  const html=await (await request.get("/index.html")).text();
  expect(html).toContain('abvm-sw-reloaded-v72');
  expect(html).toContain('navigator.serviceWorker.addEventListener("controllerchange"');
  expect(html).toContain('registration.update()');
  expect(html.indexOf("abvm-sw-reloaded-v72")).toBeLessThan(html.indexOf("./app.js?v=72"));
});


test("timestamp-only verification refresh does not reset open UI state",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  let current=structuredClone(source);
  await page.route("**/data/study-pack.json*",route=>route.fulfill({json:current}));
  await page.goto("http://127.0.0.1:4173/#study");
  const first=page.locator(".study-accordion").first();
  await first.locator("summary").click();
  await expect(first).toHaveAttribute("open","");

  current=structuredClone(source);
  const stamp=new Date().toISOString();
  current.sourceLastSeenAt=stamp;
  current.pack.generatedAt=stamp;
  current.pack.sourceCheckedAt=stamp;
  current.pack.lunchMenuHash="metadata-only-hash-change";
  if(current.pack.lunchMenuSource)current.pack.lunchMenuSource.lastAttemptAt=stamp;

  await page.evaluate(()=>window.dispatchEvent(new Event("online")));
  await expect(first).toHaveAttribute("open","");
  await expect(page.locator("#toast")).not.toContainText("School info updated");
  await context.close();
});
