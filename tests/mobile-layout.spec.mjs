import {test,expect} from "@playwright/test";

const sizes=[
  {name:"320x568",width:320,height:568},
  {name:"360x640",width:360,height:640},
  {name:"375x667",width:375,height:667},
  {name:"390x844",width:390,height:844},
  {name:"430x932",width:430,height:932},
];

test("all six core flows remain usable across small-phone sizes",async({browser})=>{
  for(const size of sizes){
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#today");
    await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
    for(const tab of ["Today","Week","Calendar","Study","Study Games","Family"]){
      await page.getByRole("button",{name:tab,exact:true}).click();
      await expect(page.locator(".screen")).toBeVisible();
      if(tab==="Study Games")await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
      const metrics=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:window.innerWidth}));
      expect(metrics.doc,size.name+" "+tab+" document overflow").toBeLessThanOrEqual(metrics.viewport+1);
      expect(metrics.body,size.name+" "+tab+" body overflow").toBeLessThanOrEqual(metrics.viewport+1);
    }
    await context.close();
  }
});

test("Week date picker remains usable on a 320px phone",async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto("http://127.0.0.1:4173/#week");
  await expect(page.locator(".day-picker")).toBeVisible({timeout:10_000});
  await expect(page.locator("[data-day]")).toHaveCount(5);
  const widths=await page.locator("[data-day]").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
  expect(Math.min(...widths)).toBeGreaterThan(35);
  await context.close();
});

test("each tab exposes its primary answer in the first viewport",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  const targets=[
    ["Today",".hero-card"],["Week",".week-nav"],["Calendar",".calendar-card"],
    ["Study",".study-at-a-glance"],["Study Games",".study-game-grid"],["Family",".family-hero"]
  ];
  for(const [tab,selector] of targets){
    await page.getByRole("button",{name:tab,exact:true}).click();
    await expect(page.locator(selector)).toBeVisible({timeout:10_000});
    const top=await page.locator(selector).evaluate(el=>el.getBoundingClientRect().top);
    expect(top,tab+" primary content starts too deep").toBeLessThan((page.viewportSize()?.height||844)*.98);
  }
});

test("landscape phone keeps navigation and content usable",async({browser})=>{
  for(const viewport of [{width:667,height:375},{width:844,height:390}]){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#calendar");
    await expect(page.locator(".calendar-card")).toBeVisible({timeout:10_000});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow).toBeFalsy();
    await page.getByRole("button",{name:"Study Games",exact:true}).click();
    await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
    await context.close();
  }
});


test("Family notices stay stacked and inside the phone viewport",async({browser})=>{
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto("http://127.0.0.1:4173/#family");
  const list=page.locator(".static-notice-list");
  await expect(list).toBeVisible({timeout:10_000});
  const rows=list.locator(".notice-row");
  expect(await rows.count()).toBeGreaterThan(0);
  const layout=await list.evaluate(el=>({
    display:getComputedStyle(el).display,
    clientWidth:el.clientWidth,
    scrollWidth:el.scrollWidth,
    rows:[...el.querySelectorAll(".notice-row")].map(row=>{
      const r=row.getBoundingClientRect();
      return{left:r.left,right:r.right,width:r.width};
    })
  }));
  expect(layout.display).toBe("block");
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth+1);
  for(const row of layout.rows)expect(row.width).toBeLessThanOrEqual(layout.clientWidth+1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
  await context.close();
});
