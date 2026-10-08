import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildStudyUniverse} from '../scripts/build-study-universe.mjs';
import {buildStarBank} from '../pages/star-practice.mjs';
const lineage={quality:'page-exact',sourceUrl:'https://sites.google.com/view/abvmgr2/tests',sourceCaptureHash:'a'.repeat(64),evidenceExcerptHash:'sha256:'+ 'b'.repeat(64)};
const q=(id,subject='Math',skill='math-subtraction',extra={})=>({id,subject,skill,prompt:`Prompt ${id}?`,choices:['Right','Wrong'],answer:'Right',explanation:'Checked explanation.',sourceFact:'Reviewed skill',sourceLineage:lineage,...extra});
function fixture(){return {pack:{sourceSufficient:true,sourceHash:'reviewed-source',generatedAt:'2026-10-08T04:00:00Z',weekLabel:'Week of October 5, 2026',contentPipeline:{qa:{status:'pass'},questions:[q('m1'),q('r1','Reading / ELA','subject-predicate')]},importantDates:[{date:'Friday, Oct. 9',label:'Grammar (subject & predicate)',kind:'test'},{date:'Thursday, Oct. 15',label:'Math (subtraction)',kind:'test'},{date:'Friday, Oct. 16',label:'Religion Ch. 3',kind:'test'}]},archive:{sources:{s:{sourceHash:'reviewed-old'}},questions:[q('m-old','Math','addition',{provenance:[{sourceRef:'s',capturedAt:'2026-10-01'}]})]},fallbackQuestions:buildStarBank()};}
const real=()=>({pack:JSON.parse(fs.readFileSync(new URL('../pages/data/study-pack.json',import.meta.url))),archive:JSON.parse(fs.readFileSync(new URL('../pages/data/study-archive.json',import.meta.url))),schoolwork:JSON.parse(fs.readFileSync(new URL('../pages/data/schoolwork.json',import.meta.url))),fallbackQuestions:buildStarBank()});
test('all practice surfaces preserve complete current → archive → STAR pools',()=>{
  const out=buildStudyUniverse(fixture());
  const map=new Map(out.questions.map(q=>[q.id,q]));
  for(const ids of [out.mixedReview,...Object.values(out.currentSubjectPractice),...out.curriculumPackets.map(p=>p.questionIds)]){
    const tiers=ids.map(id=>['current','archive','star-fallback'].indexOf(map.get(id).tier));
    assert.deepEqual(tiers,[...tiers].sort((a,b)=>a-b));assert.equal(new Set(ids).size,ids.length);
  }
  assert.equal(out.mixedReview.length,out.questions.length);
});
test('test scope distinguishes grammar, operations, chapters and unsupported tests',()=>{
  const f=fixture();f.pack.contentPipeline.questions.push(q('religion-other','Religion','religion-gifts-choices'),q('ch2','Religion','religion-chapter-2'),q('ch3','Religion','religion-chapter-3'));
  const out=buildStudyUniverse(f);const get=label=>out.selectableTestPrep.find(t=>t.label===label);
  assert.deepEqual(get('Grammar (subject & predicate)').questionIds,['r1']);
  assert.deepEqual(get('Math (subtraction)').questionIds,['m1']);
  assert.deepEqual(get('Religion Ch. 3').questionIds,['ch3']);
  f.pack.contentPipeline.questions=f.pack.contentPipeline.questions.filter(q=>q.id!=='ch3');
  assert.equal(buildStudyUniverse(f).selectableTestPrep.find(t=>t.label==='Religion Ch. 3').supported,false);
});
test('malformed answers, duplicate normalized choices, object coercion and numeric metadata fail closed',()=>{
  for(const change of [{answer:'Missing'},{choices:['Right',' Right ']},{prompt:{privateHistory:'secret'}},{difficulty:{secret:1}},{dok:0},{choices:['Right',false]}]){
    const f=fixture();Object.assign(f.pack.contentPipeline.questions[0],change);assert.throws(()=>buildStudyUniverse(f));
  }
});
test('capitalization choices remain distinct educational content',()=>{
  const f=fixture();Object.assign(f.pack.contentPipeline.questions[0],{choices:['Emma cheers.','emma cheers.'],answer:'Emma cheers.'});
  assert.equal(buildStudyUniverse(f).questions.find(q=>q.id==='m1').choices.length,2);
});
test('QA, exact lineage and archive provenance are required',()=>{
  for(const mutate of [f=>f.pack.contentPipeline.qa.status='fail',f=>f.pack.sourceSufficient='true',f=>delete f.pack.contentPipeline.questions[0].sourceLineage,f=>delete f.archive.sources.s]){const f=fixture();mutate(f);assert.throws(()=>buildStudyUniverse(f));}
});
test('stable IDs cannot overwrite an earlier key or ambiguous prompt',()=>{
  const f=fixture();f.pack.contentPipeline.questions.push(q('m1','Math','math-subtraction',{answer:'Wrong'}));assert.throws(()=>buildStudyUniverse(f),/Conflicting/);
  const g=fixture();g.pack.contentPipeline.questions.push(q('m2','Math','math-subtraction',{prompt:'Prompt m1?',answer:'Wrong'}));assert.throws(()=>buildStudyUniverse(g),/Conflicting/);
});
test('private fields fail at question boundary and unrelated pack data never exports',()=>{
  const f=fixture();f.pack.privateHistory='SECRET_HISTORY';f.pack.studentName='SECRET_NAME';f.archive.sources.s.privateHistory='SECRET_REASON';
  const q=f.pack.contentPipeline.questions[0];q.ignoredMetadata={privateHistory:'SECRET_HISTORY'};
  assert.throws(()=>buildStudyUniverse(f),/Private field/);delete q.ignoredMetadata;
  assert.doesNotMatch(JSON.stringify(buildStudyUniverse(f)),/SECRET_/);
});
test('output is byte deterministic across input permutations, without current wall clock',()=>{
  const f=fixture(),a=JSON.stringify(buildStudyUniverse(f));
  f.pack.contentPipeline.questions.reverse();f.archive.questions.reverse();f.fallbackQuestions.reverse();f.pack.importantDates.reverse();
  assert.equal(JSON.stringify(buildStudyUniverse(f)),a);
  delete f.pack.generatedAt;assert.throws(()=>buildStudyUniverse(f),/generatedAt/);
});
test('school date uses New York midnight and rejects rolled calendar days',()=>{
  const f=fixture();f.pack.generatedAt='2026-10-08T00:00:00Z';
  f.pack.importantDates.push({date:'Wednesday, Oct. 7',kind:'test',label:'Math'}, {date:'Friday, Feb. 31',kind:'test',label:'Invalid'});
  const out=buildStudyUniverse(f);assert.ok(out.selectableTestPrep.some(t=>t.date==='2026-10-07'));assert.ok(!out.selectableTestPrep.some(t=>t.label==='Invalid'));
});
test('no-current subject and empty-current pack can use cumulative reviewed material',()=>{
  const f=fixture();f.pack.contentPipeline.questions=[];
  assert.ok(buildStudyUniverse(f).currentSubjectPractice.Math.includes('m-old'));
});
test('real reviewed pack, archive, original worksheet practice and STAR are compatible',()=>{
  const input=real(),out=buildStudyUniverse(input);assert.ok(out.questions.length>200);
  assert.ok(out.questions.some(q=>q.provenance.kind==='reviewed-original-schoolwork'));
  const undated=new Set(input.schoolwork.lessons.filter(l=>!l.studiedOn).map(l=>l.id));
  assert.ok(out.questions.filter(q=>undated.has(q.provenance.lessonId)).every(q=>q.tier==='archive'),'Undated worksheets stay cumulative');
  const byId=new Map(out.questions.map(q=>[q.id,q]));
  for(const t of out.selectableTestPrep){
    assert.equal(t.supported,t.questionIds.length>0);
    if(t.label==='Math (subtraction)')assert.ok(t.questionIds.every(id=>byId.get(id).skill.includes('subtraction')));
    if(t.label==='Religion Ch. 3')assert.ok(t.questionIds.every(id=>byId.get(id).skill==='religion-chapter-3'));
  }
  assert.doesNotMatch(JSON.stringify(out),/IMG_\d+|learnerResponse|teacherMark|studentName|privateHistory/);
  assert.equal(JSON.stringify(buildStudyUniverse(real())),JSON.stringify(out));
});

test('conflicting keys remain case-sensitive for capitalization practice',()=>{
  const f=fixture();Object.assign(f.pack.contentPipeline.questions[0],{choices:['Emma cheers.','emma cheers.'],answer:'Emma cheers.'});
  f.pack.contentPipeline.questions.push({...f.pack.contentPipeline.questions[0],id:'different-id',answer:'emma cheers.'});
  assert.throws(()=>buildStudyUniverse(f),/Conflicting answer/);
});
test('duplicate equivalent IDs have deterministic output despite reordered choices',()=>{
  const f=fixture();f.pack.contentPipeline.questions.push({...f.pack.contentPipeline.questions[0],choices:['Wrong','Right']});
  const a=JSON.stringify(buildStudyUniverse(f));f.pack.contentPipeline.questions.reverse();
  assert.equal(JSON.stringify(buildStudyUniverse(f)),a);
});
test('calendar advancement and newly reviewed chapter coverage do not freeze refreshes',()=>{
  const f=fixture();f.pack.generatedAt='2026-10-18T12:00:00Z';assert.deepEqual(buildStudyUniverse(f).selectableTestPrep,[]);
  f.pack.importantDates=[{date:'2026-10-20',label:'Religion Ch. 3',kind:'test'}];
  f.pack.contentPipeline.questions.push(q('new-ch3','Religion','religion-chapter-3'));
  assert.deepEqual(buildStudyUniverse(f).selectableTestPrep[0].questionIds,['new-ch3']);
});
