import {test,expect} from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.goto("/#games");
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
});

test("normal Study Games selection favors a due skill over an equally strong recently practiced skill",async({page})=>{
  const selected=await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    const now=Date.now();
    const catalog={questions:[
      {id:"due-theme",subject:"Reading / ELA",skill:"theme",tier:"material",difficulty:2},
      {id:"fresh-visualize",subject:"Reading / ELA",skill:"visualize",tier:"material",difficulty:2}
    ]};
    const skillStats={
      theme:{Seen:4,Correct:3,Wrong:1,ConsecutiveCorrect:1,ConsecutiveWrong:0,TargetDifficulty:2,LastIndependentAt:now-5*86400000},
      visualize:{Seen:4,Correct:3,Wrong:1,ConsecutiveCorrect:1,ConsecutiveWrong:0,TargetDifficulty:2,LastIndependentAt:now-10*60*1000}
    };
    return engine.selectQuestions(catalog,{count:1,seed:"spaced-review-test",skillStats}).map(q=>q.id);
  });
  expect(selected).toEqual(["due-theme"]);
});

test("independent attempts persist review timestamps while support exposure does not masquerade as independent practice",async({page})=>{
  const result=await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    localStorage.removeItem("abvm-study-learning:v2");
    const before=Date.now();
    engine.recordLearning({skill:"theme"},true);
    const independent={...engine.loadLearning().theme};
    engine.recordSupport({skill:"visualize"},true);
    const support={...engine.loadLearning().visualize};
    return {before,independent,support};
  });

  expect(result.independent.LastSeenAt).toBeGreaterThanOrEqual(result.before);
  expect(result.independent.LastIndependentAt).toBeGreaterThanOrEqual(result.before);
  expect(result.independent.LastIndependentCorrectAt).toBeGreaterThanOrEqual(result.before);
  expect(result.support.LastSeenAt).toBeGreaterThanOrEqual(result.before);
  expect(result.support.LastSupportAt).toBeGreaterThanOrEqual(result.before);
  expect(result.support.LastIndependentAt).toBeUndefined();
});

test("recent misses can remain review-priority even before a long spacing interval",async({page})=>{
  const result=await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    const now=Date.now();
    const struggling={Seen:4,Correct:1,Wrong:3,ConsecutiveWrong:1,TargetDifficulty:2,LastIndependentAt:now-30*60*1000};
    const strong={Seen:6,Correct:6,Wrong:0,ConsecutiveCorrect:3,TargetDifficulty:3,LastIndependentAt:now-30*60*1000};
    return {
      struggling:engine.reviewPriority({theme:struggling},"theme",now),
      strong:engine.reviewPriority({visualize:strong},"visualize",now)
    };
  });
  expect(result.struggling).toBeGreaterThan(result.strong);
});
