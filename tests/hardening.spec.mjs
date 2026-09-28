import {test,expect} from "@playwright/test";

async function openTab(page,label){
  await page.getByRole("button",{name:label,exact:true}).click();
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

test("freshness states distinguish current, stale, and offline data",async({page,context})=>{
  await expect(page.locator(".freshness")).toHaveClass(/current/);
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.locator(".freshness")).toHaveClass(/offline/);
  await expect(page.locator(".freshness")).toContainText(/Offline · last verified/);
  await context.setOffline(false);

  await page.route("**/data/study-pack.json",async route=>{
    const response=await route.fetch();
    const body=await response.json();
    const stale=new Date(Date.now()-12*3600_000).toISOString();
    body.sourceLastSeenAt=stale;
    body.pack.sourceCapturedAt=stale;
    body.pack.generatedAt=stale;
    await route.fulfill({response,json:body});
  });
  await page.goto("/#today");
  await expect(page.locator(".freshness")).toHaveClass(/stale/);
  await expect(page.locator(".freshness")).toContainText(/Older data/);
});

test("Week reminders follow the selected day instead of the first reminder",async({page})=>{
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
  await openTab(page,"Family");
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
  const rows=await page.locator(".special-row").allInnerTexts();
  expect(rows).toHaveLength(expected.length);
  for(const topic of expected){
    const [day,...rest]=topic.split(":");
    const needle=day.slice(0,3)+" "+rest.join(":").trim();
    expect(rows.join("\n")).toContain(needle);
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
  await expect(page.locator("#app-content")).toHaveAttribute("aria-live","polite");
});

test("service worker keeps school data network-first and static assets stale-while-revalidate",async({request})=>{
  const source=await (await request.get("/sw.js")).text();
  expect(source).toContain('endsWith("/data/study-pack.json")');
  expect(source).toContain("networkFirst(event.request,null)");
  expect(source).toContain("staleWhileRevalidate(event.request)");
  expect(source).toContain("v70-hardening");
});
