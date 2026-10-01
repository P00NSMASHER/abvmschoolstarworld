import {test,expect} from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.goto("/#games");
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10_000});
});

test("subject-constrained selection never pads current material with fallback questions",async({page})=>{
  const result=await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    const catalog={questions:[
      {id:"m1",subject:"Math",skill:"current-math",tier:"material",difficulty:2},
      {id:"m2",subject:"Math",skill:"current-math",tier:"material",difficulty:2},
      {id:"f1",subject:"Math",skill:"fallback-a",tier:"star-fallback",difficulty:2},
      {id:"f2",subject:"Math",skill:"fallback-b",tier:"star-fallback",difficulty:2}
    ]};
    return engine.selectQuestions(catalog,{subjects:["Math"],count:4,seed:"material-only",skillStats:{}})
      .map(q=>({id:q.id,tier:q.tier}));
  });
  expect(result).toHaveLength(2);
  expect(result.every(q=>q.tier==="material")).toBe(true);
});

test("a constrained academic mode with no current or review material uses STAR-style fallback",async({page})=>{
  const result=await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    const catalog={questions:[
      {id:"f1",subject:"Math",skill:"fallback-a",tier:"star-fallback",difficulty:2},
      {id:"f2",subject:"Math",skill:"fallback-b",tier:"star-fallback",difficulty:2}
    ]};
    return engine.selectQuestions(catalog,{subjects:["Math"],count:8,seed:"no-material",skillStats:{}})
      .map(q=>({id:q.id,tier:q.tier}));
  });
  expect(result).toHaveLength(2);
  expect(result.every(q=>q.tier==="star-fallback")).toBe(true);
});

test("Quick Mix remains allowed to use fallback after exhausting current material",async({page})=>{
  const result=await page.evaluate(()=>{
    const engine=window.ABVMStudyGames;
    const catalog={questions:[
      {id:"m1",subject:"Math",skill:"current-math",tier:"material",difficulty:2},
      {id:"f1",subject:"Reading / ELA",skill:"fallback-a",tier:"star-fallback",difficulty:2}
    ]};
    return engine.selectQuestions(catalog,{count:2,seed:"quick-fallback",skillStats:{}}).map(q=>q.tier);
  });
  expect(result).toContain("material");
  expect(result).toContain("star-fallback");
});
