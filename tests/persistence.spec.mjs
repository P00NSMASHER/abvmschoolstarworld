import {test,expect} from "@playwright/test";

test("Today checklist survives reload and can be restored",async({page})=>{
  await page.goto("/#today");
  const item=page.locator("[data-check]").first();
  await expect(item).toBeVisible({timeout:10_000});
  const wasDone=await item.evaluate(el=>el.classList.contains("is-done"));
  await item.click();
  await expect(page.locator("[data-check]").first()).toHaveClass(wasDone?/^(?!.*is-done)/:/is-done/);
  await page.reload();
  const reloaded=page.locator("[data-check]").first();
  await expect(reloaded).toBeVisible({timeout:10_000});
  expect(await reloaded.evaluate(el=>el.classList.contains("is-done"))).toBe(!wasDone);
  await reloaded.click();
  expect(await page.locator("[data-check]").first().evaluate(el=>el.classList.contains("is-done"))).toBe(wasDone);
});

test("Study Games learning evidence persists across reload",async({page})=>{
  await page.goto("/#games");
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-answer").first()).toBeVisible();
  await page.locator(".game-answer").first().click();
  const before=await page.evaluate(()=>localStorage.getItem("abvm-study-learning:v2"));
  expect(before).toBeTruthy();
  await page.reload();
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  const after=await page.evaluate(()=>localStorage.getItem("abvm-study-learning:v2"));
  expect(after).toBe(before);
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
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.locator("[data-check]").first()).toBeVisible();
  await page.locator("[data-check]").first().click();
  await expect(page.locator(".screen")).toBeVisible();
  await page.getByRole("button",{name:"Study Games",exact:true}).click();
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await context.close();
});

test("completion state is namespaced by the current source pack hash",async({page})=>{
  await page.goto("/#today");
  await expect(page.locator("[data-check]").first()).toBeVisible({timeout:10_000});
  const created=await page.evaluate(()=>{
    const task=document.querySelector("[data-check]");
    const before=Object.keys(localStorage);
    task?.click();
    const after=Object.keys(localStorage);
    const delta=after.filter(key=>!before.includes(key));
    task?.click();
    return delta;
  });
  expect(created.length).toBeGreaterThan(0);
  expect(created[0]).toMatch(/^abvm-old-look:teacher-pages-[a-f0-9]{20}:/);
});
