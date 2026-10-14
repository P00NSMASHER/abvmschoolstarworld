import {test,expect} from "@playwright/test";

test("Today's academic homework checklist survives reload and can be restored",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-10-13T21:00:00-04:00"));
  await page.goto("/#today");
  const item=page.locator("[data-homework-check]").first();
  await expect(item).toBeVisible({timeout:10_000});
  const wasDone=await item.evaluate(el=>el.classList.contains("is-done"));
  await item.click();
  await expect(page.locator("[data-homework-check]").first()).toHaveClass(wasDone?/^(?!.*is-done)/:/is-done/);
  await page.reload();
  const reloaded=page.locator("[data-homework-check]").first();
  await expect(reloaded).toBeVisible({timeout:10_000});
  expect(await reloaded.evaluate(el=>el.classList.contains("is-done"))).toBe(!wasDone);
  await reloaded.click();
  expect(await page.locator("[data-homework-check]").first().evaluate(el=>el.classList.contains("is-done"))).toBe(wasDone);
});

test("Study Games learning evidence persists across reload",async({page})=>{
  await page.goto("/#games");
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await page.getByRole("button",{name:/Mix/i}).click();
  await expect(page.locator(".game-answer").first()).toBeVisible();
  let before=null;
  for(let attempt=0;attempt<3&&!before;attempt++){
    await page.locator(".game-answer:not(:disabled)").first().click();
    before=await page.evaluate(()=>localStorage.getItem("abvm-study-learning:v2"));
  }
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
  await page.clock.setFixedTime(new Date("2026-10-13T21:00:00-04:00"));
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.locator("[data-homework-check]").first()).toBeVisible();
  await page.locator("[data-homework-check]").first().click();
  await expect(page.locator(".screen")).toBeVisible();
  await page.getByRole("button",{name:"Study",exact:true}).click();
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await expect(page.locator(".study-game-grid > .study-game-tile")).toHaveCount(5);
  await context.close();
});

test("homework completion is keyed by school date and exact assignment identity",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-10-13T21:00:00-04:00"));
  await page.goto("/#today");
  await expect(page.locator("[data-homework-check]").first()).toBeVisible({timeout:10000});
  const created=await page.evaluate(()=>{
    for(const key of Object.keys(localStorage))if(key.startsWith("abvm-homework:v1:"))localStorage.removeItem(key);
    const task=document.querySelector("[data-homework-check]");
    const before=Object.keys(localStorage);
    task?.click();
    return Object.keys(localStorage).filter(key=>!before.includes(key));
  });
  expect(created).toHaveLength(1);
  expect(created[0]).toBe("abvm-homework:v1:2026-10-13:math:page-22");
});

test("verified homework completion stays synchronized between Today and Week",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-10-13T21:00:00-04:00"));
  await page.goto("/#today");
  await expect(page.locator(".today-homework [data-homework-check='0']")).toBeVisible({timeout:10000});
  const item=page.locator(".today-homework [data-homework-check='0']");
  const wasDone=await item.evaluate(el=>el.classList.contains("is-done"));
  if(!wasDone)await item.click();
  await expect(page.locator(".today-homework [data-homework-check='0']")).toHaveClass(/is-done/);
  await page.locator('.bottom-nav [data-tab="calendar"]').click();
  await page.locator('[data-route="week"]').click();
  const selected=page.locator(".week-homework-card [data-homework-check='0']");
  await expect(selected).toBeVisible();
  await expect(selected).toHaveClass(/is-done/);
  if(!wasDone){
    await selected.click();
    await page.getByRole("button",{name:"Today",exact:true}).click();
    await expect(page.locator(".today-homework [data-homework-check='0']")).not.toHaveClass(/is-done/);
  }
});
