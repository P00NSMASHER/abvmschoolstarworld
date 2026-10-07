import {test,expect} from "@playwright/test";

const APP="http://127.0.0.1:4173";

async function staticPack(request){
  const response=await request.get(APP+"/data/study-pack.json");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function invalidPack(source,field,value){
  const candidate=structuredClone(source);
  candidate.pack.sourceHash="invalid-"+field;
  candidate.pack[field]=value;
  return candidate;
}

test("malformed runtime pack falls back to the validated static pack",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await staticPack(page.request);
  const fallback=structuredClone(source);
  fallback.pack.sourceHash="validated-static-fallback";
  fallback.pack.parentNotices=[...fallback.pack.parentNotices,"Validated static fallback notice."];
  let runtimeCalls=0,fallbackCalls=0;
  await page.route("**/data/study-pack-runtime.json*",route=>{
    runtimeCalls++;
    return route.fulfill({json:invalidPack(source,"homework",null)});
  });
  await page.route("**/data/study-pack.json*",route=>{
    fallbackCalls++;
    return route.fulfill({json:fallback});
  });

  await page.goto(APP+"/#family");
  await expect(page.locator(".family-screen")).toBeVisible({timeout:10_000});
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Validated static fallback notice.");
  expect(runtimeCalls).toBe(1);
  expect(fallbackCalls).toBe(1);
  await context.close();
});

test("cold load fails closed when runtime and static packs are malformed",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await staticPack(page.request);
  let runtimeCalls=0,fallbackCalls=0;
  await page.route("**/data/study-pack-runtime.json*",route=>{
    runtimeCalls++;
    return route.fulfill({json:invalidPack(source,"subjects",null)});
  });
  await page.route("**/data/study-pack.json*",route=>{
    fallbackCalls++;
    return route.fulfill({json:invalidPack(source,"importantDates",{})});
  });

  await page.goto(APP+"/#today");
  await expect(page.getByRole("heading",{name:"School info could not be loaded"})).toBeVisible({timeout:10_000});
  await expect(page.locator(".today-screen")).toHaveCount(0);
  expect(runtimeCalls).toBe(1);
  expect(fallbackCalls).toBe(1);
  await context.close();
});

test("failed refresh keeps the last-known-good pack and never reports an update",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await staticPack(page.request);
  const good=structuredClone(source);
  good.pack.sourceHash="last-known-good-pack";
  good.pack.parentNotices=[...good.pack.parentNotices,"Last-known-good family notice."];
  let runtime=good;
  let fallback=good;
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:runtime}));
  await page.route("**/data/study-pack.json*",route=>route.fulfill({json:fallback}));

  await page.goto(APP+"/#family");
  await expect(page.locator(".family-screen")).toBeVisible({timeout:10_000});
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Last-known-good family notice.");
  const freshnessBefore=await page.locator(".freshness strong").textContent();

  runtime=invalidPack(good,"homework",null);
  runtime.pack.parentNotices=["Corrupt runtime notice."];
  fallback=invalidPack(good,"subjects",null);
  fallback.pack.parentNotices=["Corrupt fallback notice."];
  await page.locator("[data-refresh-pack]").click();

  await expect(page.locator("#toast")).toContainText("Couldn’t check published school info");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Last-known-good family notice.");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).not.toContainText("Corrupt runtime notice");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).not.toContainText("Corrupt fallback notice");
  await expect(page.locator(".freshness strong")).toHaveText(freshnessBefore||"");
  await expect(page.locator("#toast")).not.toContainText("School info updated");
  await context.close();
});

test("render failure rolls back before the validated fallback is admitted",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await staticPack(page.request);
  const good=structuredClone(source);
  good.pack.sourceHash="render-rollback-good";
  good.pack.parentNotices=[...good.pack.parentNotices,"Render rollback kept this notice."];
  const candidate=structuredClone(good);
  candidate.pack.sourceHash="render-rollback-candidate";
  candidate.pack.parentNotices=["Candidate that must roll back."];
  let runtime=good,fallbackCalls=0;
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:runtime}));
  await page.route("**/data/study-pack.json*",route=>{
    fallbackCalls++;
    return route.fulfill({json:good});
  });

  await page.goto(APP+"/#family");
  await expect(page.locator(".family-screen")).toBeVisible({timeout:10_000});
  await page.evaluate(()=>{
    const original=window.ABVMSchoolUpdates;
    let failOnce=true;
    Object.defineProperty(window,"ABVMSchoolUpdates",{
      configurable:true,
      writable:true,
      value:Object.freeze({...original,noticesCard(...args){
        if(failOnce){failOnce=false;throw new Error("synthetic render failure")}
        return original.noticesCard(...args);
      }})
    });
  });
  runtime=candidate;
  await page.locator("[data-refresh-pack]").click();

  await expect.poll(()=>fallbackCalls).toBe(1);
  await expect(page.locator(".family-screen")).toBeVisible();
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Render rollback kept this notice.");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).not.toContainText("Candidate that must roll back");
  await context.close();
});
