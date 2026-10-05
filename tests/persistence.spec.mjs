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
  let before=null;
  for(let attempt=0;attempt<3&&!before;attempt++){
    await page.locator(".game-answer").first().click();
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
  await page.goto("http://127.0.0.1:4173/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  await expect(page.locator("[data-check]").first()).toBeVisible();
  await page.locator("[data-check]").first().click();
  await expect(page.locator(".screen")).toBeVisible();
  await page.getByRole("button",{name:"Study",exact:true}).click();
  await page.locator(".study-games-cta").click();
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
  await context.close();
});

test("completion state is keyed by school week and task identity",async({page})=>{
  const source=await (await page.request.get("/data/study-pack.json")).json();
  const weekSlug=String(source.pack?.weekLabel||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  expect(weekSlug).toMatch(/^week-of-/);
  await page.goto("/#today");
  await expect(page.locator("[data-check]").first()).toBeVisible({timeout:10_000});
  const created=await page.evaluate(()=>{
    for(const key of Object.keys(localStorage))if(key.startsWith("abvm-task:v2:"))localStorage.removeItem(key);
    const task=document.querySelector("[data-check]");
    const before=Object.keys(localStorage);
    task?.click();
    const after=Object.keys(localStorage);
    return after.filter(key=>!before.includes(key));
  });
  expect(created.length).toBe(1);
  expect(created[0].startsWith(`abvm-task:v2:${weekSlug}:`)).toBe(true);
  expect(created[0]).not.toContain("teacher-pages-");
});

test("Read completion stays synchronized between Today and Week",async({page})=>{
  const source=await (await page.request.get("/data/study-pack.json")).json();
  const schoolDate=source.pack?.lunchMenu?.[0]?.date;
  expect(schoolDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.clock.setFixedTime(new Date(`${schoolDate}T17:00:00Z`));
  await page.goto("/#today");
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});
  const taskToday=page.locator("[data-check]").first();
  await expect(taskToday).toBeVisible();
  const taskId=await taskToday.getAttribute("data-check");
  expect(taskId).toBeTruthy();

  const wasDone=await taskToday.evaluate(el=>el.classList.contains("is-done"));
  if(!wasDone)await taskToday.click();
  await expect(page.locator(`[data-check="${taskId}"]`).first()).toHaveClass(/is-done/);

  await page.getByRole("button",{name:"Week",exact:true}).click();
  const taskWeek=page.locator(`[data-check="${taskId}"]`).first();
  await expect(taskWeek).toBeVisible();
  await expect(taskWeek).toHaveClass(/is-done/);

  if(!wasDone){
    await taskWeek.click();
    await page.getByRole("button",{name:"Today",exact:true}).click();
    await expect(page.locator(`[data-check="${taskId}"]`).first()).not.toHaveClass(/is-done/);
  }
});
