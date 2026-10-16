import {test,expect} from "@playwright/test";
import {reviewedSchoolMonday} from "./reviewed-week-fixture.mjs";

test("Week keeps filtered homework bound to its original task identity",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  // Synthetic homework must be exercised against its own teacher-week window.
  const schoolDate=reviewedSchoolMonday(fixture);

  fixture.pack.homework=[
    {day:"Current Homework posting",subject:"Religion",task:"Attend Mass",due:"Current posting"},
    {day:"Current Homework posting",subject:"School",task:"Return signed permission form",due:"Current posting"},
    {day:"Current Homework posting",subject:"Reading",task:"Read",due:"Current posting"},
    {day:"Current Homework posting",subject:"Parent",task:"Cover books",due:"Current posting"}
  ];
  fixture.pack.reminders=(fixture.pack.reminders||[]).filter(text=>!/\bmass\b/i.test(String(text)));
  fixture.pack.importantDates=(fixture.pack.importantDates||[]).filter(item=>!/\bmass\b/i.test(String(item?.label||"")));
  fixture.pack.subjects=(fixture.pack.subjects||[]).map(subject=>subject.subject==="Specials"
    ? {...subject,topics:(subject.topics||[]).filter(text=>!/\bmass\b/i.test(String(text)))}
    : subject);

  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.clock.setFixedTime(new Date(String(schoolDate)+"T17:00:00Z"));
  await page.goto("http://127.0.0.1:4173/#week");
  await expect(page.locator(".week-screen")).toBeVisible({timeout:10_000});

  await expect(page.locator("[data-check]").filter({hasText:"Attend Mass"})).toHaveCount(0);
  const permission=page.locator("[data-check]").filter({hasText:"Return signed permission form"}).first();
  await expect(permission).toBeVisible();
  await expect(permission).toHaveAttribute("data-check","1");
  await expect(page.locator("[data-check]").filter({hasText:"Read"})).toHaveCount(0);
  await permission.click();
  await expect(page.locator('[data-check="1"]').filter({hasText:"Return signed permission form"})).toHaveClass(/is-done/);

  const taskKeys=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith("abvm-task:v2:")));
  expect(taskKeys.some(key=>key.endsWith(":school:return-signed-permission-form"))).toBe(true);
  expect(taskKeys.some(key=>key.endsWith(":religion:attend-mass"))).toBe(false);

  await page.getByRole("button",{name:"Today",exact:true}).click();
  await expect(page.locator("[data-check]").filter({hasText:"Return signed permission form"}).first()).toHaveClass(/is-done/);
  await context.close();
});
