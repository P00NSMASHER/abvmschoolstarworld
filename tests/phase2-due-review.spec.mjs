import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('due reviewed skills join a source-safe subject round on iPhone without changing Test Prep',async({page})=>{
  await page.goto('/#study');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
  const result=await page.evaluate(async()=>{
    const {createStudyMaterials}=await import('./study-materials.mjs?v=2');
    const now=Date.parse('2026-11-08T19:00:00-05:00');
    const engine=window.ABVMStudyGames,review=window.ABVMStudyReview;
    const make=(id,skill)=>({id,skill,subject:'Math',tier:'material',difficulty:2,
      questionType:'direct',variantFingerprint:id,prompt:'Synthetic '+id+'?',
      answer:'Yes '+id,choices:['Yes '+id,'No '+id],
      hint:'Review the skill.',explanation:'Checked synthetic example.'});
    const current=Array.from({length:16},(_,i)=>make('current-'+i,'math-addition'));
    const older=[make('prior-a','prior-due-a'),make('prior-b','prior-due-b')];
    const history={};
    for(const skill of older.map(q=>q.skill))history[skill]={
      Seen:2,Review:review.schedule({}, {correct:true,independent:true,now:now-3*86400000})};
    const storage={getItem:()=>null,setItem:()=>{}};
    const model=createStudyMaterials({now:()=>now,engine,storage,
      catalog:{sourceKey:'synthetic-phase2',questions:current},
      schoolwork:{lessons:[{id:'prior',weekOf:'2026-10-26',studiedOn:'2026-10-30',subject:'Math',questions:older}]},
      events:[{date:'2026-11-11',label:'Math addition',kind:'test'}]});
    const subject=model.round('math',{seed:'browser-review',learning:history});
    const testRound=model.testRound({index:0,upcoming:true,seed:'browser-exam'});
    return {due:older.map(q=>engine.reviewDue(history,q.skill,now)),
      ordinary:subject.questions.map(q=>q.id),strict:testRound.questions.map(q=>q.id)};
  });
  expect(result.due).toEqual([true,true]);
  expect(result.ordinary).toHaveLength(8);
  expect(result.ordinary.slice(0,2).sort()).toEqual(['prior-a','prior-b']);
  expect(result.ordinary.slice(2).every(id=>id.startsWith('current-'))).toBe(true);
  expect(result.strict.every(id=>id.startsWith('current-'))).toBe(true);
});
