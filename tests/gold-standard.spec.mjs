import {test,expect} from "@playwright/test";

async function openTab(page,label){
  await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
}

test.beforeEach(async({page})=>{
  await page.goto("/?rollback=gold#today");
});

test("gold-standard app boots without runtime errors",async({page})=>{
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.reload();
  await page.waitForTimeout(1500);
  expect(errors,errors.join("\n")).toEqual([]);
  await expect(page.locator(".screen")).toBeVisible({timeout:10000});
});

test("historical gold-standard visual hierarchy is restored",async({page})=>{
  await expect(page.locator(".app-header h1")).toBeVisible();
  await expect(page.locator(".today-panel")).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeVisible();

  await openTab(page,"Week");
  await expect(page.locator(".app-header h1")).toHaveText(/This week/i);
  await expect(page.locator(".day-picker")).toBeVisible();
  await expect(page.locator(".day-detail")).toBeVisible();

  await openTab(page,"Calendar");
  await expect(page.locator(".app-header p")).toContainText("SCHOOL MONTH AT A GLANCE");
  await expect(page.getByText("Tap any date")).toBeVisible();
  await expect(page.locator(".calendar-card")).toBeVisible();

  await openTab(page,"Study");
  await expect(page.locator(".app-header p")).toContainText("SMALL STEPS, CALM PRACTICE");
  await expect(page.locator(".study-intro")).toBeVisible();
  await expect(page.locator(".study-at-a-glance")).toBeVisible();

  await openTab(page,"Family");
  await expect(page.locator(".app-header h1")).toHaveText(/Family dashboard/i);
  await expect(page.locator(".family-hero")).toBeVisible();
  await expect(page.locator(".family-stats")).toBeVisible();
});

test("historical layout remains phone-safe and interactive",async({page})=>{
  for(const label of ["Today","Week","Calendar","Study","Study Games","Family"]){
    await openTab(page,label);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow,label+" has horizontal overflow").toBeFalsy();
  }
  await openTab(page,"Week");
  const days=page.locator("[data-day]");
  if(await days.count()>1){
    await days.nth(1).click();
    await expect(days.nth(1)).toHaveClass(/active/);
  }
  await openTab(page,"Calendar");
  const dates=page.locator("[data-cal-day]");
  if(await dates.count()>5){
    await dates.nth(5).click();
    await expect(dates.nth(5)).toHaveClass(/active/);
  }
});


test("requested polish is present",async({page})=>{
  await openTab(page,"Calendar");
  await expect(page.locator(".specials-card")).toBeVisible();
  await expect(page.locator(".special-row")).toHaveCount(5);

  await openTab(page,"Study");
  await expect(page.locator(".quick-look-head")).toBeVisible();
  expect(await page.locator(".study-at-a-glance li").count()).toBeGreaterThanOrEqual(3);

  await openTab(page,"Family");
  await expect(page.getByText("Please verify",{exact:true})).toHaveCount(0);

  const navStyles=await page.evaluate(()=>({
    fill:getComputedStyle(document.querySelector(".bottom-nav .nav-icon svg")).fill,
    stroke:getComputedStyle(document.querySelector(".bottom-nav .nav-icon svg")).stroke,
  }));
  expect(navStyles.fill).toBe("none");
  expect(navStyles.stroke).not.toBe("none");
});


test("second requested polish is present",async({page})=>{
  await openTab(page,"Week");
  const stripe=await page.evaluate(()=>getComputedStyle(document.querySelector(".day-detail"),"::before").display);
  expect(stripe).toBe("none");

  await openTab(page,"Calendar");
  await expect(page.locator(".month-agenda-head")).toBeVisible();
  expect(await page.locator(".month-agenda-row").count()).toBeGreaterThan(2);

  await openTab(page,"Family");
  await expect(page.locator(".family-actions-card")).toBeVisible();
  await expect(page.locator(".reading-policy-card")).toBeVisible();
  await expect(page.locator(".notices-card")).toBeVisible();
  await expect(page.locator(".notice-row").first()).toBeVisible();
});


test("week paging and full calendar agenda work on phone",async({page})=>{
  await openTab(page,"Week");
  const range=page.locator(".week-nav strong");
  const initial=(await range.textContent())?.trim();
  const firstBefore=await page.locator("[data-day]").first().getAttribute("data-day");
  await page.locator('[data-week-step="1"]').click();
  await expect(page.locator(".week-today-jump")).toBeVisible();
  await expect(range).not.toHaveText(initial||"");
  const firstAfter=await page.locator("[data-day]").first().getAttribute("data-day");
  expect(firstAfter).not.toBe(firstBefore);

  await openTab(page,"Calendar");
  expect(await page.locator(".agenda-day").count()).toBeGreaterThan(15);
  await expect(page.locator(".agenda-lunch").first()).toBeVisible();
  await expect(page.locator(".month-agenda")).toContainText("Lunch");
  await expect(page.locator(".calendar-legend")).toContainText("Lunch");
});


test("Study Games uses the StarBlox-style equivalent question engine",async({page})=>{
  await openTab(page,"Study Games");
  await expect(page.locator(".study-games-hero")).toBeVisible();
  await expect(page.locator(".study-game-tile")).toHaveCount(4);
  await expect(page.locator(".question-tech-card")).toContainText("Direct");
  await expect(page.locator(".question-tech-card")).toContainText("Transfer");
  await expect(page.locator(".question-tech-card")).toContainText("Reason");

  const engine=await page.evaluate(async()=>{
    const source=await (await fetch("./data/study-pack.json",{cache:"no-store"})).json();
    const catalog=window.ABVMStudyGames.buildCatalog(source.pack,{sourceKey:"playwright-certified-source"});
    return {
      count:catalog.questionCount,
      issues:window.ABVMStudyGames.validateCatalog(catalog),
      equivalent:catalog.questions.filter(q=>q.originalEquivalent===true).length,
      types:[...new Set(catalog.questions.filter(q=>q.originalEquivalent===true).map(q=>q.questionType))],
      transform:catalog.sourceTransform,
      privateKeys:catalog.questions.flatMap(q=>Object.keys(q)).filter(k=>["studentResponse","teacherMark","grade","score","rawText","worksheetText","imageHash","imagePath"].includes(k))
    };
  });
  expect(engine.count).toBeGreaterThan(20);
  expect(engine.equivalent).toBeGreaterThan(10);
  expect(engine.issues).toEqual([]);
  expect(engine.types.sort()).toEqual(["direct","reasoning","transfer"]);
  expect(engine.transform).toBe("skill-only-equivalent-item-v1");
  expect(engine.privateKeys).toEqual([]);

  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  expect(await page.locator(".game-answer").count()).toBeGreaterThanOrEqual(2);

  await page.locator(".game-answer").first().click();
  await expect(page.locator(".game-feedback")).toBeVisible();
  await expect(page.locator(".game-next")).toBeVisible();
});
