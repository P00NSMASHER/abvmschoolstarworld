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
