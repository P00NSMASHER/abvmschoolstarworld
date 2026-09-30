import {test,expect} from "@playwright/test";
import {readPwaVersions} from "./pwa-test-helpers.mjs";

test("manifest remains installable-quality",async({request})=>{
  const response=await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest=await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toContain("#today");
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);
});

test("standalone mode boots the same six-tab app shell",async({browser})=>{
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
  await expect(page.locator(".family-screen")).toBeVisible({timeout:10_000});
  await expect(page.locator(".bottom-nav button")).toHaveCount(6);
  await context.close();
});

test("cached app shell and school pack remain usable offline after warm load",async({page,context})=>{
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await page.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await page.reload();
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.getByRole("button",{name:"Today",exact:true})).toBeVisible();
  await context.setOffline(false);
});

test("Study Games engine is available offline after warm load",async({page,context})=>{
  await page.goto("/#games");
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await page.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await page.reload();
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await context.setOffline(false);
});

test("app recovers cleanly after reconnecting from offline mode",async({page,context})=>{
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await page.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await page.reload();
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.locator(".freshness")).toBeVisible();
});

test("service worker cleans only old ABVM caches and precaches the exact shell",async({request})=>{
  const {sw:source,styleUrl,appUrl,gamesUrl}=await readPwaVersions(request);
  expect(source).toContain('const CACHE_PREFIX = "abvm-grade2-parent-companion-"');
  expect(source).toContain("caches.keys()");
  expect(source).toContain("key.startsWith(CACHE_PREFIX)&&key!==CACHE");
  expect(source).not.toContain("keys.filter(key=>key!==CACHE)");
  expect(source).toContain("caches.delete(key)");
  expect(source).toContain('"'+styleUrl+'"');
  expect(source).toContain('"'+appUrl+'"');
  expect(source).toContain('"'+gamesUrl+'"');
  expect(source).toContain('"./data/study-pack.json"');
  expect(source).not.toMatch(/STATIC_SHELL\s*=\s*\[\s*"\.\/"/);
});


test("network-first requests do not read cache before a successful fetch",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  const start=source.indexOf("function networkFirst");
  const end=source.indexOf("function staleWhileRevalidate",start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const body=source.slice(start,end);
  expect(body.indexOf('fetch(request,{cache:"no-store"})')).toBeGreaterThanOrEqual(0);
  expect(body.indexOf('fetch(request,{cache:"no-store"})')).toBeLessThan(body.indexOf("cachedFallback(request,fallback)"));
  expect(body).toContain("event.waitUntil(persist.catch(()=>{}))");
});

test("stale-while-revalidate keeps its cache update alive",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  const start=source.indexOf("function staleWhileRevalidate");
  const end=source.indexOf('self.addEventListener("fetch"',start);
  const body=source.slice(start,end);
  expect(body).toContain("event.waitUntil(update.then(()=>{}))");
  expect(source).toContain("staleWhileRevalidate(event.request,event)");
});

test("cache fallback searches only the ABVM cache",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  const start=source.indexOf("async function cachedFallback");
  const end=source.indexOf("function networkFirst",start);
  const body=source.slice(start,end);
  expect(body).toContain("const cache=await caches.open(CACHE)");
  expect(body).not.toContain("caches.match(request)");
});


test("network-first cache fallback identifies saved responses to the app",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  expect(source).toContain('headers.set("X-ABVM-Cache-Fallback","1")');
});

test("PWA head includes the current cross-platform capable meta tag",async({request})=>{
  const html=await (await request.get("/")).text();
  expect(html).toContain('<meta name="mobile-web-app-capable" content="yes">');
});
