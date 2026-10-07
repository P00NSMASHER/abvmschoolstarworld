import {test,expect} from "@playwright/test";

test("one missing same-day bank does not hide supported targeted practice",async({browser})=>{
  const context=await browser.newContext({serviceWorkers:"block"});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-05T16:00:00-04:00"));
  const source=await (await page.request.get("http://127.0.0.1:4173/data/study-pack.json")).json();
  const fixture=structuredClone(source);
  fixture.pack.sourceHash=String(fixture.pack.sourceHash||"current")+"-partial-test-prep";
  fixture.pack.importantDates=[
    {date:"Friday, Oct. 9",label:"Grammar (subject & predicate)",kind:"test"},
    {date:"Friday, Oct. 9",label:"Science test",kind:"test"}
  ];
  await page.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:fixture}));
  await page.goto("http://127.0.0.1:4173/#study");
  await expect(page.locator('.games-screen[data-study-state="ready"]')).toBeVisible({timeout:10_000});
  await expect(page.locator("[data-study-tests]")).toContainText("Grammar (subject & predicate)");
  await expect(page.locator('[data-test-select] option')).toHaveText([
    /Grammar \(subject & predicate\)/,/Science test/
  ]);
  await page.locator('[data-test-select]').selectOption('1');
  await expect(page.locator('[data-study-tests] h3')).toHaveText('Science test');
  await expect(page.locator('[data-test-missing]')).toContainText('No verified questions match this test yet');
  await expect(page.locator('[data-test-single]')).toBeDisabled();
  await page.locator('[data-test-select]').selectOption('0');
  await expect(page.locator('[data-test-single]')).toBeEnabled();
  await page.locator('[data-test-single]').click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  await expect(page.locator(".game-topbar")).toContainText("Grammar (subject & predicate)");
  const allowed=await page.evaluate(async()=>{
    const [envelope,schoolwork,archive]=await Promise.all([
      fetch('./data/study-pack-runtime.json').then(response=>response.json()),
      fetch('./data/schoolwork.json').then(response=>response.json()),
      fetch('./data/study-archive.json').then(response=>response.json())
    ]);
    return [...envelope.pack.contentPipeline.questions,...archive.questions,...schoolwork.lessons.flatMap(lesson=>lesson.questions)]
      .filter(question=>question.skill==='subject-predicate');
  });
  expect(allowed.length).toBeGreaterThanOrEqual(8);
  for(let index=0;index<8;index++){
    await expect(page.locator('.game-topbar')).toContainText(`${index+1} of 8`);
    await expect(page.locator('.game-topbar')).not.toContainText(/Support|Comeback|Science/);
    const prompt=await page.locator('.game-question-card > h2').innerText();
    const question=allowed.find(row=>row.prompt===prompt);
    expect(question,'strict test prep must remain in the supported grammar bank').toBeTruthy();
    const choices=await page.locator('[data-game-answer] strong').allTextContents();
    const wrongs=choices.map((choice,choiceIndex)=>choice!==question.answer?choiceIndex:-1).filter(choiceIndex=>choiceIndex>=0);
    // Repeated misses must not insert a support/comeback from a different bank.
    for(const choiceIndex of wrongs.slice(0,2)){
      await page.locator('[data-game-answer]').nth(choiceIndex).click();
      if(await page.locator('[data-game-next]').count())break;
    }
    await expect(page.locator('[data-game-next]')).toBeVisible();
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  await context.close();
});
