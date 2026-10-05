import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolDay,weekBounds,nextTests,balancedRound,balancedTestRound,visibleArchive,weeklyArchive} from '../pages/study-model.mjs';
import {mergeStudyPack} from '../scripts/build-study-archive.mjs';
test('New York calendar honors midnight and both DST changes',()=>{
  assert.equal(schoolDay('2026-03-08T04:59:00Z'),'2026-03-07');
  assert.equal(schoolDay('2026-03-08T07:01:00Z'),'2026-03-08');
  assert.equal(schoolDay('2026-11-01T05:30:00Z'),'2026-11-01');
  assert.equal(schoolDay('2026-11-01T06:30:00Z'),'2026-11-01');
  assert.deepEqual(weekBounds('2026-11-01T06:30:00Z'),{start:'2026-10-26',end:'2026-11-01'});
  assert.deepEqual(weekBounds('2026-03-09T04:01:00Z'),{start:'2026-03-09',end:'2026-03-15'});
});
test('nearest date covers all tests and precise ends roll immediately',()=>{
 const events=[{date:'2026-10-09',label:'Grammar'},{date:'2026-10-09',label:'Spelling'},{date:'2026-10-12',label:'Math'}];
 assert.equal(nextTests(events,'2026-10-09T20:00:00Z').length,2);
 assert.equal(nextTests(events,'2026-10-10T04:00:00Z')[0].label,'Math');
 assert.equal(nextTests(events.map(e=>({...e,endsAt:e.date==='2026-10-09'?'2026-10-09T15:00:00Z':undefined})),'2026-10-09T15:00:00Z')[0].label,'Math');
 assert.deepEqual(nextTests([]),[]);
});
test('sampling is deterministic, equal and without duplicates',()=>{
 const a=Array.from({length:10},(_,i)=>({id:`a${i}`,subject:'A'}));const b=Array.from({length:10},(_,i)=>({id:`b${i}`,subject:'B'}));
 const result=balancedRound([a,b],8,19);
 assert.deepEqual(result,balancedRound([a,b],8,19));assert.equal(result.filter(x=>x.subject==='A').length,4);
 assert.equal(new Set(result.map(x=>x.id)).size,8);
 assert.equal(balancedRound([a,a,[]],99).length,10);assert.deepEqual(balancedRound([],10),[]);
 assert.deepEqual(balancedRound([a],0),[]);
});
test('archive deduplicates semantic content, retains history and excludes unreviewed questions',()=>{
 const a={notes:[],vocabulary:[],questions:[]};
 const p={sourceCapturedAt:'2026-09-01T12:00:00Z',sourceHash:'one',subjects:[{subject:'Math',studyNotes:['Add numbers.']}],vocabulary:[{subject:'Math',term:'Sum',meaning:'Total'}],contentPipeline:{qa:{status:'pass'},questions:[{id:'q1',subject:'Math',prompt:'1 + 1?',answer:'2',choices:['2','3']}]}};
 mergeStudyPack(a,p);mergeStudyPack(a,{...p,sourceCapturedAt:'2026-10-06T12:00:00Z',sourceHash:'two'});
 assert.equal(a.notes.length,1);assert.equal(a.questions.length,1);assert.equal(a.vocabulary.length,1);assert.equal(a.notes[0].provenance.length,2);
 assert.equal(visibleArchive(a,'2026-08-30').notes.length,0);assert.equal(visibleArchive(a,'2026-10-05').notes.length,1);
 assert.equal(weeklyArchive(a,'2026-10-05').notes.length,0);assert.equal(weeklyArchive(a,'2026-10-06').notes.length,1);
 mergeStudyPack(a,{...p,contentPipeline:{qa:{status:'fail'},questions:[{prompt:'bad',answer:'2',choices:['2','3']}]}});assert.equal(a.questions.length,1);
});

test('test rounds preserve exact equal coverage when a bank is short or overlaps',()=>{
 const a=[{id:'shared'}, {id:'a1'},{id:'a2'}], b=[{id:'shared'}];
 const out=balancedTestRound([a,b],12,3);
 assert.equal(out.length,2);assert.notEqual(out[0].id,'shared');assert.equal(out[1].id,'shared');
 assert.equal(new Set(out.map(x=>x.id)).size,2);
 assert.deepEqual(balancedTestRound([a,[]],12),[]);
 assert.deepEqual(balancedTestRound([b,b],12),[]);
 assert.equal(balancedTestRound([a,[{id:'b1'},{id:'b2'}]],5).length,4);
 assert.deepEqual(out,balancedTestRound([a,b],12,3));
});

test('archive keeps rich question content and week coverage while compacting polling provenance',()=>{
 const a={notes:[],vocabulary:[],questions:[]};
 const richContent={type:'passage',text:'A robin builds a nest.'};
 const base={sourceHash:'stable',subjects:[{subject:'Reading',studyNotes:['Notice details.']}],contentPipeline:{qa:{status:'pass'},questions:[{id:'rich',subject:'Reading',prompt:'Who builds a nest?',choices:['A robin','A fox'],answer:'A robin',richContent,explanation:'The passage names a robin.',rubric:{large:'validation artifact'}}]}};
 for(const at of ['2026-09-28T13:00:00Z','2026-09-29T13:00:00Z','2026-09-30T13:00:00Z','2026-10-01T13:00:00Z','2026-10-05T13:00:00Z'])mergeStudyPack(a,{...base,sourceCapturedAt:at});
 assert.deepEqual(a.questions[0].richContent,richContent);assert.equal(a.questions[0].rubric,undefined);
 assert.equal(a.notes[0].provenance.length,3);assert.equal(Object.keys(a.sources).length,1);
 assert.equal(weeklyArchive(a,'2026-09-29').questions.length,1);assert.equal(weeklyArchive(a,'2026-10-05').questions.length,1);
 assert.equal(a.sources[a.notes[0].provenance[0].sourceRef].sourceHash,'stable');
});
