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
  await page.setViewportSize({width:1080,height:810});
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
    expect(appBox.y+appBox.height,label+" app extends below viewport").toBeLessThanOrEqual(811);
    expect(navBox.y+navBox.height,label+" nav extends below viewport").toBeLessThanOrEqual(811);
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

test("Today exposes the weekly priority and focused checklist",async({page})=>{
  const hero=page.locator(".hero-card");
  await expect(hero).toBeVisible();
  await expect(hero.locator(".hero-brand")).toBeVisible();
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("src",/abvm-app-icon-192\.png/);
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("srcset",/abvm-app-icon-512\.png 512w/);
  await expect(hero.locator(".hero-brand img")).toHaveAttribute("sizes",/min-width:700px/);
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
  await page.addInitScript(()=>{
    const RealDate=Date,fixed=new RealDate("2026-10-01T12:00:00-04:00").valueOf();
    class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
    window.Date=FixedDate;
  });
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
  await page.addInitScript(()=>{
    const RealDate=Date;
    const fixed=new RealDate("2026-10-01T12:00:00-04:00").valueOf();
    class FixedDate extends RealDate{
      constructor(...args){super(...(args.length?args:[fixed]));}
      static now(){return fixed;}
    }
    window.Date=FixedDate;
  });
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  const priority=page.locator(".priority-card");
  await expect(priority).toBeVisible();
  await expect(priority).not.toContainText("Door Decorating Contest");
  await expect(priority).toContainText("Spelling");
  await expect(priority).toContainText("Handwriting");
});

test("Week exposes paging, weekdays, selected-day detail, and reminders",async({page})=>{
  await openTab(page,"Week");
  await expect(page.locator(".week-nav")).toBeVisible();
  await expect(page.locator(".day-picker [data-day]")).toHaveCount(5);
  await expect(page.locator(".day-detail")).toBeVisible();
  await expect(page.locator(".event-stack")).toBeVisible();
  await expect(page.locator(".reminder-strip")).toBeVisible();
});

test("Calendar keeps the current-month summary as concise as next month",async({page})=>{
  await page.addInitScript(()=>{
    const RealDate=Date,fixed=new RealDate("2026-10-01T12:00:00-04:00").valueOf();
    class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
    window.Date=FixedDate;
  });
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

test("Family exposes current actions, notices, and app/privacy disclosure",async({page})=>{
  await openTab(page,"Family");
  await expect(page.locator(".family-hero")).toBeVisible();
  await expect(page.locator(".family-stats")).toBeVisible();
  await expect(page.locator(".family-actions-card")).toBeVisible();
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toBeVisible();
  await expect(page.locator(".family-more")).toBeVisible();
});

test("current app has no critical automated accessibility violations",async({page})=>{
  const results=await new AxeBuilder({page}).analyze();
  const critical=results.violations.filter(v=>v.impact==="critical");
  expect(critical.map(v=>({id:v.id,nodes:v.nodes.length}))).toEqual([]);
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
  await page.addInitScript(()=>{
    const RealDate=Date,fixed=new RealDate("2026-10-01T12:00:00-04:00").valueOf();
    class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
    window.Date=FixedDate;
  });
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
