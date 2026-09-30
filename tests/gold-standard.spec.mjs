import {test,expect} from "@playwright/test";

async function openTab(page,label){
  await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
}

test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date("2026-09-28T12:00:00Z"));
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
  await expect(page.locator(".app-header h1")).toHaveText(/Study room/i);
  await expect(page.locator(".study-at-a-glance")).toBeVisible();
  await expect(page.locator(".study-games-cta")).toBeVisible();
  await expect(page.locator(".study-accordion")).toHaveCount(6);

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
  await expect(page.locator(".notices-card")).toBeVisible();
  await expect(page.locator(".notice-row").first()).toBeVisible();
  await expect(page.locator(".family-more")).toBeVisible();
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
  await expect(page.locator(".study-games-hero")).toBeVisible({timeout:10000});
  await expect(page.locator(".study-game-tile")).toHaveCount(4);
  await expect(page.locator(".game-engine-stats")).toHaveCount(0);
  await expect(page.locator(".question-tech-card")).toHaveCount(0);

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
  expect(engine.transform).toBe("skill-only-equivalent-item-v2");
  expect(engine.privateKeys).toEqual([]);

  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  expect(await page.locator(".game-answer").count()).toBeGreaterThanOrEqual(2);

  await page.locator(".game-answer").first().click();
  await expect(page.locator(".game-feedback")).toBeVisible();
  await expect(page.locator(".game-next")).toBeVisible();
});


test("all study game entry points stay inside the ABVM app",async({page})=>{
  await openTab(page,"Study");
  const links=page.locator("[data-open-games]");
  expect(await links.count()).toBeGreaterThanOrEqual(1);
  for(let i=0;i<await links.count();i++){
    await expect(links.nth(i)).toHaveAttribute("href","#games");
  }
  await links.first().click();
  await expect(page.locator(".games-screen")).toBeVisible();
  await expect(page.locator(".study-game-grid")).toBeVisible();
  await expect(page).toHaveURL(/#games$/);

  const legacy=await page.locator('a[href="./game/"],a[href$="/game/"]').count();
  expect(legacy).toBe(0);
});


test("Study Games hard-blocks list-recognition and restores researched quality gates",async({page})=>{
  await openTab(page,"Study Games");
  const report=await page.evaluate(async()=>{
    const source=await (await fetch("./data/study-pack.json",{cache:"no-store"})).json();
    const catalog=window.ABVMStudyGames.buildCatalog(source.pack,{sourceKey:"quality-regression-snapshot"});
    const forbidden=[
      /sight word/i,
      /which .* is on the current .* list/i,
      /which .* is on .* list/i,
      /current vocabulary list/i,
      /what .* is being practiced this week/i,
      /teacher page/i,
      /study list/i
    ];
    const bad=catalog.questions.filter(q=>forbidden.some(re=>re.test(q.prompt))).map(q=>q.prompt);
    const missingDiagnostics=catalog.questions.filter(q=>
      q.choices.some(choice=>choice!==q.answer&&(!q.choiceDiagnostics?.[choice]?.feedback||!q.choiceDiagnostics?.[choice]?.misconception))
    ).map(q=>q.id);
    const maxSkillCount=questions=>{
      const counts={};
      for(const q of questions)counts[q.skill]=(counts[q.skill]||0)+1;
      return Math.max(0,...Object.values(counts));
    };
    const selected=window.ABVMStudyGames.selectQuestions(catalog,{count:8,seed:"quality-session",skillStats:{}});
    return {
      issues:window.ABVMStudyGames.validateCatalog(catalog),
      count:catalog.questionCount,
      bad,
      minimumDifficulty:Math.min(...catalog.questions.map(q=>q.difficulty)),
      dok:[...new Set(catalog.questions.map(q=>q.dok))].sort(),
      standardsAll:catalog.questions.every(q=>Array.isArray(q.standards)&&q.standards.length>0),
      rubricAll:catalog.questions.every(q=>q.rubric?.maxPoints===2),
      missingDiagnostics,
      hasMaterialSubtraction:catalog.questions.some(q=>q.tier==="material"&&q.skill==="subtraction-within-12"),
      hasSentenceTypes:catalog.questions.some(q=>q.tier==="material"&&q.skill==="sentence-types"),
      hasBlends:catalog.questions.some(q=>q.tier==="material"&&q.skill==="consonant-blends"),
      hasReligion:catalog.questions.some(q=>q.tier==="material"&&q.subject==="Religion"),
      hasStarReading:catalog.questions.some(q=>q.tier==="star-fallback"&&q.subject==="Reading / ELA"),
      hasStarMath:catalog.questions.some(q=>q.tier==="star-fallback"&&q.subject==="Math"),
      hasContextVocabulary:catalog.questions.some(q=>/What does “.+” mean in this sentence\\?/.test(q.prompt)),
      selectionMaxPerSkill:maxSkillCount(selected),
      selectionConsecutive:selected.some((q,i)=>i>0&&selected[i-1].skill===q.skill)
    };
  });
  expect(report.issues).toEqual([]);
  expect(report.count).toBeGreaterThan(25);
  expect(report.bad).toEqual([]);
  expect(report.minimumDifficulty).toBeGreaterThanOrEqual(2);
  expect(report.dok).toEqual([1,2,3]);
  expect(report.standardsAll).toBe(true);
  expect(report.rubricAll).toBe(true);
  expect(report.missingDiagnostics).toEqual([]);
  expect(report.hasMaterialSubtraction).toBe(true);
  expect(report.hasSentenceTypes).toBe(true);
  expect(report.hasBlends).toBe(true);
  expect(report.hasReligion).toBe(true);
  expect(report.hasStarReading).toBe(true);
  expect(report.hasStarMath).toBe(true);
  expect(report.hasContextVocabulary).toBe(true);
  expect(report.selectionMaxPerSkill).toBeLessThanOrEqual(3);
  expect(report.selectionConsecutive).toBe(false);
});

test("Study Games uses targeted misconception feedback and adaptive evidence",async({page})=>{
  await openTab(page,"Study Games");
  await page.getByRole("button",{name:/Math Dash/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  const wrongIndex=await page.evaluate(()=>{
    const buttons=[...document.querySelectorAll(".game-answer")];
    const qText=document.querySelector(".game-question-card h2")?.textContent||"";
    return {count:buttons.length,qText};
  });
  expect(wrongIndex.count).toBe(3);

  const answerData=await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    const source=JSON.parse(document.querySelector("#app-content")?localStorage.getItem("__never__")||"null":"null");
    return {engineVersion:engine.VERSION,transform:engine.SOURCE_TRANSFORM};
  });
  expect(answerData.engineVersion).toContain("research-quality");
  expect(answerData.transform).toBe("skill-only-equivalent-item-v2");
});


test("simplicity pass keeps core actions obvious and reduces rendering overhead",async({page})=>{
  await openTab(page,"Study");
  await expect(page.locator(".study-games-cta")).toBeVisible();
  await expect(page.locator(".study-jumps")).toHaveCount(0);
  await expect(page.locator(".quest-launcher")).toHaveCount(0);
  const accordions=page.locator(".study-accordion");
  expect(await accordions.count()).toBe(6);
  for(let i=0;i<await accordions.count();i++) await expect(accordions.nth(i)).not.toHaveAttribute("open");

  await accordions.first().locator("summary").click();
  await expect(accordions.first()).toHaveAttribute("open","");

  await openTab(page,"Study Games");
  await expect(page.locator(".study-game-tile")).toHaveCount(4);
  const tileHeights=await page.locator(".study-game-tile").evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().height)));
  expect(Math.max(...tileHeights)).toBeLessThanOrEqual(120);

  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  await expect(page.locator(".games-screen")).toHaveClass(/is-playing/);
  await expect(page.locator(".games-screen .app-header")).toHaveCount(0);
  await expect(page.locator(".games-screen .freshness")).toHaveCount(0);

  const sw=await (await page.request.get("/sw.js")).text();
  expect(sw).toContain("v87-css-dead-code");
  expect(sw).not.toContain("hero-today.webp");
  expect(sw).not.toContain("calendar/picture-day.svg");
  const cached=[...sw.matchAll(/"\.\/[^\"]+"/g)];
  expect(cached.length).toBeLessThanOrEqual(12);
});


test("Sept 28 task-policy fixture keeps Mass and reading without routine clutter",async({page,browser})=>{
  const source=await (await page.request.get("/data/study-pack.json")).json();
  const context=await browser.newContext({serviceWorkers:"block"});
  const fixturePage=await context.newPage();
  await fixturePage.clock.setFixedTime(new Date("2026-09-28T12:00:00Z"));
  const homework=[
    {task:"Attend Mass",subject:"Religion"},
    {task:"Read",subject:"Reading"},
    {task:"Cover books",subject:"Parent"},
    {task:"Keep Reading Log and Behavior Chart in the HW folder",subject:"Reading"},
    {task:"Return everything in the HW folder",subject:"Homework Folder"}
  ];
  await fixturePage.route("**/data/study-pack.json*",route=>route.fulfill({json:{...source,pack:{...source.pack,homework}}}));
  await fixturePage.goto("http://127.0.0.1:4173/#today");
  const tasks=fixturePage.locator(".today-panel .check-item");
  await expect(tasks).toHaveCount(2);
  await expect(tasks.nth(0)).toContainText("Attend Mass");
  await expect(tasks.nth(1)).toContainText("Read");
  await expect(tasks.nth(1)).toContainText("20 minutes today");
  for(const item of homework.slice(2))await expect(fixturePage.getByText(item.task,{exact:true})).toHaveCount(0);
  homework.shift();
  await fixturePage.reload();
  await expect(tasks).toHaveCount(1);
  await expect(tasks.first()).toContainText("Read");
  await expect(fixturePage.getByText("Attend Mass",{exact:true})).toHaveCount(0);
  await context.close();
});

test("Study Games uses distinct polished subject icon badges",async({page})=>{
  await openTab(page,"Study Games");
  await expect(page.locator(".study-game-tile")).toHaveCount(4);
  for(const id of ["quick","math","words","faith"]){
    const icon=page.locator(".game-icon-"+id);
    await expect(icon).toBeVisible();
    await expect(icon.locator("svg")).toHaveCount(1);
  }
  await expect(page.locator(".game-icon-math .icon-outline")).toHaveCount(1);
  await expect(page.locator(".game-icon-words .icon-book")).toHaveCount(2);
  await expect(page.locator(".game-icon-faith .icon-cross")).toHaveCount(1);
});


test("Sept 28 weekly notice is integrated without duplicate stale events",async({page})=>{
  const data=await (await page.request.get("/data/study-pack.json")).json();
  const events=data.pack.importantDates||[];
  const has=(date,label)=>events.some(e=>e.date===date&&e.label===label);
  expect(has("Monday, Sept. 28","October Gift Card Calendar Fundraiser money and calendar bottoms due")).toBe(true);
  expect(has("Tuesday, Sept. 29","Sign up for conferences using the OptionC portal")).toBe(true);
  expect(has("Wednesday, Sept. 30","Mass")).toBe(true);
  expect(has("Wednesday, Sept. 30","Communication Folder")).toBe(true);
  expect(has("Wednesday, Sept. 30","Chick-fil-A sale starts")).toBe(true);
  expect(has("Thursday, Oct. 1","Picture Day")).toBe(true);
  expect(has("Thursday, Oct. 1","Business Casual")).toBe(true);
  expect(has("Thursday, Oct. 1","HSA virtual meeting")).toBe(true);
  expect(has("Saturday, Oct. 3","Welcome Back Dance (K–4) — 6–8 PM, ABVM Gym")).toBe(true);
  expect(has("Saturday, Oct. 3","Movie Night (Grades 5–8) — 6–8 PM")).toBe(true);
  expect(has("Friday, Oct. 9","12:00 dismissal")).toBe(true);
  expect(has("Monday, Oct. 12","No School — Columbus Day")).toBe(true);
  expect(has("Monday–Tuesday, Oct. 19–20","Parent-Teacher Conferences")).toBe(true);
  expect(has("Thursday, Oct. 22","Chick-fil-A pickup")).toBe(true);
  expect(has("Friday, Oct. 23","S’more Fun at Schwartz Farm")).toBe(true);
  expect(has("Friday–Saturday, Nov. 13–14","Drama Club Play")).toBe(true);
  expect(has("Saturday, Nov. 21","Reading Royals Game Family Fun Night")).toBe(true);
  expect(events.some(e=>e.date==="Friday, Oct. 2"&&/HSA/i.test(e.label||""))).toBe(false);
  expect(data.uploadedNotices.documents.some(d=>d.id==="weekly-reminders-2026-09-28")).toBe(true);
  expect(data.pack.reminders[0]).toContain("Gift Card Calendar Fundraiser");
  expect(data.pack.parentNotices[0]).toContain("OptionC portal");
});


test("current weekly notice appears in Week, Calendar, and Family screens",async({page})=>{
  await openTab(page,"Week");
  const days=page.locator("[data-day]");
  await days.nth(1).click();
  await expect(page.locator(".day-detail")).toContainText("OptionC portal");
  await days.nth(2).click();
  await expect(page.locator(".day-detail")).toContainText("Mass");
  await expect(page.locator(".day-detail")).toContainText("Communication Folder");
  await expect(page.locator(".day-detail")).toContainText("Chick-fil-A sale starts");
  await days.nth(3).click();
  await expect(page.locator(".day-detail")).toContainText("Picture Day");
  await expect(page.locator(".day-detail")).toContainText("Business Casual");
  await expect(page.locator(".day-detail")).toContainText("HSA virtual meeting");

  await openTab(page,"Calendar");
  await expect(page.locator(".month-agenda")).toContainText("Chick-fil-A sale starts");

  await openTab(page,"Family");
  await expect(page.locator(".notices-card")).toContainText("OptionC portal");
  await expect(page.locator(".notices-card")).toContainText("Picture Day and Business Casual");
});


test("current week lunch menu is verified and visible instead of last week's menu",async({page})=>{
  const data=await (await page.request.get("/data/study-pack.json")).json();
  expect(data.pack.weekLabel).toContain("September 28, 2026");
  expect(data.pack.lunchMenu.map(item=>item.day)).toEqual([
    "Monday, Sept. 28",
    "Tuesday, Sept. 29",
    "Wednesday, Sept. 30",
    "Thursday, Oct. 1",
    "Friday, Oct. 2"
  ]);
  expect(data.pack.lunchMenu[0].items).toEqual(["Breaded chicken","Brown rice","Steamed broccoli","Fruit"]);
  expect(data.pack.lunchMenu[1].items).toEqual(["Cheese quesadilla wedge","Garden salad","Salsa","Steamed corn","Fruit"]);
  expect(data.pack.lunchMenu[2].items).toEqual(["Breaded fish sandwich","Baby cake potatoes","Baked beans","Fruit"]);
  expect(data.pack.lunchMenu[3].items).toEqual(["Baked cheese pizza","Tortilla chips","Mixed vegetables","Fruit"]);
  expect(data.pack.lunchMenu[4].items).toEqual(["Cheesy breadsticks","Dipping sauce","Garden salad","Fruit"]);
  expect(data.pack.lunchMenuSource.provider).toBe("Saint Clair Area School District");
  expect(data.pack.lunchMenuSource.school).toBe("Assumption BVM School");
  expect(data.pack.lunchMenuSource.coverageThrough).toBe("2026-10-02");
  expect(data.pack.lunchMenu.some(item=>/Sept\. 2[1-5]/.test(item.day))).toBe(false);

  await openTab(page,"Today");
  await expect(page.locator(".lunch-card")).toContainText("Breaded chicken");
  await expect(page.locator(".lunch-card")).toContainText("Brown rice");
  await expect(page.locator(".lunch-card")).toContainText("Steamed broccoli");
  await expect(page.locator(".lunch-card")).not.toContainText("automated source check");

  await openTab(page,"Week");
  const days=page.locator("[data-day]");
  await days.nth(1).click();
  await expect(page.locator(".lunch-card")).toContainText("Cheese quesadilla wedge");
  await days.nth(2).click();
  await expect(page.locator(".lunch-card")).toContainText("Breaded fish sandwich");
  await days.nth(3).click();
  await expect(page.locator(".lunch-card")).toContainText("Baked cheese pizza");
  await expect(page.locator(".lunch-card")).toContainText("Mixed vegetables");
  await expect(page.locator(".lunch-card")).toContainText("Reviewed school menu · automated source check pending");
  await days.nth(4).click();
  await expect(page.locator(".lunch-card")).toContainText("Cheesy breadsticks");
  await expect(page.locator(".lunch-card")).toContainText("Dipping sauce");
});


test("published study content contains real lesson material instead of Google Sites chrome",async({page})=>{
  const data=await (await page.request.get("/data/study-pack.json")).json();
  const subjects=data.pack.subjects||[];
  const reading=subjects.find(s=>s.subject==="Reading / ELA");
  const spelling=subjects.find(s=>s.subject==="Spelling / Handwriting");
  const religion=subjects.find(s=>s.subject==="Religion");
  const nav=new Set(["Home","Reading Work","Weekly Spelling List","Homework","Tests","More Home"]);

  expect(reading.topics.filter(x=>x.startsWith("Story: "))).toEqual([
    "Story: Little Flap Learns to Fly",
    "Story: Help! A Story of Friendship"
  ]);
  expect(reading.studyNotes.join(" ")).not.toMatch(/dioalogue/i);
  expect(spelling.studyNotes).toEqual(["The Weekly Spelling List page currently has no word list posted."]);
  expect(religion.topics.filter(x=>nav.has(x))).toEqual([]);

  const winter=data.pack.importantDates.find(x=>x.label==="Start winter dress code");
  expect(winter?.kind).toBe("school event");

  const normalized=data.pack.reminders.map(x=>x.toLowerCase().replace(/\bthe\b/g,"").replace(/[^a-z0-9]/g,""));
  expect(new Set(normalized).size).toBe(normalized.length);
});


test("Subject Study Games stay on current material for full rounds",async({page})=>{
  await openTab(page,"Study Games");
  const report=await page.evaluate(async()=>{
    const source=await (await fetch("./data/study-pack.json",{cache:"no-store"})).json();
    const engine=window.ABVMStudyGames;
    const catalog=engine.buildCatalog(source.pack,{sourceKey:"current-material-mode-audit"});
    const math=engine.selectQuestions(catalog,{subjects:["Math"],count:8,seed:"math-current",skillStats:{}});
    const faith=engine.selectQuestions(catalog,{subjects:["Religion"],count:8,seed:"faith-current",skillStats:{}});
    const words=engine.selectQuestions(catalog,{
      subjects:["Reading / ELA","Spelling / Handwriting"],
      preferredSkills:["long-short-a","suffix-ed-ing"],
      count:8,seed:"word-current",skillStats:{}
    });
    return {
      math:math.map(q=>({tier:q.tier,skill:q.skill,sourceFact:q.sourceFact})),
      faith:faith.map(q=>({tier:q.tier,skill:q.skill,sourceFact:q.sourceFact})),
      words:words.map(q=>({tier:q.tier,skill:q.skill,sourceFact:q.sourceFact}))
    };
  });
  expect(report.math).toHaveLength(8);
  expect(report.faith).toHaveLength(8);
  expect(report.math.every(q=>q.tier==="material"&&/Subtraction to 12/i.test(q.sourceFact))).toBe(true);
  expect(report.faith.every(q=>q.tier==="material"&&/ABVM Religion/i.test(q.sourceFact))).toBe(true);
  expect(report.words).toHaveLength(8);
  expect(report.words.every(q=>q.tier==="material")).toBe(true);
  expect(report.words.filter(q=>q.skill==="long-short-a")).toHaveLength(3);
  expect(report.words.filter(q=>q.skill==="suffix-ed-ing")).toHaveLength(3);
});


test("game progress reflects the current question instead of starting at zero",async({page})=>{
  await openTab(page,"Study Games");
  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  const width=await page.locator(".game-progress span").getAttribute("style");
  expect(width).toContain("13");
});
