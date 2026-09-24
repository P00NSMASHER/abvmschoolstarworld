import {test,expect} from "@playwright/test";

const sizes=[
  {name:"320x568",width:320,height:568},
  {name:"360x640",width:360,height:640},
  {name:"375x667",width:375,height:667},
  {name:"390x844",width:390,height:844},
  {name:"430x932",width:430,height:932},
];

test("core parent flows remain usable across small-phone sizes",async({browser})=>{
  for(const size of sizes){
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#today");
    await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
    for(const tab of ["Today","Week","Calendar","Study","Family"]){
      await page.getByRole("button",{name:tab,exact:true}).click();
      await expect(page.locator(".screen")).toBeVisible();
      const metrics=await page.evaluate(()=>({
        docWidth:document.documentElement.scrollWidth,
        viewport:window.innerWidth,
        bodyWidth:document.body.scrollWidth,
      }));
      expect(metrics.docWidth,`${size.name} ${tab} document overflow`).toBeLessThanOrEqual(metrics.viewport+1);
      expect(metrics.bodyWidth,`${size.name} ${tab} body overflow`).toBeLessThanOrEqual(metrics.viewport+1);
    }
    await context.close();
  }
});

test("Week date and status separate cleanly on narrow phones",async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto("http://127.0.0.1:4173/#week");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const layout=await page.locator(".day-detail-title").evaluate(el=>({
    display:getComputedStyle(el).display,
    columns:getComputedStyle(el).gridTemplateColumns,
    width:el.getBoundingClientRect().width,
    pillWidth:el.querySelector(".school-day-pill")?.getBoundingClientRect().width||0,
  }));
  expect(layout.display).toBe("grid");
  expect(layout.pillWidth).toBeLessThan(layout.width);
  await context.close();
});

test("each tab exposes its primary answer near the top of the scroll flow",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const targets=[
    ["Today",".date-hero-card"],
    ["Week",".day-picker"],
    ["Calendar",".calendar-card"],
    ["Study",".study-at-a-glance"],
    ["Family",".family-priority"],
  ];
  for(const [tab,selector] of targets){
    await page.getByRole("button",{name:tab,exact:true}).click();
    const top=await page.locator(selector).evaluate(el=>el.getBoundingClientRect().top);
    const viewportHeight=page.viewportSize()?.height||844;
    expect(top,`${tab} primary answer starts too deep`).toBeLessThan(viewportHeight*.95);
  }
});


test("landscape phone layout keeps navigation and primary content usable",async({browser})=>{
  for(const viewport of [{width:667,height:375},{width:844,height:390}]){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#calendar");
    await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
    await expect(page.getByRole("button",{name:"Calendar",exact:true})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow).toBeFalsy();
    await page.getByRole("button",{name:"Study",exact:true}).click();
    await expect(page.locator(".study-at-a-glance")).toBeVisible();
    await context.close();
  }
});
