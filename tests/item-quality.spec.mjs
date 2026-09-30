import {test,expect} from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.goto("/#games");
  await expect(page.locator(".study-game-grid")).toBeVisible({timeout:10000});
  await page.evaluate(()=>localStorage.removeItem("abvm-study-item-quality:v1"));
});

test("item-quality monitoring stays local and stores privacy-minimized aggregate evidence",async({page})=>{
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    const q={
      id:"quality-math-1",subject:"Math",skill:"subtraction-within-12",
      choices:["7","6","5"],answer:"7",
      choiceDiagnostics:{
        "6":{misconception:"off-by-one",feedback:"Count back once more."},
        "5":{misconception:"over-subtraction",feedback:"You took away too many."}
      }
    };

    e.markQuestionShown(q);
    e.recordLearning(q,true,{attemptCount:1,incorrectCount:0,hintCount:0,r:0,w:null});

    e.markQuestionShown(q);
    e.recordLearning(q,false,{attemptCount:3,incorrectCount:3,hintCount:1,r:1,w:1});

    e.markQuestionShown(q);
    e.recordSupport(q,true);

    e.markQuestionShown(q);
    e.recordComeback(q,true);

    return e.loadItemQuality();
  });

  expect(result.schemaVersion).toBe(1);
  const row=result.items["quality-math-1"];
  expect(row.Resolved).toBe(4);
  expect(row.Correct).toBe(3);
  expect(row.Wrong).toBe(1);
  expect(row.FirstTryCorrect).toBe(1);
  expect(row.ChoicePositions).toEqual([1,1,0]);
  expect(row.Misconceptions["off-by-one"]).toBe(1);
  expect(row.HintsUsed).toBe(1);
  expect(row.SupportSeen).toBe(1);
  expect(row.ComebackSeen).toBe(1);
  expect(row.ComebackCorrect).toBe(1);
  expect(Object.values(row.ResponseBands).reduce((a,b)=>a+b,0)).toBe(4);

  const serialized=JSON.stringify(result);
  for(const forbidden of ["username","userId","rawAnswer","sessionId","email","studentId"]){
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
  expect(row).not.toHaveProperty("Prompt");
  expect(row).not.toHaveProperty("Answer");
  expect(row).not.toHaveProperty("Choices");
});

test("item-quality review flags weak items without claiming standardized psychometrics",async({page})=>{
  const rows=await page.evaluate(()=>window.ABVMStudyGames.reviewItemQuality({
    schemaVersion:1,
    items:{
      easy:{
        Skill:"theme",Subject:"Reading / ELA",Resolved:10,Correct:10,Wrong:0,FirstTryCorrect:10,
        ChoicePositions:[4,3,3],Misconceptions:{},ResponseBands:{lt5:8,"5to15":2,"15to30":0,gte30:0},
        ComebackSeen:0,ComebackCorrect:0,AbilityN:10,AbilitySum:5,AbilitySumSq:2.5,CorrectAbilitySum:5
      },
      hard:{
        Skill:"subtraction-within-12",Subject:"Math",Resolved:10,Correct:2,Wrong:8,FirstTryCorrect:1,
        ChoicePositions:[3,4,3],Misconceptions:{"operation-confusion":5,"off-by-one":3},ResponseBands:{lt5:2,"5to15":3,"15to30":2,gte30:3},
        ComebackSeen:2,ComebackCorrect:1,AbilityN:10,AbilitySum:5,AbilitySumSq:2.5,CorrectAbilitySum:1
      },
      ambiguous:{
        Skill:"dialogue",Subject:"Reading / ELA",Resolved:12,Correct:5,Wrong:7,FirstTryCorrect:4,
        ChoicePositions:[4,4,4],Misconceptions:{"speaker-vs-dialogue":3,"quotation-boundary":2,"narration-confusion":2},
        ResponseBands:{lt5:2,"5to15":3,"15to30":1,gte30:6},
        ComebackSeen:2,ComebackCorrect:1,AbilityN:12,AbilitySum:6,AbilitySumSq:3,CorrectAbilitySum:2.5
      },
      flat:{
        Skill:"visualize",Subject:"Reading / ELA",Resolved:12,Correct:6,Wrong:6,FirstTryCorrect:5,
        ChoicePositions:[4,4,4],Misconceptions:{"detail-mismatch":4,"unrelated-scene":2},
        ResponseBands:{lt5:5,"5to15":5,"15to30":2,gte30:0},
        ComebackSeen:0,ComebackCorrect:0,AbilityN:12,AbilitySum:6,AbilitySumSq:3,CorrectAbilitySum:3
      }
    }
  }));

  const byId=Object.fromEntries(rows.map(row=>[row.id,row]));
  expect(byId.easy.flags).toContain("too-easy");
  expect(byId.hard.flags).toContain("too-hard");
  expect(byId.hard.flags).toContain("dominant-misconception");
  expect(byId.ambiguous.flags).toContain("possible-ambiguity");
  expect(byId.ambiguous.flags).toContain("slow-response");
  expect(byId.flat.flags).toContain("low-discrimination");
  expect(byId.hard.comebackRate).toBe(.5);
});

test("item-quality storage is bounded and does not become an event log",async({page})=>{
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    for(let i=0;i<275;i++){
      const q={id:"bounded-"+i,subject:"Math",skill:"subtraction-within-12",choices:["1","2","3"],answer:"1",choiceDiagnostics:{"2":{misconception:"m2"},"3":{misconception:"m3"}}};
      e.markQuestionShown(q);
      e.recordLearning(q,true,{attemptCount:1,incorrectCount:0,hintCount:0,r:0});
    }
    return e.loadItemQuality();
  });
  expect(Object.keys(result.items).length).toBeLessThanOrEqual(250);
});
