import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openTab(page,label){
  await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
  if(label==="Study Games")await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
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
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
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
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
    await openTab(page,label);
    const overflow=await page.evaluate(()=>({
      page:document.documentElement.scrollWidth>window.innerWidth+1,
      screen:document.querySelector(".screen")?.scrollWidth>document.querySelector(".screen")?.clientWidth+1
    }));
    expect(overflow.page,label+" page overflows in phone landscape").toBeFalsy();
    expect(overflow.screen,label+" screen overflows in phone landscape").toBeFalsy();
  }
});

test("all six primary tabs render without horizontal overflow",async({page})=>{
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
    await openTab(page,label);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow,label+" has horizontal overflow").toBeFalsy();
  }
});

test("all six primary tabs stay tablet-wide and overflow-free on iPad",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
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

test("all six tabs stay usable in iPad landscape",async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
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
  const hero=await page.locator(".hero-card").boundingBox();
  const brand=await page.locator(".hero-brand").boundingBox();
  expect(hero).not.toBeNull();
  expect(brand).not.toBeNull();
  expect(brand.x).toBeGreaterThan(hero.x+hero.width/2);
  expect(brand.y).toBeGreaterThanOrEqual(hero.y);
  expect(brand.y+brand.height).toBeLessThanOrEqual(hero.y+hero.height+1);
});

test("all six tabs use the tablet layout on large iPad Pro landscape",async({page})=>{
  await page.setViewportSize({width:1366,height:1024});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
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
  for(const label of ["Today","Calendar","Study Games","Family"]){
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
  for(const label of ["Today","Week","Calendar","Study Games","Family"]){
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

  await openTab(page,"Family");
  await page.locator(".family-more summary").click();
  const familyAction=page.locator(".family-more a");
  await expect(familyAction).toBeVisible();
  const familyActionBox=await familyAction.boundingBox();
  expect(familyActionBox).not.toBeNull();
  expect(familyActionBox.height,"Family Study Games link touch target is too short").toBeGreaterThanOrEqual(44);
});

test("visible buttons keep 44px touch targets across primary screens",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
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

test("Today uses a two-column iPad dashboard and stays stacked on phone",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  await page.goto("/#today");
  await expect(page.locator(".today-screen")).toBeVisible({timeout:10_000});
  const hero=await page.locator(".hero-card").boundingBox();
  const priorityHeading=await page.locator(".today-priority-heading").boundingBox();
  const dateHeading=await page.locator(".today-date-heading").boundingBox();
  const priority=await page.locator(".priority-card").boundingBox();
  const panel=await page.locator(".today-panel").boundingBox();
  const lunch=await page.locator(".lunch-card").boundingBox();
  for(const box of [hero,priorityHeading,dateHeading,priority,panel,lunch])expect(box).not.toBeNull();
  expect(hero.width).toBeGreaterThan(priority.width*1.8);
  expect(Math.abs(priorityHeading.y-dateHeading.y)).toBeLessThan(4);
  expect(Math.abs(priority.y-panel.y)).toBeLessThan(4);
  expect(panel.x).toBeGreaterThan(priority.x+priority.width/2);
  expect(Math.abs(lunch.x-priority.x)).toBeLessThan(4);
  expect(lunch.y).toBeGreaterThan(priority.y+priority.height-2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBeFalsy();

  await page.setViewportSize({width:390,height:844});
  await page.goto("/#today");
  await expect(page.locator(".priority-card")).toBeVisible({timeout:10_000});
  const phonePriority=await page.locator(".priority-card").boundingBox();
  const phonePanel=await page.locator(".today-panel").boundingBox();
  expect(phonePanel.y).toBeGreaterThan(phonePriority.y+phonePriority.height-2);
  expect(Math.abs(phonePanel.x-phonePriority.x)).toBeLessThan(4);
});

test("Today exposes the weekly priority and focused checklist",async({page})=>{
  const hero=page.locator(".hero-card");
  await expect(hero).toBeVisible();
  await expect(hero.locator(".hero-brand")).toBeVisible();
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("src",/abvm-app-icon-192\.png/);
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("srcset",/abvm-app-icon-512\.png 512w/);
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("sizes",/min-width:700px/);
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("width","118");
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("height","118");
  await expect(page.locator(".school-mark")).toHaveAttribute("width","52");
  await expect(page.locator(".school-mark")).toHaveAttribute("height","52");
  await expect(hero.locator(".hero-brand small")).toHaveText("FAITH AND EDUCATION");
  await expect(page.locator(".book-buddy,.spark")).toHaveCount(0);
  const heroVisual=await hero.evaluate(el=>({background:getComputedStyle(el).backgroundImage,border:getComputedStyle(el).borderColor}));
  expect(heroVisual.background).toContain("rgb(11, 60, 116)");
  expect(heroVisual.border).not.toBe("rgba(0, 0, 0, 0)");
  await expect(page.locator(".priority-card")).toBeVisible();
  await expect(page.locator(".today-panel")).toBeVisible();
  await expect(page.locator(".timeline-row").first()).toBeVisible();
  await expect(page.locator(".check-item").first()).toBeVisible();
});

test("Today hero uses integrated Assumption branding on iPad",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.goto("/#today");
  const hero=page.locator(".hero-card");
  await expect(hero).toBeVisible({timeout:10_000});
  const brand=hero.locator(".hero-brand");
  const mark=hero.locator(".hero-brand-mark");
  const brandBox=await brand.boundingBox();
  const markBox=await mark.boundingBox();
  const style=await brand.evaluate(el=>{
    const cs=getComputedStyle(el);
    return {background:cs.backgroundColor,borderTop:cs.borderTopStyle,boxShadow:cs.boxShadow};
  });
  expect(brandBox.width).toBeGreaterThanOrEqual(205);
  expect(markBox.width).toBeGreaterThanOrEqual(116);
  expect(style.background).toBe("rgba(0, 0, 0, 0)");
  expect(style.borderTop).toBe("none");
  expect(style.boxShadow).toBe("none");
  await expect(brand).toContainText("ASSUMPTION");
  await expect(brand).toContainText("BVM");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});

test("Today priority card follows navy and gold identity",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  await page.goto("/#today");
  const priority=page.locator(".priority-card");
  const tile=page.locator(".date-tile");
  const dot=page.locator(".heading-dot.pink");
  await expect(priority).toBeVisible({timeout:10_000});
  const visual=await priority.evaluate(el=>{
    const cs=getComputedStyle(el);
    return {background:cs.backgroundImage,border:cs.borderColor};
  });
  const tileVisual=await tile.evaluate(el=>({background:getComputedStyle(el).backgroundImage,shadow:getComputedStyle(el).boxShadow}));
  const dotColor=await dot.evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(visual.background).toContain("linear-gradient");
  expect(tileVisual.background).toContain("rgb(11, 60, 116)");
  expect(tileVisual.shadow).toContain("rgb(217, 183, 87)");
  expect(dotColor).toBe("rgb(216, 179, 78)");
});

test("Today never treats Door Decorating Contest as a test",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  const priority=page.locator(".priority-card");
  await expect(priority).toBeVisible();
  await expect(priority).not.toContainText("Door Decorating Contest");
  await expect(priority).toContainText("Spelling");
  await expect(priority).toContainText("Handwriting");
});


test("Week uses a two-column iPad main area and stays stacked on phone",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.goto("/#week");
  await expect(page.locator(".week-main")).toBeVisible({timeout:10_000});
  const picker=await page.locator(".day-picker").boundingBox();
  const main=await page.locator(".week-main").boundingBox();
  const detail=await page.locator(".day-detail").boundingBox();
  const rail=await page.locator(".week-rail").boundingBox();
  expect(picker).not.toBeNull();
  expect(main).not.toBeNull();
  expect(detail).not.toBeNull();
  expect(rail).not.toBeNull();
  expect(Math.abs(main.width-picker.width)).toBeLessThan(4);
  expect(Math.abs(detail.y-rail.y)).toBeLessThan(4);
  expect(rail.x).toBeGreaterThan(detail.x+detail.width/2);
  expect(detail.width).toBeGreaterThan(rail.width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBeFalsy();

  await page.setViewportSize({width:390,height:844});
  await page.goto("/#week");
  const phoneDetail=await page.locator(".day-detail").boundingBox();
  const phoneRail=await page.locator(".week-rail").boundingBox();
  expect(phoneRail.y).toBeGreaterThan(phoneDetail.y+phoneDetail.height-2);
  expect(Math.abs(phoneRail.x-phoneDetail.x)).toBeLessThan(4);
});

test("Week exposes paging, weekdays, selected-day detail, and reminders",async({page})=>{
  await openTab(page,"Week");
  await expect(page.locator(".week-nav")).toBeVisible();
  await expect(page.locator(".day-picker [data-day]")).toHaveCount(5);
  await expect(page.locator(".day-detail")).toBeVisible();
  await expect(page.locator(".event-stack")).toBeVisible();
  await expect(page.locator(".reminder-strip")).toBeVisible();
});

test("Calendar uses a tablet two-column layout without changing phone stacking",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
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
  expect(Math.abs(summary.y-specials.y)).toBeLessThan(4);
  expect(specials.x).toBeGreaterThan(summary.x+summary.width/2);
  expect(next.width).toBeGreaterThan(summary.width*1.8);
  const tabletOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(tabletOverflow).toBeFalsy();

  await page.setViewportSize({width:390,height:844});
  await page.goto("/#calendar");
  await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
  const phoneMonth=await page.locator(".calendar-card").boundingBox();
  const phoneDay=await page.locator(".calendar-day-card").boundingBox();
  expect(phoneDay.y).toBeGreaterThan(phoneMonth.y+phoneMonth.height-2);
  expect(Math.abs(phoneDay.x-phoneMonth.x)).toBeLessThan(4);
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
      await expect(rows.nth(i).locator(":scope > p")).toHaveCount(1);
    }
  }
  await expect(page.locator(".specials-card")).toBeVisible();
});

test("Study uses a two-column subject grid on iPad and stacks on phone",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.goto("/#study");
  await expect(page.locator(".study-at-a-glance")).toBeVisible({timeout:10_000});
  const cards=page.locator(".study-accordion");
  await expect(cards).toHaveCount(6);
  const boxes=[];
  for(let i=0;i<6;i++)boxes.push(await cards.nth(i).boundingBox());
  for(const box of boxes)expect(box).not.toBeNull();
  expect(Math.abs(boxes[0].y-boxes[1].y)).toBeLessThan(4);
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x+boxes[0].width/2);
  expect(Math.abs(boxes[2].y-boxes[3].y)).toBeLessThan(4);
  expect(Math.abs(boxes[4].y-boxes[5].y)).toBeLessThan(4);
  const atGlance=await page.locator(".study-at-a-glance").boundingBox();
  const gamesCta=await page.locator(".study-games-cta").boundingBox();
  expect(atGlance.width).toBeGreaterThan(boxes[0].width*1.8);
  expect(gamesCta.width).toBeGreaterThan(boxes[0].width*1.8);
  await cards.nth(0).locator("summary").click();
  const tabletOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(tabletOverflow).toBeFalsy();

  await page.setViewportSize({width:390,height:844});
  await page.goto("/#study");
  await expect(page.locator(".study-at-a-glance")).toBeVisible({timeout:10_000});
  const phoneFirst=await page.locator(".study-accordion").nth(0).boundingBox();
  const phoneSecond=await page.locator(".study-accordion").nth(1).boundingBox();
  expect(Math.abs(phoneFirst.x-phoneSecond.x)).toBeLessThan(4);
  expect(phoneSecond.y).toBeGreaterThan(phoneFirst.y+phoneFirst.height-2);
});

test("Study exposes one primary game CTA and collapsed subject details",async({page})=>{
  await openTab(page,"Study");
  await expect(page.locator(".study-at-a-glance")).toBeVisible();
  await expect(page.locator(".study-games-cta")).toBeVisible();
  const details=page.locator(".study-accordion");
  await expect(details).toHaveCount(6);
  for(let i=0;i<await details.count();i++)await expect(details.nth(i)).not.toHaveAttribute("open");
});

test("Study Games loads lazily and starts a playable round",async({page})=>{
  await openTab(page,"Study Games");
  const tiles=page.locator(".study-game-tile");
  expect(await tiles.count()).toBeGreaterThanOrEqual(4);
  for(const name of ["Quick Mix","Math Dash","Word Power","Faith Quest"]){
    await expect(page.getByRole("button",{name:new RegExp(name,"i")})).toBeVisible();
  }
  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  expect(await page.locator(".game-answer").count()).toBe(3);
});

test("Family uses a two-column iPad layout and stays stacked on phone",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.goto("/#family");
  await expect(page.locator(".family-actions-card")).toBeVisible({timeout:10_000});
  const hero=await page.locator(".family-hero").boundingBox();
  const stats=await page.locator(".family-stats").boundingBox();
  const actions=await page.locator(".family-actions-card").boundingBox();
  const notices=await page.locator('[aria-labelledby="family-current-notices"]').boundingBox();
  const more=await page.locator(".family-more").boundingBox();
  for(const box of [hero,stats,actions,notices,more])expect(box).not.toBeNull();
  expect(Math.abs(actions.y-notices.y)).toBeLessThan(4);
  expect(notices.x).toBeGreaterThan(actions.x+actions.width/2);
  expect(hero.width).toBeGreaterThan(actions.width*1.8);
  expect(stats.width).toBeGreaterThan(actions.width*1.8);
  expect(more.width).toBeGreaterThan(actions.width*1.8);
  const schoolChanges=page.locator('[aria-labelledby="school-change-title"]');
  if(await schoolChanges.count()){
    const changes=await schoolChanges.boundingBox();
    expect(changes.width).toBeGreaterThan(actions.width*1.8);
  }
  const tabletOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(tabletOverflow).toBeFalsy();

  await page.setViewportSize({width:390,height:844});
  await page.goto("/#family");
  await expect(page.locator(".family-actions-card")).toBeVisible({timeout:10_000});
  const phoneActions=await page.locator(".family-actions-card").boundingBox();
  const phoneNotices=await page.locator('[aria-labelledby="family-current-notices"]').boundingBox();
  expect(phoneNotices.y).toBeGreaterThan(phoneActions.y+phoneActions.height-2);
  expect(Math.abs(phoneNotices.x-phoneActions.x)).toBeLessThan(4);
});

test("Family exposes current actions, notices, and app/privacy disclosure",async({page})=>{
  await openTab(page,"Family");
  await expect(page.locator(".family-hero")).toBeVisible();
  await expect(page.locator(".family-stats")).toBeVisible();
  await expect(page.locator(".family-actions-card")).toBeVisible();
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toBeVisible();
  await expect(page.locator(".family-more")).toBeVisible();
});

test("all primary screens have no serious or critical automated accessibility violations",async({page})=>{
  const findings=[];
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
    await openTab(page,label);
    const results=await new AxeBuilder({page}).analyze();
    for(const violation of results.violations){
      if(violation.impact==="serious"||violation.impact==="critical"){
        findings.push({screen:label,id:violation.id,impact:violation.impact,nodes:violation.nodes.length});
      }
    }
  }
  expect(findings).toEqual([]);
});


test("bottom navigation is a single six-column row",async({page})=>{
  const nav=page.locator(".bottom-nav");
  await expect(nav.locator("button")).toHaveCount(6);
  const layout=await nav.evaluate(el=>{
    const style=getComputedStyle(el);
    return {
      columns:style.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      rows:style.gridTemplateRows.split(/\s+/).filter(Boolean).length
    };
  });
  expect(layout.columns).toBe(6);
  expect(layout.rows).toBe(1);
});


test("Study Games uses the iPad canvas with priority hierarchy and tablet nav",async({page})=>{
  await page.setViewportSize({width:810,height:1080});
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-04:00"));
  await page.goto("/#games");
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  const appBox=await page.locator(".phone-app").boundingBox();
  expect(appBox).not.toBeNull();
  expect(appBox.width).toBeGreaterThan(700);

  const ready=await page.getByRole("button",{name:/Test Ready/i}).boundingBox();
  const quick=await page.getByRole("button",{name:/Quick Mix/i}).boundingBox();
  const math=await page.getByRole("button",{name:/Math Dash/i}).boundingBox();
  expect(ready).not.toBeNull();
  expect(quick).not.toBeNull();
  expect(math).not.toBeNull();
  expect(ready.width).toBeGreaterThan(quick.width*1.8);
  expect(Math.abs(quick.y-math.y)).toBeLessThan(4);

  const readyVisual=await page.getByRole("button",{name:/Test Ready/i}).evaluate(el=>{
    const svg=el.querySelector(".game-icon-test-ready svg");
    return {fill:svg.getAttribute("fill"),stroke:svg.getAttribute("stroke"),width:svg.getAttribute("stroke-width")};
  });
  expect(readyVisual).toEqual({fill:"none",stroke:"currentColor",width:"2"});

  const navButton=await page.locator(".bottom-nav button").first().boundingBox();
  const navIcon=await page.locator(".bottom-nav .nav-icon").first().boundingBox();
  expect(navButton.height).toBeGreaterThanOrEqual(64);
  expect(navIcon.width).toBeGreaterThanOrEqual(48);

  let overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();

  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible({timeout:10_000});
  const promptSize=await page.locator(".game-question-card>h2").evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  const answer=await page.locator(".game-answer").first().boundingBox();
  const answerSize=await page.locator(".game-answer strong").first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(promptSize).toBeGreaterThanOrEqual(23);
  expect(answer.height).toBeGreaterThanOrEqual(66);
  expect(answerSize).toBeGreaterThanOrEqual(15);
  overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});
