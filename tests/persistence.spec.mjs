import {test,expect} from "@playwright/test";

test("Today checklist survives reload and can be restored",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const item=page.locator("[data-check]").first();
  await expect(item).toBeVisible();
  const original=await item.getAttribute("aria-pressed");
  await item.click();
  const toggled=original==="true"?"false":"true";
  await expect(page.locator("[data-check]").first()).toHaveAttribute("aria-pressed",toggled);
  await page.reload();
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await expect(page.locator("[data-check]").first()).toHaveAttribute("aria-pressed",toggled);
  await page.locator("[data-check]").first().click();
  await expect(page.locator("[data-check]").first()).toHaveAttribute("aria-pressed",original||"false");
});

test("Family checklist persists independently and can be restored",async({page})=>{
  await page.goto("/#family");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const item=page.locator("[data-family-check]").first();
  await expect(item).toBeVisible();
  const original=await item.getAttribute("aria-pressed");
  await item.click();
  const toggled=original==="true"?"false":"true";
  await expect(page.locator("[data-family-check]").first()).toHaveAttribute("aria-pressed",toggled);
  await page.reload();
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await expect(page.locator("[data-family-check]").first()).toHaveAttribute("aria-pressed",toggled);
  await page.locator("[data-family-check]").first().click();
  await expect(page.locator("[data-family-check]").first()).toHaveAttribute("aria-pressed",original||"false");
});

test("storage failures fail soft instead of breaking the app",async({browser})=>{
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    const thrower=()=>{throw new Error("storage disabled")};
    Object.defineProperty(Storage.prototype,"getItem",{value:thrower,configurable:true});
    Object.defineProperty(Storage.prototype,"setItem",{value:thrower,configurable:true});
    Object.defineProperty(Storage.prototype,"removeItem",{value:thrower,configurable:true});
  });
  const page=await context.newPage();
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  await expect(page.locator("[data-check]").first()).toBeVisible();
  await page.locator("[data-check]").first().click();
  await expect(page.locator(".screen")).toBeVisible();
  await context.close();
});


test("completion state is namespaced by the source pack hash",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator(".loading-screen")).toHaveCount(0,{timeout:10_000});
  const keys=await page.evaluate(()=>{
    const task=document.querySelector("[data-check]");
    if(!task)return[];
    const before=Object.keys(localStorage);
    task.click();
    const after=Object.keys(localStorage);
    const created=after.filter(key=>!before.includes(key));
    task.click();
    return created;
  });
  expect(keys.length).toBeGreaterThan(0);
  expect(keys[0]).toMatch(/^abvm-gold:teacher-pages-[a-f0-9]{20}:/);
});
