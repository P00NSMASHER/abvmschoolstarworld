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

test("Today exposes the weekly priority and focused checklist",async({page})=>{
  await expect(page.locator(".hero-card")).toBeVisible();
  await expect(page.locator(".priority-card")).toBeVisible();
  await expect(page.locator(".today-panel")).toBeVisible();
  await expect(page.locator(".timeline-row").first()).toBeVisible();
  await expect(page.locator(".check-item").first()).toBeVisible();
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

test("Calendar exposes month grid, selected-day detail, full agenda, and specials",async({page})=>{
  await openTab(page,"Calendar");
  await expect(page.locator(".calendar-card")).toBeVisible();
  expect(await page.locator("[data-cal-day]").count()).toBeGreaterThan(27);
  await expect(page.locator(".calendar-day-card")).toBeVisible();
  await expect(page.locator(".month-agenda")).toBeVisible();
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
