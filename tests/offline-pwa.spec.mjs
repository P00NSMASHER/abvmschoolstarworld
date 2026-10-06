import {test,expect} from "@playwright/test";
import {readPwaVersions} from "./pwa-test-helpers.mjs";

test("manifest remains installable-quality",async({request})=>{
  const response=await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest=await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#0b3c74");
  expect(manifest.start_url).toContain("#today");
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);
});

test("standalone mode boots the same five-tab app shell",async({browser})=>{
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
  await expect(page.locator(".bottom-nav button")).toHaveCount(5);
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

test("Games and their saved, STAR and mixed source banks remain playable offline after warm load",async({page,context})=>{
  await page.goto("/#games");
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:10_000});
  const banks=await page.evaluate(async()=>{
    const [envelope,work,archive,{buildStarBank}]=await Promise.all([
      fetch('./data/study-pack-runtime.json').then(response=>response.json()),
      fetch('./data/schoolwork.json').then(response=>response.json()),
      fetch('./data/study-archive.json').then(response=>response.json()),
      import('./star-practice.mjs')
    ]);
    const engine=window.ABVMStudyGames,sourceKey=engine.sourceKeyFromEnvelope(envelope.pack,envelope);
    const catalog=engine.buildCatalog(envelope.pack,{sourceKey});
    return {
      saved:[...work.lessons.flatMap(lesson=>lesson.questions),...archive.questions,...catalog.questions.filter(q=>q.tier==='material')],
      star:[...buildStarBank(),...catalog.questions.filter(q=>q.tier==='star-fallback')]
    };
  });
  await page.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await page.reload();
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:10_000});
  await context.setOffline(true);
  try{
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:10_000});
    await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(4);
    for(const source of ['saved','star','mix']){
      await page.locator('[data-study-source]').selectOption(source);
      if(source==='mix'){
        await page.locator('[data-study-pick="weekly"]').uncheck();
        await page.locator('[data-study-pick="saved"]').check();
        await page.locator('[data-study-pick="star"]').check();
      }
      await page.locator('[data-game-start="math"]').click();
      const prompt=await page.locator('.game-question-card > h2').innerText();
      const allowed=source==='mix'?[...banks.saved,...banks.star]:banks[source];
      const question=allowed.find(row=>row.prompt===prompt);
      expect(question,`${source} offline question belongs to a warmed selected bank`).toBeTruthy();
      await page.locator('[data-game-hint]').click();
      await expect(page.locator('.game-hint')).toBeVisible();
      const beforeLearning=await page.evaluate(()=>window.ABVMStudyGames.loadLearning());
      const choices=await page.locator('[data-game-answer] strong').allTextContents();
      const answerIndex=choices.indexOf(question.answer);expect(answerIndex).toBeGreaterThanOrEqual(0);
      await page.locator('[data-game-answer]').nth(answerIndex).click();
      await expect(page.locator('.game-feedback.correct')).toBeVisible();
      const afterLearning=await page.evaluate(()=>window.ABVMStudyGames.loadLearning());
      const changed=Object.entries(afterLearning).filter(([skill,row])=>Number(row.Seen)>Number(beforeLearning[skill]?.Seen||0));
      expect(changed).toHaveLength(1);
      expect(changed[0][1].LastResolution.correct).toBe(true);
      await page.locator('[data-game-home]').click();
    }
    await page.locator('[data-study-source]').selectOption('saved');
    await page.locator('[data-study-notes] > summary').click();
    await expect(page.locator('[data-study-notes]')).toContainText('Undated schoolwork');
  }finally{await context.setOffline(false);}
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
  const {sw:source,styleUrl,appUrl,gamesUrl,gamesViewUrl}=await readPwaVersions(request);
  expect(source).toContain('const CACHE_PREFIX = "abvm-grade2-parent-companion-"');
  expect(source).toContain("caches.keys()");
  expect(source).toContain("key.startsWith(CACHE_PREFIX)&&key!==CACHE");
  expect(source).not.toContain("keys.filter(key=>key!==CACHE)");
  expect(source).toContain("caches.delete(key)");
  expect(source).toContain('"'+styleUrl+'"');
  expect(source).toContain('"'+appUrl+'"');
  expect(source).toContain('"'+gamesUrl+'"');
  expect(source).toContain('"'+gamesViewUrl+'"');
  expect(source).toContain('"./data/study-pack-runtime.json"');
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

test("web manifest is network-first so branding updates immediately online",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  const fetchStart=source.indexOf('self.addEventListener("fetch"');
  const fetchBody=source.slice(fetchStart);
  expect(fetchBody).toContain('if(url.pathname.endsWith(".webmanifest"))');
  const manifestIndex=fetchBody.indexOf('if(url.pathname.endsWith(".webmanifest"))');
  const staleIndex=fetchBody.indexOf("staleWhileRevalidate(event.request,event)");
  expect(manifestIndex).toBeGreaterThanOrEqual(0);
  expect(staleIndex).toBeGreaterThan(manifestIndex);
  expect(fetchBody.slice(manifestIndex,staleIndex)).toContain("networkFirst(event.request,null,event)");
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
