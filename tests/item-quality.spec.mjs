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
      id:"quality-math-answer-7",contentFingerprint:"content-fp-abc123",variantFingerprint:"variant-fp-xyz789",
      subject:"Math",skill:"subtraction-within-12",
      choices:["7","6","5"],answer:"7",
      choiceDiagnostics:{
        "6":{misconception:"off-by-one",feedback:"Count back once more."},
        "5":{misconception:"over-subtraction",feedback:"You took away too many."}
      }
    };

    e.markQuestionShown(q);
    e.note(q,0);
    e.recordLearning(q,true,{attemptCount:1,incorrectCount:0,hintCount:0});

    e.markQuestionShown(q);
    e.note(q,1);
    e.note(q,2);
    e.note(q,1);
    e.recordLearning(q,false,{attemptCount:3,incorrectCount:3,hintCount:1});

    e.markQuestionShown(q);
    e.note(q,0);
    e.recordSupport(q,true);

    e.markQuestionShown(q);
    e.note(q,0);
    e.recordComeback(q,true);

    return e.loadItemQuality();
  });

  expect(result.schemaVersion).toBe(2);
  const keys=Object.keys(result.items);
  expect(keys).toHaveLength(1);
  expect(keys[0]).not.toContain("quality-math-answer-7");
  expect(keys[0]).not.toContain("variant-fp-xyz789");
  const row=result.items[keys[0]];
  expect(row.Resolved).toBe(4);
  expect(row.Correct).toBe(3);
  expect(row.Wrong).toBe(1);
  expect(row.FirstTryCorrect).toBe(1);
  expect(row.ChoicePositions).toEqual([3,2,1]);
  expect(row.Misconceptions["off-by-one"]).toBe(2);
  expect(row.Misconceptions["over-subtraction"]).toBe(1);
  expect(row.HintsUsed).toBe(1);
  expect(row.SupportSeen).toBe(1);
  expect(row.ComebackSeen).toBe(1);
  expect(row.ComebackCorrect).toBe(1);
  expect(Object.values(row.ResponseBands).reduce((a,b)=>a+b,0)).toBe(2);

  const serialized=JSON.stringify(result);
  for(const forbidden of ["username","userId","rawAnswer","sessionId","email","studentId"]){
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
  expect(serialized).not.toContain("quality-math-answer-7");
  expect(serialized).not.toContain("variant-fp-xyz789");
  expect(row).not.toHaveProperty("Prompt");
  expect(row).not.toHaveProperty("Answer");
  expect(row).not.toHaveProperty("Choices");
  expect(row).not.toHaveProperty("LastUpdatedAt");
  expect(row).toHaveProperty("Order");
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
        Skill:"dialogue",Subject:"Reading / ELA",Resolved:12,Correct:5,Wrong:7,FirstTryCorrect:5,
        ChoicePositions:[4,4,4],Misconceptions:{"speaker-vs-dialogue":3,"quotation-boundary":2,"narration-confusion":2},
        ResponseBands:{lt5:2,"5to15":3,"15to30":1,gte30:6},
        ComebackSeen:2,ComebackCorrect:1,AbilityN:12,AbilitySum:6,AbilitySumSq:4,FirstTryAbilitySum:2.5
      },
      flat:{
        Skill:"visualize",Subject:"Reading / ELA",Resolved:12,Correct:6,Wrong:6,FirstTryCorrect:5,
        ChoicePositions:[4,4,4],Misconceptions:{"detail-mismatch":4,"unrelated-scene":2},
        ResponseBands:{lt5:5,"5to15":5,"15to30":2,gte30:0},
        ComebackSeen:0,ComebackCorrect:0,AbilityN:12,AbilitySum:6,AbilitySumSq:4,FirstTryAbilitySum:2.5
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
  expect(byId.flat.discrimination).toBe(0);
  expect(byId.flat.discriminationEvidence).toBe("reviewable");
  expect(byId.flat.method).toBe("classical-longitudinal-proxy");
  expect(byId.flat.irtUsed).toBe(false);
  expect(byId.hard.comebackRate).toBe(.5);
});

test("negative discrimination is treated as a review problem rather than strong evidence",async({page})=>{
  const [row]=await page.evaluate(()=>window.ABVMStudyGames.reviewItemQuality({
    schemaVersion:1,
    items:{
      reversed:{
        Skill:"theme",Subject:"Reading / ELA",Resolved:12,NormalResolved:12,NormalCorrect:6,NormalWrong:6,FirstTryCorrect:6,
        ChoicePositions:[4,4,4],Misconceptions:{m:6},ResponseBands:{lt5:3,"5to15":5,"15to30":4,gte30:0},
        ComebackSeen:0,ComebackCorrect:0,
        AbilityN:12,AbilitySum:6,AbilitySumSq:4,FirstTryAbilitySum:1
      }
    }
  }));
  expect(row.discrimination).toBeLessThan(0);
  expect(row.discriminationEvidence).toBe("reviewable");
  expect(row.flags).toContain("low-discrimination");
  expect(row.irtUsed).toBe(false);
});

test("item-quality review refuses discrimination claims when evidence is insufficient",async({page})=>{
  const [small,noVariance]=await page.evaluate(()=>[
    window.ABVMStudyGames.reviewItemQuality({schemaVersion:1,items:{
      small:{Skill:"theme",Subject:"Reading / ELA",Resolved:5,Correct:4,Wrong:1,FirstTryCorrect:3,ChoicePositions:[2,2,1],Misconceptions:{m:1},ResponseBands:{lt5:1,"5to15":3,"15to30":1,gte30:0},AbilityN:5,AbilitySum:2.5,AbilitySumSq:1.75,FirstTryAbilitySum:1.5}
    }})[0],
    window.ABVMStudyGames.reviewItemQuality({schemaVersion:1,items:{
      flatAbility:{Skill:"theme",Subject:"Reading / ELA",Resolved:12,Correct:6,Wrong:6,FirstTryCorrect:6,ChoicePositions:[4,4,4],Misconceptions:{m:6},ResponseBands:{lt5:2,"5to15":8,"15to30":2,gte30:0},AbilityN:12,AbilitySum:6,AbilitySumSq:3,FirstTryAbilitySum:3}
    }})[0]
  ]);
  expect(small.discriminationEvidence).toBe("insufficient-evidence");
  expect(noVariance.discrimination).toBeNull();
  expect(noVariance.discriminationEvidence).toBe("insufficient-evidence");
  expect(noVariance.flags).not.toContain("low-discrimination");
  expect(noVariance.irtUsed).toBe(false);
});

test("item-quality storage is bounded and does not become an event log",async({page})=>{
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    for(let i=0;i<275;i++){
      const q={id:"bounded-"+i,subject:"Math",skill:"subtraction-within-12",choices:["1","2","3"],answer:"1",choiceDiagnostics:{"2":{misconception:"m2"},"3":{misconception:"m3"}}};
      e.markQuestionShown(q);
      e.note(q,0);
      e.recordLearning(q,true,{attemptCount:1,incorrectCount:0,hintCount:0});
    }
    return e.loadItemQuality();
  });
  expect(Object.keys(result.items).length).toBeLessThanOrEqual(250);
});


test("legacy item-quality rows are scrubbed to timestamp-free aggregate schema",async({page})=>{
  const result=await page.evaluate(()=>{
    localStorage.setItem("abvm-study-item-quality:v1",JSON.stringify({
      schemaVersion:1,
      items:{
        qlegacy123:{
          Skill:"theme",Subject:"Reading / ELA",Resolved:3,Correct:2,Wrong:1,NormalResolved:3,NormalCorrect:2,NormalWrong:1,
          FirstTryCorrect:1,ChoicePositions:[1,1,1],Misconceptions:{m:1,"PRIVATE ANSWER TAG":9},ResponseBands:{lt5:1,"5to15":2,"15to30":0,gte30:0},
          HintsUsed:1,SupportSeen:0,ComebackSeen:1,ComebackCorrect:1,AbilityN:3,AbilitySum:1.5,AbilitySumSq:.75,
          FirstTryAbilitySum:.5,LastUpdatedAt:1700000000000,Prompt:"PRIVATE PROMPT",Answer:"PRIVATE ANSWER",SessionId:"PRIVATE SESSION"
        }
      }
    }));
    const loaded=window.ABVMStudyGames.loadItemQuality();
    return {loaded,stored:localStorage.getItem("abvm-study-item-quality:v1")};
  });
  expect(result.loaded.schemaVersion).toBe(2);
  expect(result.loaded.items.qlegacy123).toBeDefined();
  expect(result.loaded.items.qlegacy123).not.toHaveProperty("LastUpdatedAt");
  expect(result.loaded.items.qlegacy123).toHaveProperty("Order");
  for(const forbidden of ["PRIVATE PROMPT","PRIVATE ANSWER","PRIVATE ANSWER TAG","PRIVATE SESSION","LastUpdatedAt","SessionId"]){
    expect(result.stored).not.toContain(forbidden);
  }
});

test("item-quality migration returns sanitized aggregates even when write-back storage fails",async({page})=>{
  const result=await page.evaluate(()=>{
    const key="abvm-study-item-quality:v1";
    localStorage.setItem(key,JSON.stringify({schemaVersion:1,items:{
      qlegacyfail:{Skill:"theme",Subject:"Reading / ELA",Resolved:2,Correct:1,Wrong:1,NormalResolved:2,NormalCorrect:1,NormalWrong:1,
        FirstTryCorrect:1,ChoicePositions:[1,1,0],Misconceptions:{"theme-too-narrow":1},ResponseBands:{lt5:0,"5to15":2,"15to30":0,gte30:0},
        HintsUsed:0,SupportSeen:0,ComebackSeen:0,ComebackCorrect:0,AbilityN:2,AbilitySum:1,AbilitySumSq:.5,FirstTryAbilitySum:.5,
        LastUpdatedAt:1700000000000,Prompt:"PRIVATE PROMPT"}
    }}));
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new Error("blocked");return original.call(this,k,v)};
    try{return window.ABVMStudyGames.loadItemQuality()}finally{Storage.prototype.setItem=original}
  });
  expect(result.schemaVersion).toBe(2);
  expect(result.items.qlegacyfail).toBeDefined();
  expect(result.items.qlegacyfail).not.toHaveProperty("LastUpdatedAt");
  expect(JSON.stringify(result)).not.toContain("PRIVATE PROMPT");
});

test("new question families stay feature-flagged until QA and sufficient safe usage evidence",async({page})=>{
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    return {
      policy:e.questionFamilyRolloutPolicy(),
      initial:e.reviewQuestionFamilyPromotion({familyId:"experimental-family"}),
      qaOnly:e.reviewQuestionFamilyPromotion({familyId:"experimental-family",automatedQaPassed:true}),
      ready:e.reviewQuestionFamilyPromotion({familyId:"experimental-family",featureFlagged:true,automatedQaPassed:true,safeUsageEvidence:"sufficient-safe-usage"}),
      missingFlag:e.reviewQuestionFamilyPromotion({familyId:"experimental-family",automatedQaPassed:true,safeUsageEvidence:"sufficient-safe-usage"})
    };
  });
  expect(result.policy).toEqual(expect.objectContaining({
    featureFlagRequired:true,automaticPromotion:false,automaticDelete:false,automaticRewrite:false,irtUsed:false
  }));
  expect(result.initial.status).toBe("HOLD");
  expect(result.initial.blockers).toEqual(expect.arrayContaining(["automated-qa-required","safe-usage-evidence-required"]));
  expect(result.qaOnly.status).toBe("HOLD");
  expect(result.qaOnly.blockers).toContain("safe-usage-evidence-required");
  expect(result.ready.status).toBe("READY_FOR_MANUAL_PROMOTION");
  expect(result.ready.blockers).toEqual([]);
  expect(result.missingFlag.status).toBe("HOLD");
  expect(result.missingFlag.blockers).toContain("feature-flag-required");
  expect(result.ready.automaticPromotion).toBe(false);
});

test("small samples stay insufficient and cannot trigger automatic family promotion or mutation",async({page})=>{
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    const [small]=e.reviewItemQuality({schemaVersion:2,items:{
      qsmall:{Skill:"theme",Subject:"Reading / ELA",Resolved:5,NormalResolved:5,NormalCorrect:4,NormalWrong:1,FirstTryCorrect:3,
        ChoicePositions:[2,2,1],Misconceptions:{m:1},ResponseBands:{lt5:1,"5to15":3,"15to30":1,gte30:0},
        AbilityN:5,AbilitySum:2.5,AbilitySumSq:1.75,FirstTryAbilitySum:1.5}
    }});
    const gate=e.reviewQuestionFamilyPromotion({familyId:"small-sample-family",automatedQaPassed:true,safeUsageEvidence:small.discriminationEvidence});
    return {small,gate};
  });
  expect(result.small.discriminationEvidence).toBe("insufficient-evidence");
  expect(result.small.irtUsed).toBe(false);
  expect(result.gate.status).toBe("HOLD");
  expect(result.gate.automaticPromotion).toBe(false);
  expect(result.gate.automaticDelete).toBe(false);
  expect(result.gate.automaticRewrite).toBe(false);
});
