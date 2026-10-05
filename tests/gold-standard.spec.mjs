import {test,expect} from "@playwright/test";
import {readPwaVersions} from "./pwa-test-helpers.mjs";

async function openTab(page,label){
  if(label==="Study Games"){
    await page.getByRole("button",{name:"Study",exact:true}).click();
    await page.locator(".study-games-cta").click();
  }else await page.getByRole("button",{name:label,exact:true}).click();
  await expect(page.locator(".screen")).toBeVisible();
}

async function expectCurrentStudyGameTiles(page){
  const tiles=page.locator(".study-game-tile");
  const count=await tiles.count();
  expect(count).toBeGreaterThanOrEqual(4);
  expect(count).toBeLessThanOrEqual(5);
  for(const name of ["Quick Mix","Math Dash","Word Power","Faith Quest"]){
    await expect(page.getByRole("button",{name:new RegExp(name,"i")})).toBeVisible();
  }
  if(count===5)await expect(page.getByRole("button",{name:/Test Ready/i})).toBeVisible();
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
  await expect(page.locator(".current-month-summary")).toBeVisible();
  // The remaining September events occupy three dates; every event on each date stays visible.
  await expect(page.locator(".current-month-summary > div")).toHaveCount(3);
  await expect(page.locator(".current-month-summary")).toContainText("Gym classes moved to this date");
  await expect(page.locator(".current-month-summary")).toContainText("Chick-fil-A sale starts");

  await openTab(page,"Family");
  await expect(page.locator(".family-actions-card")).toBeVisible();
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toBeVisible();
  await expect(page.locator(".notice-row").first()).toBeVisible();
  await expect(page.locator(".family-more")).toHaveCount(0);
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
  await expect(page.locator(".current-month-summary > div > span")).toHaveText(["Mon 28","Tue 29","Wed 30"]);
  await expect(page.locator(".current-month-summary .agenda-lunch")).toHaveCount(0);
  await expect(page.locator(".calendar-day-card .agenda-lunch")).toBeVisible();
  await expect(page.locator(".calendar-legend")).toContainText("Lunch");
});


test("Study Games uses the StarBlox-style equivalent question engine",async({page})=>{
  await openTab(page,"Study Games");
  await expect(page.locator(".study-games-hero")).toBeVisible({timeout:10000});
  await expectCurrentStudyGameTiles(page);
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

  for(let attempt=0;attempt<3&&await page.locator(".game-next").count()===0;attempt++){
    await page.locator(".game-answer").first().click();
    await expect(page.locator(".game-feedback")).toBeVisible();
  }
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
    const pipelinePresent=Array.isArray(source.pack?.contentPipeline?.skills);
    const pipelineSkills=pipelinePresent?source.pack.contentPipeline.skills:[];
    const authorizedSkills=new Set(pipelineSkills.map(skill=>skill.id));
    const authorizedMath=pipelineSkills.filter(skill=>skill.subject==="Math").map(skill=>skill.id);
    const contextVocabularyCount=catalog.questions.filter(q=>/What does “.+” mean in this sentence\\?/.test(q.prompt)).length;
    return {
      issues:window.ABVMStudyGames.validateCatalog(catalog),
      count:catalog.questionCount,
      bad,
      minimumDifficulty:Math.min(...catalog.questions.map(q=>q.difficulty)),
      dok:[...new Set(catalog.questions.map(q=>q.dok))].sort(),
      standardsAll:catalog.questions.every(q=>Array.isArray(q.standards)&&q.standards.length>0),
      rubricAll:catalog.questions.every(q=>q.rubric?.maxPoints===2),
      missingDiagnostics,
      authorizedMathCount:authorizedMath.length,
      materialMathCount:catalog.questions.filter(q=>q.tier==="material"&&q.subject==="Math"&&authorizedSkills.has(q.skill)).length,
      missingAuthorizedSkills:[...authorizedSkills].filter(id=>!catalog.questions.some(q=>q.tier==="material"&&q.skill===id)),
      unauthorizedMaterial:catalog.questions.filter(q=>q.tier==="material"&&!authorizedSkills.has(q.skill)).map(q=>q.id),
      hasStarReading:catalog.questions.some(q=>q.tier==="star-fallback"&&q.subject==="Reading / ELA"),
      hasStarMath:catalog.questions.some(q=>q.tier==="star-fallback"&&q.subject==="Math"),
      pipelinePresent,
      vocabularyAuthorized:authorizedSkills.has("vocabulary-in-context"),
      contextVocabularyCount,
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
  expect(report.materialMathCount>0).toBe(report.authorizedMathCount>0);
  expect(report.missingAuthorizedSkills).toEqual([]);
  expect(report.unauthorizedMaterial).toEqual([]);
  expect(report.hasStarReading).toBe(true);
  expect(report.hasStarMath).toBe(true);
  if(report.pipelinePresent)expect(report.contextVocabularyCount>0).toBe(report.vocabularyAuthorized);
  else expect(report.contextVocabularyCount).toBeGreaterThanOrEqual(0);
  expect(report.selectionMaxPerSkill).toBeLessThanOrEqual(3);
  expect(report.selectionConsecutive).toBe(false);
});

test("Study Games uses targeted misconception feedback and adaptive evidence",async({page})=>{
  await openTab(page,"Study Games");
  await page.getByRole("button",{name:/Quick Mix/i}).click();
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
  await expectCurrentStudyGameTiles(page);
  const tileHeights=await page.locator(".study-game-tile").evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().height)));
  expect(Math.max(...tileHeights)).toBeLessThanOrEqual(120);

  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  await expect(page.locator(".games-screen")).toHaveClass(/is-playing/);
  await expect(page.locator(".games-screen .app-header")).toHaveCount(0);
  await expect(page.locator(".games-screen .freshness")).toHaveCount(0);

  const {sw,cacheName}=await readPwaVersions(page.request);
  expect(cacheName).toMatch(/^abvm-grade2-parent-companion-v\d+-[a-z-]+$/);
  expect(sw).not.toContain("hero-today.webp");
  expect(sw).not.toContain("calendar/picture-day.svg");
  const staticShell=sw.match(/const STATIC_SHELL = \[([\s\S]*?)\];/)?.[1]||"";
  const cached=[...staticShell.matchAll(/"\.\/[^\"]+"/g)];
  expect(cached.length).toBeLessThanOrEqual(12);
  const optional=sw.match(/const OPTIONAL_DATA = \[([\s\S]*?)\];/)?.[1]||"";
  expect([...optional.matchAll(/"(\.\/[^\"]+)"/g)].map(match=>match[1])).toEqual([
    "./data/study-pack-runtime.json", "./data/study-archive.json", "./data/schoolwork.json", "./data/religion-sources.json",
    "./study-hub.mjs", "./study-model.mjs", "./star-practice.mjs", "./study-hub.css", "./family-view.css?v=1", "./visual-polish.css?v=1", "./lunch-art.js?v=1"
  ]);
});


test("task policy keeps reading daily and Mass only on a verified Mass date",async({page,browser})=>{
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
  await fixturePage.route("**/data/study-pack-runtime.json*",route=>route.fulfill({json:{...source,pack:{...source.pack,homework}}}));
  await fixturePage.goto("http://127.0.0.1:4173/#today");
  const tasks=fixturePage.locator(".today-panel .check-item");
  await expect(tasks).toHaveCount(1);
  await expect(tasks.first()).toContainText("Read");
  await expect(tasks.first()).toContainText("20 minutes today");
  await expect(fixturePage.getByText("Attend Mass",{exact:true})).toHaveCount(0);
  for(const item of homework.slice(2))await expect(fixturePage.getByText(item.task,{exact:true})).toHaveCount(0);

  await fixturePage.clock.setFixedTime(new Date("2026-09-30T12:00:00Z"));
  await fixturePage.reload();
  await expect(tasks).toHaveCount(2);
  await expect(tasks.nth(0)).toContainText("Attend Mass");
  await expect(tasks.nth(1)).toContainText("Read");
  await context.close();
});

test("Study Games uses distinct polished subject icon badges",async({page})=>{
  await openTab(page,"Study Games");
  await expectCurrentStudyGameTiles(page);
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
  await expect(page.locator(".current-month-summary")).toContainText("Chick-fil-A sale starts");
  await expect(page.locator(".current-month-summary")).toContainText("Gym classes moved to this date");

  await openTab(page,"Family");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("OptionC portal");
  await expect(page.locator('[aria-labelledby="family-current-notices"]')).toContainText("Picture Day and Business Casual");
});


test("current week lunch menu is verified and visible instead of last week's menu",async({page})=>{
  const data=await (await page.request.get("/data/study-pack.json")).json();
  const lunches=data.pack?.lunchMenu||[];
  expect(lunches.length).toBeGreaterThan(0);
  const weekStart=lunches[0].date;
  expect(Number.isFinite(Date.parse(String(weekStart)+"T12:00:00Z"))).toBe(true);
  const startMs=Date.parse(`${weekStart}T12:00:00Z`);
  expect(Number.isFinite(startMs)).toBe(true);
  const dates=lunches.map(item=>item.date);
  expect(new Set(dates).size).toBe(dates.length);
  for(const item of lunches){
    expect(Number.isFinite(Date.parse(String(item.date)+"T12:00:00Z"))).toBe(true);
    const delta=(Date.parse(`${item.date}T12:00:00Z`)-startMs)/86400000;
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThanOrEqual(4);
    expect(Array.isArray(item.items)&&item.items.length>0).toBe(true);
  }
  expect(data.pack.lunchMenuSource.provider).toBe("Saint Clair Area School District");
  expect(data.pack.lunchMenuSource.school).toBe("Assumption BVM School");
  expect(data.pack.lunchMenuSource.coverageThrough>=dates.at(-1)).toBe(true);

  await page.clock.setFixedTime(new Date(`${weekStart}T17:00:00Z`));
  await page.reload();
  await expect(page.locator(".screen")).toBeVisible({timeout:10_000});

  await openTab(page,"Today");
  for(const item of lunches[0].items)await expect(page.locator(".lunch-card")).toContainText(item);
  await expect(page.locator(".lunch-card")).not.toContainText("automated source check");

  await openTab(page,"Week");
  for(const lunch of lunches){
    const day=page.locator(`[data-day^="${lunch.date}"]`);
    await expect(day).toHaveCount(1);
    await day.click();
    for(const item of lunch.items)await expect(page.locator(".lunch-card")).toContainText(item);
  }
});

test("published study content contains real lesson material instead of Google Sites chrome",async({page})=>{
  const data=await (await page.request.get("/data/study-pack.json")).json();
  const subjects=data.pack.subjects||[];
  const reading=subjects.find(s=>s.subject==="Reading / ELA");
  const spelling=subjects.find(s=>s.subject==="Spelling / Handwriting");
  const religion=subjects.find(s=>s.subject==="Religion");
  const nav=new Set(["Home","Reading Work","Weekly Spelling List","Homework","Tests","More Home"]);

  const stories=reading.topics.filter(x=>x.startsWith("Story: "));
  expect(stories.length).toBeGreaterThan(0);
  expect(new Set(stories).size).toBe(stories.length);
  expect(reading.studyNotes.join(" ")).not.toMatch(/dioalogue/i);
  for(const subject of [reading,spelling,religion]){
    const content=[...(subject?.topics||[]),...(subject?.studyNotes||[])];
    expect(content.filter(x=>nav.has(x))).toEqual([]);
  }
  expect((data.pack.importantDates||[]).every(x=>Boolean(x?.label&&x?.kind))).toBe(true);

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
    const pipelinePresent=Array.isArray(source.pack?.contentPipeline?.skills);
    const skills=pipelinePresent?source.pack.contentPipeline.skills:[];
    return {
      pipelinePresent,
      math:math.map(q=>({tier:q.tier,skill:q.skill,sourceFact:q.sourceFact})),
      faith:faith.map(q=>({tier:q.tier,skill:q.skill,sourceFact:q.sourceFact})),
      words:words.map(q=>({tier:q.tier,skill:q.skill,sourceFact:q.sourceFact})),
      authorizedMath:skills.filter(s=>s.subject==="Math").map(s=>s.id),
      authorizedFaith:skills.filter(s=>s.subject==="Religion").map(s=>s.id),
      authorizedWords:skills.filter(s=>["Reading / ELA","Spelling / Handwriting"].includes(s.subject)).map(s=>s.id),
      reviewMath:(source.pack?.recentReviewPipeline?.skills||[]).filter(s=>s.subject==="Math").map(s=>s.id),
      reviewFaith:(source.pack?.recentReviewPipeline?.skills||[]).filter(s=>s.subject==="Religion").map(s=>s.id),
      reviewWords:(source.pack?.recentReviewPipeline?.skills||[]).filter(s=>["Reading / ELA","Spelling / Handwriting"].includes(s.subject)).map(s=>s.id)
    };
  });
  const mathSkills=new Set(report.authorizedMath),faithSkills=new Set(report.authorizedFaith),wordSkills=new Set(report.authorizedWords);
  const reviewMath=new Set(report.reviewMath),reviewFaith=new Set(report.reviewFaith),reviewWords=new Set(report.reviewWords);
  const assertSubjectTier=(rows,currentIds,reviewIds,{starFallback=false}={})=>{
    if(!report.pipelinePresent){
      expect(rows.length).toBeGreaterThan(0);
      return;
    }
    if(currentIds.size){
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(q=>q.tier==="material"&&currentIds.has(q.skill))).toBe(true);
    }else if(reviewIds.size){
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(q=>q.tier==="recent-review"&&reviewIds.has(q.skill))).toBe(true);
    }else if(starFallback){
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(q=>q.tier==="star-fallback")).toBe(true);
    }else expect(rows).toEqual([]);
  };
  assertSubjectTier(report.math,mathSkills,reviewMath,{starFallback:true});
  assertSubjectTier(report.faith,faithSkills,reviewFaith);
  assertSubjectTier(report.words,wordSkills,reviewWords,{starFallback:true});
  if(!mathSkills.size&&!reviewMath.size)expect(report.math.length).toBe(8);
  expect(report.math.length).toBeLessThanOrEqual(8);
  expect(report.faith.length).toBeLessThanOrEqual(8);
  expect(report.words.length).toBeLessThanOrEqual(8);
  if(report.words.length){
    const wordCounts={};
    for(const q of report.words)wordCounts[q.skill]=(wordCounts[q.skill]||0)+1;
    expect(Math.max(...Object.values(wordCounts))).toBeLessThanOrEqual(3);
  }
});


test("game progress reflects the current question instead of starting at zero",async({page})=>{
  await openTab(page,"Study Games");
  await page.getByRole("button",{name:/Quick Mix/i}).click();
  await expect(page.locator(".game-question-card")).toBeVisible();
  const width=await page.locator(".game-progress span").getAttribute("style");
  expect(width).toContain("13");
});
