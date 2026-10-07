import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({timeout:10_000});
});

test('subject mode orders current material before recent verified review',async({page})=>{
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    const base=q=>({
      id:q.id,subject:q.subject,skill:q.skill,tier:q.tier,questionType:'direct',format:'multiple_choice',
      prompt:'Choose the correct answer for this verified Grade 2 practice question.',choices:['A','B','C'],answer:'A',
      explanation:'A is correct for this test item.',hint:'Use the verified skill.',standards:['TEST.1'],domain:'Test',
      dok:2,cognitiveDemand:'skill / concept',difficulty:2,
      choiceDiagnostics:{B:{feedback:'Try again.',misconception:'test'},C:{feedback:'Try again.',misconception:'test'}},
      rubric:{maxPoints:2,criteria:['a','b']},provenance:'x',sourceFact:'x',sourceTransform:'skill-only-equivalent-item-v2',
      originalEquivalent:true,contentFingerprint:'c'+q.id,variantFingerprint:'v'+q.id,richContent:null,
      reviewVerifiedAt:q.reviewVerifiedAt||'',reviewExpiresAt:q.reviewExpiresAt||''
    });
    const catalog={sourceKey:'continuity-test',questions:[
      base({id:'current-reading',subject:'Reading / ELA',skill:'current-reading',tier:'material'}),
      base({id:'review-reading',subject:'Reading / ELA',skill:'old-reading',tier:'recent-review',reviewVerifiedAt:'2026-09-30T12:00:00.000Z',reviewExpiresAt:'2026-10-14T12:00:00.000Z'}),
      base({id:'review-math',subject:'Math',skill:'old-math',tier:'recent-review',reviewVerifiedAt:'2026-09-30T12:00:00.000Z',reviewExpiresAt:'2026-10-14T12:00:00.000Z'})
    ]};
    return {
      reading:e.selectQuestions(catalog,{subjects:['Reading / ELA'],count:5,seed:'r'}).map(q=>q.tier),
      math:e.selectQuestions(catalog,{subjects:['Math'],count:5,seed:'m'}).map(q=>q.tier)
    };
  });
  expect(result.reading).toEqual(['material','recent-review']);
  expect(result.math).toEqual(['recent-review']);
});

test('recent review question is visibly labeled and source identity includes review-bank fingerprint',async({page})=>{
  const result=await page.evaluate(()=>{
    const v=window.ABVMStudyGameView,e=window.ABVMStudyGames;
    const q={subject:'Math',skill:'old-math',tier:'recent-review',questionType:'direct',prompt:'Which answer is correct for this recent review question?',choices:['1','2','3'],answer:'1',explanation:'One is correct.',hint:'Use the skill.',choiceDiagnostics:{'2':{feedback:'Try again.'},'3':{feedback:'Try again.'}}};
    const html=v.play({g:{supportMode:false,comebackMode:false,index:0,questions:[q],selectedIndex:null,answered:false,retry:0,lastWrong:null,score:0,streak:0,bestStreak:0},mode:{title:'Math'},q,teach:null,retryInstruction:'Try.',labels:{direct:'Practice'}});
    const key=e.sourceKeyFromEnvelope({sourceHash:'s',contentPipeline:{bankFingerprint:'current-bank'},recentReviewPipeline:{bankFingerprint:'review-bank'}},{sourcePages:[]});
    return {html,key};
  });
  expect(result.html).toContain('Recent review');
  expect(result.key).toContain('|review:review-bank');
});

test('real catalog keeps current material ahead of recent review while preserving both tiers',async({page})=>{
  const result=await page.evaluate(async()=>{
    const envelope=await fetch('./data/study-pack.json',{cache:'no-store'}).then(r=>r.json());
    const pack=structuredClone(envelope.pack);
    const sample=pack.contentPipeline.questions.find(q=>q.skill==='sentence-types')||pack.contentPipeline.questions[0];
    pack.recentReviewPipeline={
      schemaVersion:1,retentionDays:14,generatedAt:'2026-10-01T12:00:00.000Z',bankFingerprint:'review-test',
      skills:[{id:'review-only',subject:'Math',label:'Review only',reviewVerifiedAt:'2026-09-30T12:00:00.000Z',reviewExpiresAt:'2026-10-14T12:00:00.000Z',reviewSourceHash:'old'}],
      questions:[{...sample,id:'review-only-q',skill:'review-only',subject:'Math',prompt:'Which answer is correct for this distinct recent-review-only practice item?',reviewVerifiedAt:'2026-09-30T12:00:00.000Z',reviewExpiresAt:'2026-10-14T12:00:00.000Z',reviewSourceHash:'old'}]
    };
    const e=window.ABVMStudyGames,c=e.buildCatalog(pack,{sourceKey:'review-real'});
    return {tiers:[...new Set(c.questions.map(q=>q.tier))],math:e.selectQuestions(c,{subjects:['Math'],count:3,seed:'math'}).map(q=>q.tier)};
  });
  expect(result.tiers).toContain('recent-review');
  expect(result.tiers).toContain('material');
  expect(result.math.length).toBeGreaterThan(0);
});


test('recent review evidence maps to Remembered later instead of Strong today',async({page})=>{
  const summary=await page.evaluate(()=>window.ABVMStudyGames.learningFirstSummary([
    {skill:'old-math',kind:'review',correct:true,independent:true},
    {skill:'current-reading',kind:'normal',correct:true,independent:true},
    {skill:'old-writing',kind:'review',correct:false,independent:false}
  ]));
  expect(summary).toEqual({strong:1,remembered:1,practice:1,total:3});
});


test('skill-filtered Test Ready never falls back to recent review',async({page})=>{
  const result=await page.evaluate(()=>{
    const e=window.ABVMStudyGames;
    const base=q=>({
      id:q.id,subject:'Reading / ELA',skill:q.skill,tier:q.tier,questionType:'direct',format:'multiple_choice',
      prompt:'Choose the correct answer for this verified Grade 2 practice question.',choices:['A','B','C'],answer:'A',
      explanation:'A is correct.',hint:'Use the skill.',standards:['TEST.1'],domain:'Test',dok:2,cognitiveDemand:'skill / concept',difficulty:2,
      choiceDiagnostics:{B:{feedback:'Try again.',misconception:'test'},C:{feedback:'Try again.',misconception:'test'}},
      rubric:{maxPoints:2,criteria:['a','b']},provenance:'x',sourceFact:'x',sourceTransform:'skill-only-equivalent-item-v2',
      originalEquivalent:true,contentFingerprint:'c'+q.id,variantFingerprint:'v'+q.id,richContent:null,
      reviewVerifiedAt:q.reviewVerifiedAt||'',reviewExpiresAt:q.reviewExpiresAt||''
    });
    const catalog={sourceKey:'test-ready-review-block',questions:[
      base({id:'review-only',skill:'old-grammar',tier:'recent-review',reviewVerifiedAt:'2026-09-30T12:00:00.000Z',reviewExpiresAt:'2026-10-14T12:00:00.000Z'})
    ]};
    return e.selectQuestions(catalog,{skills:['old-grammar'],count:5,seed:'test-ready'}).map(q=>q.tier);
  });
  expect(result).toEqual([]);
});
