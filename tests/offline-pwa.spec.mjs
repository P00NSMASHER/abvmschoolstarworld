import {test,expect} from "@playwright/test";

test("manifest remains installable-quality",async({request})=>{
  const response=await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest=await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toContain("#today");
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);
});

test("installed/standalone mode hides redundant install guidance",async({browser})=>{
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,"standalone",{value:true,configurable:true});
    const original=window.matchMedia.bind(window);
    window.matchMedia=query=>query.includes("display-mode: standalone")
      ? {matches:true,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true}}
      : original(query);
  });
  const page=await context.newPage();
  await page.goto("http://127.0.0.1:4173/#family");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await expect(page.locator(".install-card")).toHaveCount(0);
  await context.close();
});

test("cached app shell and school pack remain usable offline after warm load",async({page,context})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await page.evaluate(async()=>{
    if("serviceWorker" in navigator){
      await navigator.serviceWorker.ready;
    }
  });
  await page.reload();
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.getByRole("button",{name:"Today",exact:true})).toBeVisible();
  await expect(page.locator(".load-error")).toHaveCount(0);
  await context.setOffline(false);
});


test("app recovers cleanly after reconnecting from offline mode",async({page,context})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await page.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await page.reload();
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator(".load-error")).toHaveCount(0);
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await expect(page.locator(".freshness")).toBeVisible();
});

test("service worker source includes cache cleanup for old versions",async({request})=>{
  const response=await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  const source=await response.text();
  expect(source).toContain("caches.keys()");
  expect(source).toContain("key !== CACHE");
  expect(source).toContain("caches.delete(key)");
});
