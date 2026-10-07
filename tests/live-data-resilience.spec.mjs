import {test,expect} from "@playwright/test";
import {readPwaVersions} from "./pwa-test-helpers.mjs";

test("school date follows Eastern time even when the device is elsewhere",async({browser})=>{
  const context=await browser.newContext({timezoneId:"America/Los_Angeles",serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T05:30:00Z"));
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.locator(".hero-copy .eyebrow")).toBeVisible();
  await expect(page.locator(".hero-copy .eyebrow")).toHaveText("Tuesday, September 29");
  await expect(page.locator(".hero-copy .eyebrow")).not.toContainText("September 28");
  await context.close();
});

test("online refresh applies changed school data without losing checklist state",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const lunchDate=source.pack?.lunchMenu?.[0]?.date;
  expect(lunchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.clock.setFixedTime(new Date(`${lunchDate}T17:00:00Z`));
  let current=structuredClone(source);
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:current}));
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});

  const firstTask=page.locator("[data-check]").first();
  await expect(firstTask).toBeVisible();
  if(!await firstTask.evaluate(el=>el.classList.contains("is-done")))await firstTask.click();
  await expect(page.locator("[data-check]").first()).toHaveClass(/is-done/);

  current=structuredClone(source);
  current.pack.sourceHash="teacher-pages-live-refresh-regression";
  current.pack.lunchMenuHash="lunch-live-refresh-regression";
  const lunch=current.pack.lunchMenu.find(item=>item.date===lunchDate);
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
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#family");
  await expect(page.locator(".family-screen")).toBeVisible({timeout:10_000});
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).not.toContainText("Old family item");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Current family item");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Future family item");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Standing undated family information");
  await context.close();
});

test("versioned app code bypasses an older cache entry while online",async({page})=>{
  const {cacheName,appUrl}=await readPwaVersions(page.request);
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await page.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await page.reload();
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});

  const result=await page.evaluate(async({cacheName,appUrl})=>{
    const cache=await caches.open(cacheName);
    await cache.put(appUrl,new Response("OLD_CACHED_APP_MARKER",{headers:{"Content-Type":"application/javascript"}}));
    const text=await (await fetch(appUrl)).text();
    return {old:text.includes("OLD_CACHED_APP_MARKER"),fresh:text.includes("PACK_REFRESH_MS")};
  },{cacheName,appUrl});
  expect(result.old).toBe(false);
  expect(result.fresh).toBe(true);
});

test("service worker install tolerates optional school-data precache failure",async({request})=>{
  const {sw:source,cacheName}=await readPwaVersions(request);
  expect(source).toContain('const CACHE = "'+cacheName+'"');
  expect(source).toContain("Promise.allSettled");
  expect(source).toContain("OPTIONAL_DATA");
  expect(source).toContain('url.searchParams.has("v")');
  expect(source).toContain("networkFirst(event.request,null,event)");
});


test("index promotes a newly activated service worker before relying on versioned code",async({request})=>{
  const {index:html,reloadKey,appUrl}=await readPwaVersions(request);
  expect(reloadKey).toMatch(/^abvm-sw-reloaded-v\d+$/);
  expect(html).toContain('navigator.serviceWorker.addEventListener("controllerchange"');
  expect(html).toContain('registration.update()');
  expect(html.indexOf(reloadKey)).toBeLessThan(html.indexOf(appUrl));
});


test("timestamp-only verification refresh does not reset open UI state",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-06T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  let current=structuredClone(source);
  current.sourceLastSeenAt="2026-10-05T12:00:00.000Z";
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:current}));
  await page.goto("http://127.0.0.1:4173/#study");
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready");
  await expect(page.locator(".freshness")).toHaveClass(/stale/);
  const notes=page.locator("[data-study-notes]");
  await notes.locator(":scope > summary").click();
  const first=notes.locator("[data-note-subject]:not([hidden]) .study-notes-original").first();
  await first.locator(":scope > summary").click();
  await expect(notes).toHaveAttribute("open","");
  await expect(first).toHaveAttribute("open","");

  current=structuredClone(source);
  const stamp="2026-10-06T12:59:00.000Z";
  current.sourceLastSeenAt=stamp;
  current.pack.generatedAt=stamp;
  current.pack.sourceCheckedAt=stamp;
  current.pack.lunchMenuHash="metadata-only-hash-change";
  if(current.pack.lunchMenuSource)current.pack.lunchMenuSource.lastAttemptAt=stamp;

  await page.evaluate(()=>window.dispatchEvent(new Event("online")));
  await expect(page.locator(".freshness")).toHaveClass(/current/);
  await expect(notes).toHaveAttribute("open","");
  await expect(first).toHaveAttribute("open","");
  await expect(page.locator("#toast")).not.toContainText("School info updated");
  await context.close();
});


test("tapping the freshness box forces an immediate live pack refresh",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T15:34:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const stale=structuredClone(source);
  stale.sourceLastSeenAt="2026-09-29T05:53:00.000Z";
  stale.pack.sourceCapturedAt="2026-09-29T05:53:00.000Z";
  stale.pack.generatedAt="2026-09-29T05:53:00.000Z";
  const fresh=structuredClone(stale);
  fresh.sourceLastSeenAt="2026-09-29T15:33:00.000Z";
  fresh.pack.sourceCapturedAt="2026-09-29T15:33:00.000Z";
  fresh.pack.generatedAt="2026-09-29T15:33:00.000Z";
  fresh.pack.sourceHash="teacher-pages-manual-refresh-regression";

  let calls=0;
  await page.route("**/data/study-pack-runtime.json*",async route=>{
    calls++;
    if(calls>1){
      await new Promise(resolve=>setTimeout(resolve,250));
      await route.fulfill({json:fresh});
    }else await route.fulfill({json:stale});
  });
  await page.goto("http://127.0.0.1:4173/#today");
  const status=page.locator("[data-refresh-pack]");
  await expect(status).toContainText("Older data");
  await status.click();
  await expect(page.locator("[data-refresh-pack]")).toContainText("Checking published school info");
  await expect(page.locator("[data-refresh-pack]")).toBeDisabled();
  await expect(page.locator(".freshness")).toHaveClass(/current/);
  await expect(page.locator(".freshness")).toContainText("Verified");
  await expect(page.locator("#toast")).toContainText("School info updated");
  expect(calls).toBeGreaterThanOrEqual(2);
  await context.close();
});

test("manual refresh explains when no newer verified data exists",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T15:34:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const stale=structuredClone(source);
  stale.sourceLastSeenAt="2026-09-29T05:53:00.000Z";
  stale.pack.sourceCapturedAt="2026-09-29T05:53:00.000Z";
  stale.pack.generatedAt="2026-09-29T05:53:00.000Z";
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:stale}));
  await page.goto("http://127.0.0.1:4173/#today");
  await page.locator("[data-refresh-pack]").click();
  await expect(page.locator("#toast")).toContainText("no newer verified update is available yet");
  await expect(page.locator(".freshness")).toHaveClass(/stale/);
  await context.close();
});


test("Week marks distinct test days instead of individual tests",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.importantDates=[
    {date:"Tuesday, Sept. 29",label:"Math test",kind:"test"},
    {date:"Tuesday, Sept. 29",label:"Reading test",kind:"test"},
    {date:"Wednesday, Sept. 30",label:"Grammar test",kind:"test"}
  ];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#family");
  await page.goto("http://127.0.0.1:4173/#week");
  await expect(page.locator("[data-day]")).toHaveCount(5);
  await expect(page.locator("[data-day] .has-test")).toHaveCount(2);
  await context.close();
});


test("derived school-content changes refresh even when source hashes are unchanged",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  let current=structuredClone(source);
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:current}));
  await page.goto("http://127.0.0.1:4173/#family");
  await expect(page.locator(".family-screen")).toBeVisible({timeout:10_000});
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).not.toContainText("Parser-derived current notice");

  current=structuredClone(source);
  current.pack.parentNotices=[...current.pack.parentNotices,"Parser-derived current notice Tuesday, Sept. 29."];
  current.sourceLastSeenAt=new Date().toISOString();
  current.pack.sourceCheckedAt=current.sourceLastSeenAt;
  await page.evaluate(()=>window.dispatchEvent(new Event("online")));

  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Parser-derived current notice");
  await expect(page.locator("#toast")).toContainText("School info updated");
  await context.close();
});


test("undated picture-order details expire after Picture Day",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-02T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.importantDates=[
    {date:"Thursday, Oct. 1",label:"Picture Day",kind:"school event"}
  ];
  fixture.pack.parentNotices=[
    "Picture ordering: package details.",
    "Picture backgrounds: background choices.",
    "Standing undated family information."
  ];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#family");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).not.toContainText("Picture ordering");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).not.toContainText("Picture backgrounds");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Standing undated family information");
  await context.close();
});


test("Week marks a closed weekday as No school",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-12T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:source}));
  await page.goto("http://127.0.0.1:4173/#week");
  await expect(page.locator(".day-detail-title")).toContainText("No school");
  await expect(page.locator(".day-detail-title")).not.toContainText("School day");
  await context.close();
});

test("required parent tasks are not mislabeled as if participating",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const schoolDate=source.pack?.lunchMenu?.[0]?.date;
  expect(schoolDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.clock.setFixedTime(new Date(`${schoolDate}T17:00:00Z`));
  const fixture=structuredClone(source);
  fixture.pack.homework=[
    {day:"Current Homework posting",subject:"Parent",task:"Cover books",due:"Current posting"},
    {day:"Current Homework posting",subject:"Parent",task:"Return permission slip if participating",due:"Current posting"}
  ];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#week");
  const rows=page.locator(".check-item");
  await expect(rows.nth(0)).toContainText("REQUIRED");
  await expect(rows.nth(0)).not.toContainText("IF PARTICIPATING");
  await expect(rows.nth(1)).toContainText("IF PARTICIPATING");
  await context.close();
});

test("Study derives spelling and STAR test dates from the current school calendar",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.importantDates=[
    {date:"Friday, Oct. 2",label:"Spelling (short a / long a) / Handwriting",kind:"test"},
    {date:"Tuesday–Friday, Jan. 12–22",label:"STAR Testing window",kind:"assessment"}
  ];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#study");
  await page.locator('[data-open-prep]').click();
  const spelling=page.locator("[data-study-tests]");
  await expect(spelling.locator("time")).toHaveAttribute("datetime","2026-10-02");
  await expect(spelling.locator("time")).toContainText("Oct 2");
  await expect(spelling).toContainText("Spelling (short a / long a) / Handwriting");
  await expect(spelling.locator("h3")).not.toContainText("STAR Testing window");
  await context.close();

  const starContext=await browser.newContext({serviceWorkers:"block"});
  const starPage=await starContext.newPage();
  await starPage.clock.setFixedTime(new Date("2027-01-10T13:00:00Z"));
  await starPage.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await starPage.goto("http://127.0.0.1:4173/#study");
  await starPage.locator('[data-open-prep]').click();
  const star=starPage.locator("[data-study-tests]");
  await expect(star).toContainText("No verified practice yet");
  await expect(starPage.locator("[data-test-single]")).toBeDisabled();
  await expect(star.locator("time")).toHaveAttribute("datetime","2027-01-12");
  await expect(star.locator("time")).toContainText("Jan 12");
  await expect(star).toContainText("STAR Testing window");
  await expect(star).not.toContainText("Spelling (short a / long a) / Handwriting");
  await starContext.close();
});


test("Today labels closed events as Closed instead of School",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-12T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:source}));
  await page.goto("http://127.0.0.1:4173/#today");
  const closedRow=page.locator(".timeline-row").filter({hasText:"No School — Columbus Day"});
  await expect(closedRow.locator(".timeline-pin")).toHaveClass(/closed/);
  await context.close();
});

test("Study labels a distant test with its actual date and keeps it out of weekly notes",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-13T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.importantDates=[
    {date:"Tuesday–Friday, Jan. 12–22",label:"STAR Testing window",kind:"assessment"}
  ];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#study");
  await page.locator('[data-open-prep]').click();
  const next=page.locator("[data-study-tests]");
  await expect(next).toContainText("No verified practice yet");
  await expect(page.locator("[data-test-single]")).toBeDisabled();
  await expect(next.locator("time")).toHaveAttribute("datetime","2027-01-12");
  await expect(next.locator("time")).toContainText("Jan 12");
  await expect(next).toContainText("STAR Testing window");
  await expect(next).not.toContainText(/this week/i);
  await expect(page.locator("[data-study-source]")).toHaveCount(0);
  const notes=page.locator("[data-study-notes]");
  await notes.locator(":scope > summary").click();
  await expect(notes.locator("[data-note-subject]:not([hidden]) .study-notes-original").first()).toBeVisible();
  await expect(notes.locator("[data-study-notes-content]")).not.toContainText("STAR Testing window");
  await context.close();
});


test("current lunch overrides archive data in the derived index",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-09-29T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.lunchArchive=[...(fixture.pack.lunchArchive||[]).filter(x=>x.date!=="2026-09-29"),{date:"2026-09-29",items:["Archived wrong meal"]}];
  fixture.pack.lunchMenu=[...(fixture.pack.lunchMenu||[]).filter(x=>x.date!=="2026-09-29"),{date:"2026-09-29",items:["Current indexed meal"]}];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".lunch-card")).toContainText("Current indexed meal");
  await expect(page.locator(".lunch-card")).not.toContainText("Archived wrong meal");
  await context.close();
});

test("derived event index preserves every day of multi-day school events",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-19T13:00:00Z"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.importantDates=[{date:"Monday–Tuesday, Oct. 19–20",label:"Parent-Teacher Conferences",kind:"conference"}];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#week");
  await expect(page.locator(".day-detail")).toContainText("Parent-Teacher Conferences");
  await page.locator('[data-day^="2026-10-20"]').click();
  await expect(page.locator(".day-detail")).toContainText("Parent-Teacher Conferences");
  await context.close();
});


test("cached fallback refresh is labeled offline instead of current",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({
    json:source,
    headers:{"x-abvm-cache-fallback":"1"}
  }));
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".freshness")).toHaveClass(/offline/);
  await expect(page.locator(".freshness")).toContainText("Offline");
  await page.locator("[data-refresh-pack]").click();
  await expect(page.locator("#toast")).toContainText("offline");
  await expect(page.locator("#toast")).toContainText("saved school info");
  await context.close();
});
