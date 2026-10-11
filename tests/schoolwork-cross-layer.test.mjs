import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';
import {mergeSchoolwork} from '../scripts/integrate-schoolwork.mjs';
import {mergeLearningHistory} from '../scripts/learning-history.mjs';

// Deliberately synthetic evidence: no actual learner observations or photos.
const digest='a'.repeat(64);
const held=()=>({
  schemaVersion:1,uploadedPhotoCount:1,
  sourceManifest:[{id:'worksheet.jpeg',sha256:digest,status:'held',reason:'Review pending.'}],
  lessons:[]
});
const reviewed=()=>({
  schemaVersion:1,uploadedPhotoCount:1,
  sourceManifest:[{id:'worksheet.jpeg',sha256:digest,status:'integrated'}],
  lessons:[{
    id:'addition-facts',title:'Addition facts',subject:'Math',
    sources:['worksheet.jpeg'],skills:['addition-facts'],
    notes:['Two plus five is seven.'],studiedOn:null,addedOn:'2026-10-10',
    dateStatus:'Undated schoolwork',
    questions:[{
      id:'original-addition-1',subject:'Math',skill:'addition-facts',
      prompt:'What is two plus five?',answer:'Seven',choices:['Seven','Eight'],
      explanation:'Two and five make seven.',sourceFact:'Addition facts',
      provenance:'original-practice-from-uploaded-schoolwork'
    }]
  }]
});
const observation=(id,sourceId)=>({
  id,sourceId,assignmentId:'math-facts-sheet',questionId:'1',
  subject:'Math',skill:'addition-facts',
  studiedOn:'2026-10-07',addedOn:'2026-10-10',
  result:'correct',errorType:'unknown',independence:'independent'
});
const privateBatch=(observations,id)=>({
  schemaVersion:1,intakeId:id,asOf:'2026-10-10',observations
});

test('held evidence stays unpublished until the same digest is reviewed',()=>{
  const pending=held();
  assert.deepEqual(validateSchoolwork(pending,{requireManifest:true}),
    {lessons:0,questions:0,photos:1});
  const prohibited=reviewed();
  prohibited.sourceManifest[0].status='held';
  prohibited.sourceManifest[0].reason='Review pending.';
  assert.throws(()=>validateSchoolwork(prohibited,{requireManifest:true}),
    /held source cannot support published lessons/);
  assert.throws(()=>mergeSchoolwork(pending,prohibited),
    /held source cannot support published lessons/);
  const accepted=mergeSchoolwork(pending,reviewed());
  assert.equal(accepted.sourceManifest[0].status,'integrated');
  assert.deepEqual(validateSchoolwork(accepted,{requireManifest:true}),
    {lessons:1,questions:1,photos:1});
});

test('rephotographed public provenance does not create independent private mastery',()=>{
  const first=mergeSchoolwork(held(),reviewed());
  const publicBatch=reviewed();
  publicBatch.sourceManifest.push({
    id:'rephoto.jpeg',sha256:'b'.repeat(64),status:'duplicate',
    duplicateOf:'worksheet.jpeg',reason:'Reviewed picture of the same worksheet.'
  });
  publicBatch.uploadedPhotoCount=2;
  publicBatch.lessons[0].sources.push('rephoto.jpeg');
  const merged=mergeSchoolwork(first,publicBatch);
  assert.deepEqual(validateSchoolwork(merged,{requireManifest:true}),
    {lessons:1,questions:1,photos:2});
  assert.deepEqual(merged.lessons[0].sources,['worksheet.jpeg','rephoto.jpeg']);
  assert.deepEqual(mergeSchoolwork(merged,publicBatch),merged);

  const privateOriginal=mergeLearningHistory(null,privateBatch([
    observation('original','worksheet.jpeg')
  ],'first-reviewed-batch'));
  assert.equal(privateOriginal.skills[0].status,'not-enough-evidence');
  assert.throws(()=>mergeLearningHistory(privateOriginal,privateBatch([
    observation('rephoto','rephoto.jpeg')
  ],'second-reviewed-batch')),/Repeated assessment item/);
  assert.equal(privateOriginal.observations.length,1);
  // Private correctness never enters the published educational pack.
  assert.equal(JSON.stringify(merged).includes('first-reviewed-batch'),false);
  assert.equal(JSON.stringify(merged).includes('independence'),false);
});

const reorderedObjectFields=value=>Array.isArray(value)
  ?value.map(reorderedObjectFields)
  :value&&typeof value==='object'
    ?Object.fromEntries(Object.entries(value).reverse()
      .map(([key,item])=>[key,reorderedObjectFields(item)]))
    :value;

test('reserialized reviewed evidence preserves public provenance and private slipping status',()=>{
  const approved=mergeSchoolwork(held(),reviewed());
  const replayed=mergeSchoolwork(approved,reorderedObjectFields(reviewed()));
  assert.deepEqual(replayed,approved);
  assert.deepEqual(validateSchoolwork(replayed,{requireManifest:true}),
    {lessons:1,questions:1,photos:1});

  const dated=['correct','correct','partial','partial'].map((result,index)=>({
    id:'assessment-'+index,sourceId:'photo-'+index+'.jpeg',
    assignmentId:'math-facts-sheet-'+index,questionId:'1',
    subject:'Math',skill:'addition-facts',
    studiedOn:'2026-10-0'+(index+1),addedOn:'2026-10-10',
    result,errorType:result==='correct'?'unknown':'procedure-error',
    independence:'independent'
  }));
  const history=mergeLearningHistory(null,privateBatch(dated,'first-private-review'));
  assert.equal(history.skills[0].trend,'slipping');
  assert.equal(history.skills[0].status,'learning');
  const privateReplay=mergeLearningHistory(history,
    privateBatch(dated.map(reorderedObjectFields),'same-facts-new-object-order'));
  assert.deepEqual(privateReplay,history);
  const changedPublic=reorderedObjectFields(reviewed());
  changedPublic.lessons[0].questions[0].answer='Eight';
  assert.throws(()=>mergeSchoolwork(approved,changedPublic),/Lesson ID collision/);
  const changedPrivate={...dated[0],result:'incorrect'};
  assert.throws(()=>mergeLearningHistory(history,
    privateBatch([changedPrivate],'conflicting-private-evidence')),/Observation ID collision/);
  // No private responses, trends or assessment status can flow to the public pack.
  assert.equal(JSON.stringify(replayed).includes('slipping'),false);
  assert.equal(JSON.stringify(replayed).includes('procedure-error'),false);
  assert.equal(JSON.stringify(replayed).includes('first-private-review'),false);
});
