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
  await expect(page.locator(".calendar-primary-block")).toContainText(/Half Day/i);
  await expect(page.locator(".calendar-day-card")).toContainText(/Articulation Meeting/i);
});

test("no-school days remain unmistakable",async({page})=>{
  await openCalendar(page);
  await goToMonth(page,2026,"October");
  await chooseDate(page,/Monday, October 12/i);
  await expect(page.locator(".calendar-primary-block")).toContainText(/No School/i);
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
  await expect(page.locator(".calendar-primary-block")).toContainText(/No School/i);
  await chooseDate(page,/Thursday, December 31/i);
  await expect(page.locator(".calendar-primary-block")).toContainText(/No School/i);
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
