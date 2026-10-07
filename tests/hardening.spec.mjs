import {test,expect} from "@playwright/test";

async function openTab(page,label){
  if(label==="Week"){
    await page.locator('.bottom-nav [data-tab="calendar"]').click();
    await page.locator('[data-route="week"]').click();
  }else await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
}

test.beforeEach(async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
});

test("Today uses permanent task policy instead of date-specific housekeeping",async({page})=>{
  const text=await page.locator(".today-panel").innerText();
  expect(text).toContain("Read");
  expect(text).toContain("20 minutes today");
  expect(text).not.toContain("Cover books");
  expect(text).not.toContain("Keep Reading Log and Behavior Chart in the HW folder");
  expect(text).not.toContain("Return everything in the HW folder");
  const source=await (await page.request.get("/app.js")).text();
  expect(source).toContain("function taskPolicy");
  expect(source).not.toContain("isSep28");
});

test("Calendar can browse months and return to the current month",async({page})=>{
  await openTab(page,"Calendar");
  const heading=page.locator(".calendar-month-nav strong");
  const initial=(await heading.textContent())?.trim();
  await page.getByRole("button",{name:"Next month"}).click();
  await expect(heading).not.toHaveText(initial||"");
  await expect(page.locator(".calendar-today-jump")).toBeVisible();
  await page.getByRole("button",{name:"Previous month"}).click();
  await expect(heading).toHaveText(initial||"");
  await page.getByRole("button",{name:"Next month"}).click();
  await page.locator("[data-cal-today]").click();
  await expect(heading).toHaveText(initial||"");
});

test("freshness states distinguish current, stale, and offline data",async({browser})=>{
  const staleContext=await browser.newContext({serviceWorkers:"block"});
  const stalePage=await staleContext.newPage();
  await stalePage.route("**/data/study-pack-runtime.json",async route=>{
    const response=await route.fetch();
    const body=await response.json();
    const stale=new Date(Date.now()-12*3600_000).toISOString();
    body.sourceLastSeenAt=stale;
    body.pack.sourceCapturedAt=stale;
    body.pack.generatedAt=stale;
    await route.fulfill({response,json:body});
  });
  await stalePage.goto("http://127.0.0.1:4173/#today");
  await expect(stalePage.locator(".freshness")).toHaveClass(/stale/);
  await expect(stalePage.locator(".freshness")).toContainText(/Older data/);
  await staleContext.close();

  const offlineContext=await browser.newContext();
  const offlinePage=await offlineContext.newPage();
  await offlinePage.goto("http://127.0.0.1:4173/#today");
  await expect(offlinePage.locator(".screen")).toBeVisible({timeout:10_000});
  await offlinePage.evaluate(async()=>{if("serviceWorker" in navigator)await navigator.serviceWorker.ready});
  await offlinePage.reload();
  await offlineContext.setOffline(true);
  await offlinePage.reload({waitUntil:"domcontentloaded"});
  await expect(offlinePage.locator(".freshness")).toHaveClass(/offline/);
  await expect(offlinePage.locator(".freshness")).toContainText(/Offline · last verified/);
  await offlineContext.setOffline(false);
  await offlineContext.close();
});

test("Week reminders follow the selected day instead of the first reminder",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-09-30T12:00:00-04:00"));
  await openTab(page,"Week");
  const days=page.locator("[data-day]");
  await days.nth(1).click();
  await expect(page.locator(".reminder-strip")).toContainText(/OptionC|conference/i);
  await days.nth(2).click();
  await expect(page.locator(".reminder-strip")).toContainText(/Mass|Communication Folder|Chick-fil-A/i);
  await days.nth(3).click();
  await expect(page.locator(".reminder-strip")).toContainText(/Picture Day|Business Casual|HSA/i);
});

test("Family reuses the task policy and does not promote background routines",async({page})=>{
  await openTab(page,"Progress");
  const actions=await page.locator(".family-actions-card").innerText();
  expect(actions).not.toContain("Cover books");
  expect(actions).not.toContain("Keep Reading Log and Behavior Chart in the HW folder");
  expect(actions).not.toContain("Return everything in the HW folder");
  expect(actions).not.toMatch(/^.*\bRead\b.*$/m);
  expect(actions).toMatch(/OptionC|fundraiser|Picture Day|Mass|Chick-fil-A/i);
});

test("Calendar Specials are rendered from the verified Specials source",async({page})=>{
  const data=await (await page.request.get("/data/study-pack.json")).json();
  const expected=data.pack.subjects.find(s=>s.subject==="Specials")?.topics||[];
  await openTab(page,"Calendar");
  await page.locator(".specials-card").scrollIntoViewIfNeeded();
  const rows=page.locator(".special-row");
  await expect(rows).toHaveCount(expected.length);
  for(let i=0;i<expected.length;i++){
    const [day,...rest]=expected[i].split(":");
    await expect(rows.nth(i).locator("span")).toHaveText(day.slice(0,3));
    await expect(rows.nth(i).locator("strong")).toHaveText(rest.join(":").trim());
  }
});

test("interactive day and checklist controls expose selected/completion state",async({page})=>{
  await openTab(page,"Week");
  for(const button of await page.locator("[data-day]").all()){
    await expect(button).toHaveAttribute("aria-label",/.+/);
    await expect(button).toHaveAttribute("aria-pressed",/true|false/);
  }
  await openTab(page,"Calendar");
  const cal=page.locator("[data-cal-day]").first();
  await expect(cal).toHaveAttribute("aria-label",/.+/);
  await expect(cal).toHaveAttribute("aria-pressed",/true|false/);
  await openTab(page,"Today");
  const check=page.locator("[data-check]").first();
  await expect(check).toHaveAttribute("aria-label",/Mark complete|Completed/);
  await expect(check).toHaveAttribute("aria-pressed",/true|false/);
  expect(await page.locator("#app-content").getAttribute("aria-live")).toBeNull();
  await expect(page.locator("#toast")).toHaveAttribute("role","status");
  await expect(page.locator("#toast")).toHaveAttribute("aria-live","polite");
});

test("generated runtime school pack is substantially smaller but keeps the live question bank",async({request})=>{
  const [fullResponse,runtimeResponse]=await Promise.all([
    request.get("/data/study-pack.json"),
    request.get("/data/study-pack-runtime.json")
  ]);
  expect(fullResponse.ok()).toBeTruthy();
  expect(runtimeResponse.ok()).toBeTruthy();
  const [fullText,runtimeText]=await Promise.all([fullResponse.text(),runtimeResponse.text()]);
  const full=JSON.parse(fullText),runtime=JSON.parse(runtimeText);
  expect(runtime.pack.sourceHash).toBe(full.pack.sourceHash);
  expect(runtime.pack.contentPipeline.questions).toHaveLength(full.pack.contentPipeline.questions.length);
  expect(runtimeText.length).toBeLessThan(fullText.length*.7);
  expect(runtime.pack.contentPipeline.questions[0]).not.toHaveProperty("sourceLineage");
  expect(runtime.pack.contentPipeline.questions[0]).not.toHaveProperty("rubric");
});

test("service worker keeps school data network-first and static assets stale-while-revalidate",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  expect(source).toContain('endsWith("/data/study-pack-runtime.json")');
  expect(source).toContain('networkFirst(event.request,"./data/study-pack.json",event)');
  expect(source).toContain('endsWith("/data/study-pack.json")');
  expect(source).toContain("networkFirst(event.request,null,event)");
  expect(source).toContain("staleWhileRevalidate(event.request,event)");
  expect(source).toMatch(/const CACHE = "abvm-grade2-parent-companion-v[0-9]+-[a-z-]+"/);
});
