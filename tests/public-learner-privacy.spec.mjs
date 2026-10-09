import {test,expect} from "@playwright/test";

test("anonymous visitor sees school-focused, not child-identifying, Today and Study headings",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block",storageState:{cookies:[],origins:[]}});
  const page=await context.newPage();
  await page.goto("/#today");
  await expect(page.locator(".hero-copy h2")).toHaveText("Ready for today?");
  const rank=page.locator(".study-badge-latest");
  await expect(rank).toBeVisible();
  await expect(rank).toContainText("STUDY RANK");
  await expect(rank).not.toContainText("EMMA");
  await page.locator('[data-tab="study"]').click();
  const heading=page.locator(".study-hero-copy h2");
  await expect(heading).toContainText("eagle!");
  await expect(heading).not.toContainText("Emma");
  await context.close();
});
