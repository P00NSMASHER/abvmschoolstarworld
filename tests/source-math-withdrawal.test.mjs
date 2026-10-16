import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {withOriginalMathFixture} from './helpers/original-math-fixture.mjs';

test('withdrawn current Math stays absent; ordinary practice falls back and strict test prep fails closed',()=>{
 const source=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
 source.pack.subjects=source.pack.subjects.map(row=>row.subject==='Math'?{...row,topics:[],studyNotes:[]}:row);
 for(const key of ['contentPipeline','recentReviewPipeline'])if(source.pack[key]){
  for(const field of ['skills','questions'])source.pack[key][field]=(source.pack[key][field]||[]).filter(row=>row.subject!=='Math');
 }
 const before=JSON.stringify(source),window={},localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 vm.runInNewContext(readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8'),{window,Intl,Date,localStorage,console});
 const engine=window.ABVMStudyGames;
 const catalog=engine.buildCatalog(source.pack,{sourceKey:engine.sourceKeyFromEnvelope(source.pack,source)});
 assert.equal(catalog.questions.filter(q=>q.subject==='Math'&&q.tier==='material').length,0);
 const model=createStudyMaterials({pack:source.pack,catalog,engine,storage:localStorage,now:()=>new Date('2026-10-16T12:00:00Z'),events:[{date:'2026-10-23',label:'Math test'}]});
 const scope=model.forMode('math',{source:'weekly'}),eligible=new Set(scope.eligibleIds);
 assert.ok(scope.count>=8);
 assert.ok(scope.catalog.questions.filter(q=>eligible.has(q.id)).every(q=>q.tier!=='material'));
 assert.equal(model.upcomingTests().missing.length,1);
 assert.equal(model.testRound({seed:1}).questions.length,0);
 const fixture=withOriginalMathFixture(source);
 assert.equal(JSON.stringify(source),before,'interaction fixtures never mutate real source data');
 assert.equal(engine.buildCatalog(fixture.pack,{sourceKey:'isolated-fixture'}).questions.filter(q=>q.subject==='Math'&&q.tier==='material').length,9);
});
