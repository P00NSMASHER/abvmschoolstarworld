import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFileSync} from "node:fs";

async function openTab(page,label){
  if(label==="Week"){
    await page.locator('.bottom-nav [data-tab="calendar"]').click();
    await page.locator('[data-route="week"]').click();
  }else if(label==="Study Games"){
    await page.goto("/#games");
  }else await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
  if(label==="Study"||label==="Study Games"){
    await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:10_000});
    await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  }
}
test.beforeEach(async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
});

test("all primary screens emit no uncaught or console errors",async({page})=>{
  const errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{
    if(message.type()==="error")errors.push("console: "+message.text());
  });
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
  }
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
});

test("phone landscape respects horizontal safe areas and stays overflow-free",async({page,request})=>{
  const css=await (await request.get("/styles.css")).text();
  expect(css).toContain("safe-area-inset-left");
  expect(css).toContain("safe-area-inset-right");
  await page.setViewportSize({width:844,height:390});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
    const overflow=await page.evaluate(()=>({
      page:document.documentElement.scrollWidth>window.innerWidth+1,
      screen:document.querySelector(".screen")?.scrollWidth>document.querySelector(".screen")?.clientWidth+1
    }));
    expect(overflow.page,label+" page overflows in phone landscape").toBeFalsy();
    expect(overflow.screen,label+" screen overflows in phone landscape").toBeFalsy();
  }
});

test("all six destinations render without horizontal overflow",async({page})=>{
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow,label+" has horizontal overflow").toBeFalsy();
  }
});

test("all six destinations stay tablet-wide and overflow-free on iPad",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
    const appBox=await page.locator(".phone-app").boundingBox();
    expect(appBox,label+" app shell missing").not.toBeNull();
    expect(appBox.width,label+" collapsed to phone width").toBeGreaterThan(700);
    const layout=await page.locator(".screen").evaluate(el=>({
      screenOverflow:el.scrollWidth>el.clientWidth+1,
      pageOverflow:document.documentElement.scrollWidth>window.innerWidth+1
    }));
    expect(layout.screenOverflow,label+" screen overflows horizontally").toBeFalsy();
    expect(layout.pageOverflow,label+" page overflows horizontally").toBeFalsy();
  }
});

test("all six destinations stay usable in iPad landscape",async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
    const appBox=await page.locator(".phone-app").boundingBox();
    const navBox=await page.locator(".bottom-nav").boundingBox();
    expect(appBox,label+" app shell missing").not.toBeNull();
    expect(navBox,label+" bottom nav missing").not.toBeNull();
    expect(appBox.width,label+" landscape shell is too narrow").toBeGreaterThanOrEqual(800);
    expect(appBox.y,label+" app starts above viewport").toBeGreaterThanOrEqual(0);
    expect(appBox.y+appBox.height,label+" app extends below viewport").toBeLessThanOrEqual(769);
    expect(navBox.y+navBox.height,label+" nav extends below viewport").toBeLessThanOrEqual(769);
    const layout=await page.locator(".screen").evaluate(el=>({
      screenOverflow:el.scrollWidth>el.clientWidth+1,
      pageOverflow:document.documentElement.scrollWidth>window.innerWidth+1
    }));
    expect(layout.screenOverflow,label+" screen overflows horizontally in landscape").toBeFalsy();
    expect(layout.pageOverflow,label+" page overflows horizontally in landscape").toBeFalsy();
  }
  await openTab(page,"Today");
  await expect(page.locator(".hero-photo")).toBeVisible();
});

test("all six destinations use the tablet layout on large iPad Pro landscape",async({page})=>{
  await page.setViewportSize({width:1366,height:1024});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
    const appBox=await page.locator(".phone-app").boundingBox();
    expect(appBox,label+" large-iPad shell missing").not.toBeNull();
    expect(appBox.width,label+" fell back to phone width on large iPad").toBeGreaterThanOrEqual(1000);
    const overflow=await page.locator(".screen").evaluate(el=>({
      screen:el.scrollWidth>el.clientWidth+1,
      page:document.documentElement.scrollWidth>window.innerWidth+1
    }));
    expect(overflow.screen,label+" screen overflows on large iPad").toBeFalsy();
    expect(overflow.page,label+" page overflows on large iPad").toBeFalsy();
  }
  await openTab(page,"Study Games");
  const gridStyle=await page.locator(".study-game-grid").evaluate(el=>getComputedStyle(el).gridTemplateColumns);
  expect(gridStyle.trim().split(/\s+/).length).toBe(2);
});

test("large iPad Pro portrait uses the expanded tablet shell",async({page})=>{
  await page.setViewportSize({width:1024,height:1366});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Calendar","Study Games","Progress"]){
    await openTab(page,label);
    const appBox=await page.locator(".phone-app").boundingBox();
    expect(appBox,label+" portrait shell missing").not.toBeNull();
    expect(appBox.width,label+" portrait shell is underusing the canvas").toBeGreaterThanOrEqual(930);
    expect(appBox.height,label+" portrait shell is underusing vertical space").toBeGreaterThanOrEqual(1200);
    expect(appBox.y+appBox.height,label+" portrait shell extends below viewport").toBeLessThanOrEqual(1367);
    const overflow=await page.locator(".screen").evaluate(el=>({
      screen:el.scrollWidth>el.clientWidth+1,
      page:document.documentElement.scrollWidth>window.innerWidth+1
    }));
    expect(overflow.screen,label+" portrait screen overflows").toBeFalsy();
    expect(overflow.page,label+" portrait page overflows").toBeFalsy();
  }
});

test("freshness refresh control keeps a 44px touch target",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study Games","Progress"]){
    await openTab(page,label);
    const control=page.locator(".freshness");
    await expect(control,label+" freshness control missing").toBeVisible();
    const box=await control.boundingBox();
    expect(box,label+" freshness box missing").not.toBeNull();
    expect(box.height,label+" freshness touch target is too short").toBeGreaterThanOrEqual(44);
  }
  await openTab(page,"Calendar");
  await page.getByRole("button",{name:"Next month"}).click();
  const back=page.locator(".calendar-today-jump");
  await expect(back).toBeVisible();
  const backBox=await back.boundingBox();
  expect(backBox).not.toBeNull();
  expect(backBox.height,"Back to current month touch target is too short").toBeGreaterThanOrEqual(44);

  await openTab(page,"Progress");
  const familyAction=page.locator(".notices-card .family-message summary").first();
  await expect(familyAction).toBeVisible();
  const familyActionBox=await familyAction.boundingBox();
  expect(familyActionBox).not.toBeNull();
  expect(familyActionBox.height,"Family notice disclosure touch target is too short").toBeGreaterThanOrEqual(44);
});

test("visible buttons keep 44px touch targets across primary screens",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
    const undersized=await page.locator(".screen button:visible, .bottom-nav button:visible").evaluateAll(nodes=>nodes
      .map(node=>{
        const box=node.getBoundingClientRect();
        return {text:(node.getAttribute("aria-label")||node.textContent||"").trim().replace(/\s+/g," ").slice(0,80),height:box.height,width:box.width};
      })
      .filter(item=>item.height<43.5));
    expect(undersized,label+" has undersized visible buttons").toEqual([]);
  }
});









test("Today never treats Door Decorating Contest as a test",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  const priority=page.locator(".priority-card");
  await expect(priority).toBeVisible();
  await expect(priority).not.toContainText("Door Decorating Contest");
  await expect(priority.locator("h3")).not.toHaveText("");
});


test("Today does not show Attend Mass before the verified Mass date",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00-04:00"));
  await page.goto("/#today");
  await expect(page.locator(".today-panel")).toBeVisible({timeout:10_000});
  await expect(page.locator(".today-panel .task-list")).not.toContainText("Attend Mass");
  await expect(page.locator(".today-panel .timeline")).not.toContainText(/\bMass\b/);
});

test("Today shows Attend Mass on the verified Mass date",async({page,browser})=>{
  const source=await (await page.request.get("/data/study-pack.json")).json();
  expect(source.pack.importantDates.some(item=>/Oct\. 7/i.test(item.date||"")&&/\bMass\b/i.test(item.label||""))).toBe(true);
  const fixture=structuredClone(source);
  if(!fixture.pack.homework.some(item=>/Attend Mass/i.test(item.task||""))){
    fixture.pack.homework.push({day:"Current Homework posting",subject:"Religion",task:"Attend Mass",due:"Current posting"});
  }
  fixture.pack.sourceHash=String(fixture.pack.sourceHash||"current")+"-mass-date-regression";
  const context=await browser.newContext({serviceWorkers:"block"});
  const fixturePage=await context.newPage();
  await fixturePage.clock.setFixedTime(new Date("2026-10-07T12:00:00-04:00"));
  await fixturePage.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await fixturePage.goto("http://127.0.0.1:4173/#today");
  await expect(fixturePage.locator(".today-panel")).toBeVisible({timeout:10_000});
  await expect(fixturePage.locator(".today-panel .task-list")).toContainText("Attend Mass");
  await expect(fixturePage.locator(".today-panel .timeline")).toContainText(/Mass/);
  await context.close();
});



test("Week exposes paging, weekdays, selected-day detail, and reminders",async({page})=>{
  await openTab(page,"Week");
  await expect(page.locator(".week-nav")).toBeVisible();
  await expect(page.locator(".day-picker [data-day]")).toHaveCount(5);
  await expect(page.locator(".day-detail")).toBeVisible();
  await expect(page.locator(".event-stack")).toBeVisible();
  await expect(page.locator(".reminder-strip")).toBeVisible();
});

test("Calendar splits on wide tablets and stacks on portrait tablets and phones",async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
  const month=await page.locator(".calendar-card").boundingBox();
  const day=await page.locator(".calendar-day-card").boundingBox();
  const summary=await page.locator(".current-month-summary").boundingBox();
  const specials=await page.locator(".specials-card").boundingBox();
  const next=await page.locator(".next-month-card").boundingBox();
  for(const box of [month,day,summary,specials,next])expect(box).not.toBeNull();
  expect(Math.abs(month.y-day.y)).toBeLessThan(4);
  expect(day.x).toBeGreaterThan(month.x+month.width/2);
  expect(specials.y).toBeGreaterThanOrEqual(summary.y+summary.height-2);
  expect(next.y).toBeGreaterThanOrEqual(specials.y+specials.height-2);
  expect(Math.abs(specials.x-summary.x)).toBeLessThan(4);
  expect(Math.abs(next.width-summary.width)).toBeLessThan(4);
  const tabletOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(tabletOverflow).toBeFalsy();

  for(const viewport of [{width:768,height:1024},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.goto("/#calendar");
    await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
    const stackedMonth=await page.locator(".calendar-card").boundingBox();
    const stackedDay=await page.locator(".calendar-day-card").boundingBox();
    expect(stackedDay.y,viewport.width+"px selected-day details stack below month").toBeGreaterThan(stackedMonth.y+stackedMonth.height-2);
    expect(Math.abs(stackedDay.x-stackedMonth.x)).toBeLessThan(4);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const targets=await page.locator('[data-cal-day]').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
    for(const target of targets){expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);}
  }
});

test("Calendar keeps the current-month summary as concise as next month",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
  expect(await page.locator("[data-cal-day]").count()).toBeGreaterThan(27);
  await expect(page.locator(".calendar-day-card")).toBeVisible();
  const summary=page.locator(".current-month-summary");
  await expect(summary).toBeVisible();
  await expect(summary.locator("h2")).toHaveText("Coming in October");
  await expect(summary.locator(":scope > div")).toHaveCount(5);
  await expect(summary).not.toContainText("School day");
  await expect(summary.locator(".agenda-lunch")).toHaveCount(0);
  await expect(summary.locator(".agenda-day")).toHaveCount(0);
  const nextSummary=page.locator(".next-month-card");
  await expect(nextSummary).toBeVisible();
  await expect(summary).toHaveClass(/compact-month-card/);
  await expect(nextSummary).toHaveClass(/compact-month-card/);
  for(const card of [summary,nextSummary]){
    const rows=card.locator(":scope > div");
    for(let i=0;i<await rows.count();i++){
      await expect(rows.nth(i).locator(":scope > span")).toHaveCount(1);
      const events=rows.nth(i).locator(':scope > ul[role="list"] > li');
      expect(await events.count()).toBeGreaterThan(0);
      for(const event of await events.all())await expect(event).not.toBeEmpty();
    }
  }
  await expect(page.locator(".specials-card")).toBeVisible();
});



test("Study opens the four Games directly with source selection and collapsed notes and test management",async({page})=>{
  await openTab(page,"Study");
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  await expect(page.locator('.study-game-grid > .study-game-tile')).toHaveCount(5);
  await expect(page.locator('[data-study-source]')).toHaveCount(0);
  await expect(page.locator('[data-open-prep]')).toBeVisible();
  await expect(page.locator('[data-test-select]')).toHaveCount(0);
  await expect(page.locator('.study-games-cta,.study-room-v2,[data-learning-panel]')).toHaveCount(0);
  const details=page.locator('[data-study-notes],[data-study-test-options]');
  await expect(details).toHaveCount(2);
  for(let i=0;i<await details.count();i++)await expect(details.nth(i)).not.toHaveAttribute("open");
});

test("Study Games loads lazily and starts a playable round",async({page})=>{
  await openTab(page,"Study Games");
  const tiles=page.locator(".study-game-tile");
  await expect(tiles).toHaveCount(5);
  for(const name of ["Mix","Math","Reading / ELA","Religion"]){
    await expect(page.getByRole("button",{name:new RegExp(name,"i")})).toBeVisible();
  }
  await page.getByRole("button",{name:/Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  const answerCount=await page.locator(".game-answer").count();
  expect(answerCount).toBeGreaterThanOrEqual(3);
  expect(answerCount).toBeLessThanOrEqual(4);
});



test("Family exposes current actions and notices without the removed privacy box",async({page})=>{
  await openTab(page,"Progress");
  await expect(page.locator(".family-hero")).toBeVisible();
  await expect(page.locator(".learning-library")).toBeVisible();
  await expect(page.locator(".family-actions-card")).toBeVisible();
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toBeVisible();
  await expect(page.locator(".family-more")).toHaveCount(0);
});

test("latest reviewed phone uploads reach Family with a safe registration link",async({page})=>{
  await openTab(page,"Progress");
  const notices=page.locator('[aria-labelledby="family-current-notices"]');
  await expect(notices).toContainText("CYO registration for 2nd graders");
  await expect(notices).toContainText("Gift Card Calendar update: two $50 winners");
  await expect(notices).toContainText("Winner and seller names are kept out of the public app");

  await notices.locator(".family-message").filter({hasText:"CYO registration for 2nd graders"}).locator("summary").click();
  const registration=notices.getByRole("link",{
    name:"tools.signupgenius.com/c/st-nicholas-basketball-registration-k-1st-grade-copy"
  });
  await expect(registration).toHaveAttribute("href","https://tools.signupgenius.com/c/st-nicholas-basketball-registration-k-1st-grade-copy");
  await expect(registration).toHaveAttribute("target","_blank");
  await expect(registration).toHaveAttribute("rel",/\bnoopener\b/);
});

test("all primary screens have no serious or critical automated accessibility violations",async({page})=>{
  const findings=[];
  for(const label of ["Today","Week","Calendar","Study","Study Games","Progress"]){
    await openTab(page,label);
    if(label==="Study"||label==="Study Games")await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready");
    // Assess settled navigation content, rather than intermediate opacity frames.
    await page.locator(".screen").evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
    const results=await new AxeBuilder({page}).analyze();
    for(const violation of results.violations){
      if(violation.impact==="serious"||violation.impact==="critical"){
        findings.push({screen:label,id:violation.id,impact:violation.impact,nodes:violation.nodes.map(node=>({target:node.target,summary:node.failureSummary}))});
      }
    }
  }
  expect(findings).toEqual([]);
});


test("bottom navigation is a four primary destinations",async({page})=>{
  const nav=page.locator(".bottom-nav");
  await expect(nav.locator("button")).toHaveCount(4);
  const boxes=await nav.locator('button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
  const tablet=page.viewportSize().width>=744;
  const axis=tablet?'x':'y';
  expect(Math.max(...boxes.map(b=>b[axis]))-Math.min(...boxes.map(b=>b[axis]))).toBeLessThanOrEqual(2);

});


test("newly imported Yahoo notices never make older teacher checks appear verified",async({browser})=>{
  // Fresh context prevents the production service worker from bypassing the fixture route.
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  try{
  // Deliberately stay in the 8–30h "older" band. Fixed calendar dates
  // drifted past 30h during CI and asserted the wrong severity label.
  // Verify the real teacher-check timestamp, not the newer Yahoo timestamp.
  const checkedAt=new Date(Date.now()-24*60*60*1000).toISOString();
  const noticeAt=new Date(Date.now()-60*1000).toISOString();
  const etDate=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric"});
  const expectedTeacherDay=etDate.format(new Date(checkedAt));
  const newerNoticeDay=etDate.format(new Date(noticeAt));
  expect(expectedTeacherDay).not.toBe(newerNoticeDay);
  const data=structuredClone(JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8")));
  data.sourceLastCheckedAt=checkedAt;
  data.pack.sourceCheckedAt=checkedAt;
  // Simulate a Yahoo notice arriving minutes ago while the six teacher
  // pages have not been successfully checked again.
  data.sourceLastSeenAt=noticeAt;
  data.sourceCapturedAt=noticeAt;
  data.pack.sourceCapturedAt=noticeAt;
  data.pack.generatedAt=noticeAt;
  let interceptedPackRequests=0;
  await page.route("**/data/study-pack*.json*",route=>{
    interceptedPackRequests++;
    return route.fulfill({json:data});
  });
  await page.goto("/#today");
  const freshness=page.locator(".freshness");
  await expect(freshness).toBeVisible();
  await expect(freshness).toContainText("Teacher pages older");
  await expect(freshness).toContainText(expectedTeacherDay);
  await expect(freshness).not.toContainText(newerNoticeDay);
  await expect(freshness).not.toContainText("Teacher pages verified");
  await expect(freshness).toHaveClass(/\bstale\b/);
  // Without this assertion, a service-worker cache could make this test pass or fail
  // against unrelated live pack data rather than our synthetic teacher timestamps.
  expect(interceptedPackRequests).toBeGreaterThan(0);
  }finally{
    await context.close();
  }
});
