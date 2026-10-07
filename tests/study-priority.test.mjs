import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createStudyMaterials} from '../pages/study-materials.mjs';

const now=()=>new Date('2026-10-07T16:00:00Z');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
function engine(){const window={};const context=vm.createContext({window,console,Intl,Date,localStorage:storage()});vm.runInContext(readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8'),context);return window.ABVMStudyGames;}
const q=(id,tier)=>({id,subject:'Math',skill:'addition-within-100',prompt:'Find the total for '+id,choices:['10','20','30'],answer:'20',tier,explanation:'Reviewed explanation.',hint:'Add the numbers.',difficulty:2,questionType:'direct',provenance:'reviewed-fixture'});

test('the default subject round exhausts current then recent then cumulative before STAR',()=>{
  const current=[q('current-a','material'),q('current-b','material')];
  const recent=[q('recent-a','recent-review'),q('recent-b','recent-review')];
  const star=[q('star-a','star-fallback'),q('star-b','star-fallback')];
  const saved=[q('saved-a','material'),q('saved-b',undefined)].map(row=>({...row,firstSeenAt:'2026-09-21T12:00:00Z',provenance:[{sourceId:'reviewed-source',capturedAt:'2026-09-21T12:00:00Z'}]}));
  const future={...q('future','material'),firstSeenAt:'2026-10-08T12:00:00Z'};
  const before=structuredClone(saved);
  const model=createStudyMaterials({now,storage:storage(),engine:engine(),catalog:{sourceKey:'canonical',questions:[...current,...recent,...star]},archive:{questions:[...saved,future],notes:[],vocabulary:[]}});
  const scope=model.forMode('math'),round=model.round('math',{seed:'priority-proof'});
  assert.equal(scope.count,8);
  assert(!scope.eligibleIds.includes('future'));
  assert.deepEqual(Array.from(round.questions,row=>row.id.split('-')[0]),['current','current','recent','recent','saved','saved','star','star']);
  assert.deepEqual(saved,before,'routing leaves source question tiers and provenance untouched');
  assert.equal(round.catalog.questions.find(row=>row.id==='saved-b').tier,undefined);
});

test('upcoming test selection includes later assessments with honest unsupported coverage',()=>{
  const events=[{date:'2026-10-07',label:'Math test'},{date:'2026-10-09',label:'District benchmark assessment',kind:'assessment'},{date:'2026-10-12',label:'Science test'},{date:'2026-10-06',label:'Past test'}];
  const model=createStudyMaterials({now,storage:storage(),catalog:{sourceKey:'canonical',questions:[q('current','material')]},events});
  assert.deepEqual(model.upcomingTests().tests.map(row=>row.label),['Math test','District benchmark assessment','Science test']);
  assert(model.upcomingTests().missing.some(row=>row.label==='District benchmark assessment'));
  assert.deepEqual(model.testRound({upcoming:true,index:1}).questions,[],'an assessment never borrows unrelated subject questions');
  assert.deepEqual(model.printableTests().tests.map(row=>row.label),['Math test','Science test'],'printable-guide indexes retain their separate verified-test authority');
});

test('same-tier diversity can revisit an alternate representation without semantic duplicates',()=>{
  const e=engine();
  const rows=[...['a1','a2','a3'].map(id=>({...q(id,'material'),subject:'Reading / ELA',skill:'theme',variantFingerprint:id})),{...q('b1','material'),subject:'Reading / ELA',skill:'visualize',questionType:'transfer',variantFingerprint:'visual-clue'},{...q('b-shadow','material'),subject:'Reading / ELA',skill:'visualize',questionType:'transfer',variantFingerprint:'visual-clue'}];
  const before=structuredClone(rows),catalog={sourceKey:'diversity-source',questions:rows};
  e.markQuestionShown(rows[3],catalog.sourceKey);
  const chosen=e.selectQuestions(catalog,{count:3,seed:'diversity-relax'});
  assert.equal(chosen.length,3);
  assert(chosen.some(row=>row.skill==='visualize'),'a same-source alternate prevents a repetitive three-question run');
  assert.equal(new Set(Array.from(chosen,row=>row.variantFingerprint)).size,3);
  for(let i=1;i<chosen.length;i++)assert.notEqual(chosen[i].skill,chosen[i-1].skill);
  assert.deepEqual(rows,before,'cooldown selection never rewrites source content');
});

test('diversity never borrows older review or STAR before the current source is exhausted',()=>{
  const e=engine();
  const current=['a1','a2','a3'].map(id=>({...q(id,'material'),subject:'Reading / ELA',skill:'theme',variantFingerprint:id}));
  const older={...q('older','recent-review'),subject:'Reading / ELA',skill:'visualize',questionType:'transfer',variantFingerprint:'older'};
  const fallback={...q('star','star-fallback'),subject:'Reading / ELA',skill:'inference',questionType:'reasoning',variantFingerprint:'star'};
  const chosen=e.selectQuestions({sourceKey:'source-boundary',questions:[...current,older,fallback]},{count:3,seed:'source-boundary'});
  assert.equal(chosen.length,3);
  assert(chosen.every(row=>row.tier==='material'),'source priority takes precedence over visual variety');
});


test('test preview reads exact governed topics and the matching practice record without writing a session',()=>{
  const data=new Map(),writes=[];
  const saved={getItem:k=>data.get(k)||null,setItem:(k,v)=>{writes.push(k);data.set(k,v)}};
  const rows=Array.from({length:8},(_,i)=>q('addition-'+i,'material'));
  const before=structuredClone(rows);
  const pack={contentPipeline:{skills:[{id:'addition-within-100',label:'Addition'},{id:'theme',label:'Theme'}]}};
  const events=[{date:'2026-10-08',label:'Math test'},{date:'2026-10-09',label:'District benchmark assessment',kind:'assessment'}];
  const make=sourceKey=>createStudyMaterials({now,storage:saved,pack,catalog:{sourceKey,questions:rows},events});
  const model=make('verified-bank'),first=model.testPreview(0);
  assert.deepEqual(first.topics,['Addition'],'labels come only from skills actually matched to this test');
  assert.equal(first.total,8);
  assert.equal(first.practice.label,'First practice');
  assert.deepEqual(writes,[],'merely displaying Test Prep creates no session or local record');
  const round=model.testRound({upcoming:true,index:0,seed:'explicit-proof'});
  assert.equal(first.sourceKey,round.sourceKey,'preview and engine use the exact same test and bank identity');
  data.set('abvm-study-games:'+first.sourceKey+':test-ready',JSON.stringify({plays:2,best:6}));
  assert.equal(model.testPreview(0).practice.label,'Best practice 6 / 8');
  assert.equal(make('different-reviewed-bank').testPreview(0).practice.label,'First practice','practice from another governed bank is not attributed to this test');
  assert.deepEqual(model.testPreview(1).topics,[]);
  assert.equal(model.testPreview(1).total,0);
  assert.equal(model.testPreview(20),null);
  data.set('abvm-study-games:'+first.sourceKey+':test-ready',JSON.stringify({plays:2,best:99}));
  assert.equal(model.testPreview(0).practice.label,'First practice','invalid record never implies readiness');
  assert.deepEqual(writes,[]);
  assert.deepEqual(rows,before,'preview never changes governed question content');
});
