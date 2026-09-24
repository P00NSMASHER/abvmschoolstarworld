import {test,expect} from "@playwright/test";

for(const viewport of [
  {name:"iPad portrait",width:768,height:1024},
  {name:"large tablet",width:820,height:1180},
]){
  test(`${viewport.name} uses deliberate tablet composition`,async({browser})=>{
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},hasTouch:true});
    const page=await context.newPage();
    await page.goto("http://127.0.0.1:4173/#study");
    await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
    const studyColumns=await page.locator(".study-content").evaluate(el=>getComputedStyle(el).gridTemplateColumns);
    expect(studyColumns.split(" ").length).toBeGreaterThanOrEqual(2);

    await page.getByRole("button",{name:"Calendar",exact:true}).click();
    const calColumns=await page.locator(".calendar-wrap").evaluate(el=>getComputedStyle(el).gridTemplateColumns);
    expect(calColumns.split(" ").length).toBeGreaterThanOrEqual(2);

    await page.getByRole("button",{name:"Family",exact:true}).click();
    const familyColumns=await page.locator(".family-content").evaluate(el=>getComputedStyle(el).gridTemplateColumns);
    expect(familyColumns.split(" ").length).toBeGreaterThanOrEqual(2);

    const navLabelSize=await page.locator('.bottom-nav [data-tab="today"] b').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(navLabelSize).toBeGreaterThanOrEqual(12);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow).toBeFalsy();
    await context.close();
  });
}

test("desktop calendar and information pages use width productively",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop","Desktop-only density assertion");
  await page.goto("/#calendar");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const cal=await page.locator(".calendar-wrap").evaluate(el=>{
    const rect=el.getBoundingClientRect();
    return{width:rect.width,columns:getComputedStyle(el).gridTemplateColumns};
  });
  expect(cal.width).toBeGreaterThan(850);
  expect(cal.columns.split(" ").length).toBeGreaterThanOrEqual(2);

  await page.getByRole("button",{name:"Study",exact:true}).click();
  const study=await page.locator(".study-content").evaluate(el=>el.getBoundingClientRect().width);
  expect(study).toBeGreaterThan(850);

  await page.getByRole("button",{name:"Family",exact:true}).click();
  const family=await page.locator(".family-content").evaluate(el=>({
    width:el.getBoundingClientRect().width,
    columns:getComputedStyle(el).gridTemplateColumns,
  }));
  expect(family.width).toBeGreaterThan(850);
  expect(family.columns.split(" ").length).toBeGreaterThanOrEqual(2);
});
