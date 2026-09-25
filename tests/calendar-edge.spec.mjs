import {test,expect} from "@playwright/test";

async function openCalendar(page){
  await page.goto("/#calendar");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await expect(page.locator(".calendar-heading h2")).toBeVisible();
}
const MONTH_INDEX={January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11};
async function goToMonth(page,targetYear,targetMonth){
  const targetIndex=targetYear*12+MONTH_INDEX[targetMonth];
  for(let i=0;i<30;i++){
    const label=(await page.locator(".calendar-heading h2").textContent())?.trim()||"";
    const match=label.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if(!match)throw new Error("Unparseable calendar heading: "+label);
    const currentIndex=Number(match[2])*12+MONTH_INDEX[match[1]];
    if(currentIndex===targetIndex)return;
    await page.getByRole("button",{name:currentIndex<targetIndex?"Next month":"Previous month"}).click();
  }
  throw new Error(`Could not navigate to ${targetMonth} ${targetYear}`);
}
async function chooseDate(page,pattern){
  const button=page.getByRole("button",{name:pattern}).first();
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed","true");
}

test("half-day plus regular event remain independently visible",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"November");
  await chooseDate(page,/Friday, November 6/i);
  await expect(page.locator(".calendar-detail-row.schedule")).toContainText(/Half Day/i);
  await expect(page.locator(".calendar-day-card")).toContainText(/Articulation Meeting/i);
});

test("no-school days remain unmistakable",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"October");
  await chooseDate(page,/Monday, October 12/i);
  await expect(page.locator(".calendar-day-status")).toContainText(/No School/i);
  await expect(page.locator(".calendar-detail-row.schedule")).toContainText(/School is closed/i);
});

test("busy dates expose multiple events without horizontal overflow",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"September");
  await chooseDate(page,/Friday, September 25/i);
  const text=await page.locator(".calendar-day-card").innerText();
  expect(text.length).toBeGreaterThan(20);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});

test("month and year boundaries navigate correctly",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"December");
  await page.getByRole("button",{name:"Next month"}).click();
  await expect(page.locator(".calendar-heading h2")).toHaveText("January 2027");
  await page.getByRole("button",{name:"Previous month"}).click();
  await expect(page.locator(".calendar-heading h2")).toHaveText("December 2026");
});

test("multi-day holiday range applies at both ends",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"December");
  await chooseDate(page,/Thursday, December 24/i);
  await expect(page.locator(".calendar-detail-row.schedule")).toContainText(/No School/i);
  await chooseDate(page,/Thursday, December 31/i);
  await expect(page.locator(".calendar-detail-row.schedule")).toContainText(/No School/i);
});

test("regular date gives a calm empty state rather than broken detail",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"October");
  const candidates=page.locator("[data-cal-day]");
  const count=await candidates.count();
  let found=false;
  for(let i=0;i<count;i++){
    const label=await candidates.nth(i).getAttribute("aria-label");
    if(label && !label.includes(":")){
      await candidates.nth(i).click();
      found=true;
      break;
    }
  }
  expect(found).toBeTruthy();
  await expect(page.locator(".calendar-day-card")).toBeVisible();
  await expect(page.locator(".calendar-empty")).toContainText(/Regular school day|No special events/i);
});

test("Calendar uses a clean native-style planner hierarchy",async({page})=>{
  await openCalendar(page);
  await expect(page.getByRole("heading",{name:"Calendar",exact:true})).toBeVisible();
  await expect(page.getByText("School Month at a Glance")).toHaveCount(0);
  await expect(page.locator(".calendar-day-visual")).toHaveCount(0);
  await expect(page.locator(".calendar-day-hero")).toHaveCount(0);
  await expect(page.locator(".calendar-overlay-panel")).toHaveCount(0);
  await expect(page.locator(".calendar-detail-list")).toBeVisible();
  await expect(page.locator(".calendar-view-kicker")).toContainText(/MONTH VIEW|AGENDA/);

  const styles=await page.evaluate(()=> {
    const month=getComputedStyle(document.querySelector(".calendar-card"));
    const detail=getComputedStyle(document.querySelector(".calendar-day-card"));
    const active=getComputedStyle(document.querySelector(".calendar-tabs button.active"));
    return{
      monthShadow:month.boxShadow,
      detailShadow:detail.boxShadow,
      detailBackground:detail.backgroundColor,
      detailRadius:parseFloat(detail.borderRadius),
      activeBackground:active.backgroundColor,
    };
  });
  expect(styles.monthShadow).not.toBe("none");
  expect(styles.detailShadow).not.toBe("none");
  expect(styles.detailBackground).toBe("rgb(255, 255, 255)");
  expect(styles.detailRadius).toBeGreaterThanOrEqual(18);
  expect(styles.activeBackground).toBe("rgb(255, 255, 255)");
});

test("busy month cells expose multiple color-coded items without clutter",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"September");
  const busy=page.getByRole("button",{name:/Friday, September 25/i}).first();
  await expect(busy).toBeVisible();
  const items=busy.locator(".calendar-cell-event");
  expect(await items.count()).toBeGreaterThanOrEqual(1);
  expect(await items.count()).toBeLessThanOrEqual(2);
  await expect(items.first().locator("i")).toBeVisible();
  const more=busy.locator(".calendar-cell-more");
  if(await more.count()) await expect(more).toContainText(/^\+\d+ more$/);
  await expect(busy.locator(".mini-icon")).toHaveCount(0);
});

test("List view is compact and removes redundant school-event count copy",async({page})=>{
  await openCalendar(page);
  await page.getByRole("button",{name:"List View"}).click();
  await expect(page.locator(".calendar-list-panel.active")).toBeVisible();
  await expect(page.locator(".calendar-list-row").first()).toBeVisible();
  const text=await page.locator(".calendar-list-panel").innerText();
  expect(text).not.toMatch(/\b1 school event\b/i);
  expect(text).not.toMatch(/Fundraiswer/i);
});

test("mobile Calendar has a real internal scrollport and clears bottom navigation",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="mobile","Mobile-only bottom navigation assertion");
  await openCalendar(page);
  const before=await page.locator(".calendar-screen").evaluate(el=>({
    scrollTop:el.scrollTop,
    scrollHeight:el.scrollHeight,
    clientHeight:el.clientHeight,
    overflowY:getComputedStyle(el).overflowY,
  }));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  expect(before.overflowY).toMatch(/auto|scroll/);

  await page.locator(".calendar-screen").evaluate(el=>el.scrollTo({top:el.scrollHeight,behavior:"auto"}));
  await page.waitForTimeout(100);
  const after=await page.evaluate(()=>{
    const screen=document.querySelector(".calendar-screen");
    const detail=document.querySelector(".calendar-day-card");
    const nav=document.querySelector(".bottom-nav");
    const screenRect=screen?.getBoundingClientRect();
    const detailRect=detail?.getBoundingClientRect();
    const navRect=nav?.getBoundingClientRect();
    return{
      scrollTop:screen?.scrollTop||0,
      screenBottom:screenRect?.bottom||0,
      detailBottom:detailRect?.bottom||0,
      navTop:navRect?.top||window.innerHeight,
    };
  });
  expect(after.scrollTop).toBeGreaterThan(100);
  expect(after.screenBottom).toBeLessThanOrEqual(after.navTop+1);
  expect(after.detailBottom).toBeLessThanOrEqual(after.navTop-8);
});


test("selected busy day states the event count and lists every item vertically",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"September");
  await chooseDate(page,/Thursday, September 24/i);
  await expect(page.locator(".calendar-day-summary")).toContainText(/event|Regular school day/i);
  const rows=page.locator(".calendar-detail-row");
  expect(await rows.count()).toBeGreaterThan(1);
  const photoCount=await page.locator(".calendar-detail-photo:visible").count();
  expect(photoCount).toBe(0);
});
