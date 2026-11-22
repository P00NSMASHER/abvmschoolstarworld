import {test,expect} from "@playwright/test";

test.use({serviceWorkers:"block"});

async function openCurrentWeek(page){
  await page.clock.setFixedTime(new Date("2026-10-06T16:00:00Z"));
  await page.goto("/#week");
  await expect(page.locator(".week-screen")).toBeVisible({timeout:10000});
  await expect(page.locator(".week-overview")).toBeVisible();
}

test("Week cleanly lists all lunches and tests from the governed current pack",async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await openCurrentWeek(page);

  await expect(page.getByRole("heading",{name:"This week at a glance"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Lunches this week"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Tests this week"})).toBeVisible();

  const lunchRows=page.locator(".week-lunches .week-overview-row");
  await expect(lunchRows).toHaveCount(5);
  await expect(lunchRows.nth(0)).toContainText("Mon 5");
  await expect(lunchRows.nth(0)).toContainText("Popcorn chicken");
  await expect(lunchRows.nth(1)).toContainText("Taco Tuesday");
  await expect(lunchRows.nth(2)).toContainText("Buttered pierogies");
  await expect(lunchRows.nth(3)).toContainText("Beef cheesesteak");
  await expect(lunchRows.nth(4)).toContainText("No lunch");

  const tests=page.locator(".week-tests");
  // Compare with the actual governed pack: historical teacher tests expire.
  // Do not resurrect source-retired lessons just to satisfy an old snapshot.
  const expectedTests=await page.evaluate(async()=>{
    const response=await fetch("./data/study-pack.json",{cache:"no-store"});
    if(!response.ok)throw new Error("Could not load the governed study pack");
    const source=await response.json();
    const dates={"Monday, Oct. 5":"2026-10-05","Tuesday, Oct. 6":"2026-10-06","Wednesday, Oct. 7":"2026-10-07","Thursday, Oct. 8":"2026-10-08","Friday, Oct. 9":"2026-10-09"};
    const isTest=item=>/\btests?\b|\bassessments?\b/.test(String(item?.kind||"").toLowerCase())||/\btests?\b|\bassessments?\b|star reading/.test(String(item?.label||"").toLowerCase());
    const unique=new Map();
    for(const item of source.pack?.importantDates||[]){
      const date=dates[item.date];
      if(date&&isTest(item)){
        const label=String(item.label||"Test").trim();
        unique.set(date+"|"+label,{date,label});
      }
    }
    return [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label));
  });
  const renderedTests=await tests.locator(".week-overview-row").evaluateAll(rows=>
    rows.flatMap(row=>[...row.querySelectorAll("li")].map(item=>({
      date:row.querySelector("time")?.getAttribute("datetime"),label:item.textContent.trim()
    }))).sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label))
  );
  expect(renderedTests).toEqual(expectedTests);
  if(!expectedTests.length)await expect(tests.locator(".week-overview-empty")).toContainText("No verified tests");

  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("gold-standard visual layer keeps approved school photography and phone/tablet fit",async({page},info)=>{
  for(const viewport of [{width:393,height:852,name:"phone"},{width:768,height:1024,name:"tablet"}]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.clock.setFixedTime(new Date("2026-10-06T16:00:00Z"));
    await page.goto("/#today");
    await expect(page.locator(".hero-card.school-photo-hero")).toBeVisible({timeout:10000});
    await expect(page.locator('.hero-photo')).toHaveAttribute('src','./assets/school/abvm-school-hero.webp');
    await expect(page.locator('link[href*="visual-polish"]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const path=info.outputPath("gold-standard-"+viewport.name+".png");
    await page.screenshot({path});
    await info.attach("Gold standard "+viewport.name,{path,contentType:"image/png"});
  }
});

test("Study Games and question player use the shared bright visual system",async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.clock.setFixedTime(new Date("2026-10-06T16:00:00Z"));
  await page.goto("/#games");
  await expect(page.locator(".games-screen")).toHaveAttribute("data-study-state","ready",{timeout:15000});
  await expect(page.locator(".study-game-tile")).toHaveCount(5);
  const rows=await page.locator(".study-game-tile").evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().height)));
  expect(Math.max(...rows)).toBeLessThanOrEqual(200);
  await page.getByRole("button",{name:/Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  await expect(page.locator(".game-progress")).toBeVisible();
  await expect(page.locator(".game-answer").first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
