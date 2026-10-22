import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';

const envelope=JSON.parse(readFileSync(new URL('./fixtures/verified-grade2-teaching-source.json',import.meta.url),'utf8'));
const pack=()=>structuredClone(envelope.pack);
const sourcePagesFor=p=>envelope.sourcePages.map(page=>page.title==='Reading Work'?{
  ...page,
  lines:[
    ...p.subjects.find(row=>row.subject==='Reading / ELA').topics.map(line=>line.replace(/^Vocabulary:/i,'Vocab Words:')),
    ...p.subjects.find(row=>row.subject==='Reading / ELA').studyNotes,
  ],
}:page);
const generate=p=>buildGrade2ContentPipeline(p,{
  sourceHash:p.sourceHash,
  sourcePages:sourcePagesFor(p),
  requirePageExactLineage:false,
});
const supplements=p=>p.questions.filter(q=>q.skill==='vocabulary-in-context');

test('verified source-fixture words all receive original Grade 2 definitions without false teacher attribution',()=>{
  const p=pack(),result=generate(p),terms=p.vocabulary.map(row=>row.term);
  const rows=supplements(result);
  assert.equal(rows.length,terms.length);
  assert.equal(new Set(rows.map(row=>row.prompt.match(/“([^”]+)”/)?.[1])).size,terms.length);
  assert.ok(rows.every(row=>row.sourceMode==='CURATED_CONTEXT'&&row.supportType==='original-grade2-vocabulary-teaching'));
  assert.ok(rows.every(row=>row.sourceLineage?.quality==='page-exact'&&row.sourceLineage?.sourceTitle==='Reading Work'));
  assert.ok(rows.every(row=>row.explanation.includes('Original ABVM teaching explanation')));
  assert.ok(rows.every(row=>row.evidenceContract.doesNotClaim.includes('teacher-provided-definitions')));
  assert.ok(result.skills.some(skill=>skill.id==='vocabulary-in-context'&&skill.studyNotes.some(note=>note.includes('Original ABVM teaching explanations'))));
  assert.ok(result.coverage.some(row=>row.topic==='Reading / ELA vocabulary definitions'&&row.status==='COVERED'&&row.supplementalTerms?.length===terms.length));
  assert.equal(result.coverage.some(row=>row.topic==='Reading / ELA vocabulary definitions'&&row.status==='SOURCE_INSUFFICIENT'),false);
  assert.equal(validateGrade2ContentPipeline(result).length,0);
  assert.deepEqual(p.vocabulary.map(row=>row.meaning),pack().vocabulary.map(row=>row.meaning),'original teaching must not rewrite official teacher fields');
});

test('original meanings withdraw if official current vocabulary topic is absent',()=>{
  const p=pack();
  const reading=p.subjects.find(row=>row.subject==='Reading / ELA');
  reading.topics=reading.topics.filter(row=>!/^Vocabulary:/i.test(row));
  const result=generate(p);
  assert.equal(supplements(result).length,0);
  assert.equal(result.coverage.some(row=>row.topic==='Reading / ELA vocabulary definitions'&&row.status==='COVERED'),false);
});

test('unknown teacher term remains a real gap instead of receiving an invented definition',()=>{
  const p=pack();
  p.vocabulary=[{subject:'Reading / ELA',term:'flibber',meaning:'Current Reading Work vocabulary word; the teacher page does not provide a definition.'}];
  p.subjects.find(row=>row.subject==='Reading / ELA').topics=p.subjects.find(row=>row.subject==='Reading / ELA').topics.map(row=>
    /^Vocabulary:/i.test(row)?'Vocabulary: flibber':row);
  const result=generate(p);
  assert.equal(supplements(result).length,0);
  assert.ok(result.coverage.some(row=>row.topic==='Reading / ELA vocabulary definitions'&&row.status==='SOURCE_INSUFFICIENT'&&row.uncovered?.includes('flibber')));
});

test('explicit teacher meaning always beats supplemental meaning for the same verified word',()=>{
  const p=pack();
  p.vocabulary.find(row=>row.term==='checks').meaning='looks closely to make sure something is correct';
  const result=generate(p);
  const checks=supplements(result).find(row=>row.prompt.includes('“checks”'));
  assert.ok(checks);
  assert.equal(checks.answer,'looks closely to make sure something is correct');
  assert.equal(checks.sourceMode,'STRICT_SOURCE');
  assert.equal(checks.supportType,'explicit');
  assert.match(checks.explanation,/verified teacher/i);
  assert.ok(supplements(result).some(row=>row.sourceMode==='CURATED_CONTEXT'));
});


test('fresh production source never receives supplemental word meanings after topic withdrawal',()=>{
  const liveEnvelope=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
  const live=structuredClone(liveEnvelope.pack);
  const result=buildGrade2ContentPipeline(live,{sourceHash:live.sourceHash,sourcePages:liveEnvelope.sourcePages,requirePageExactLineage:false});
  const supplemental=result.questions.filter(row=>row.skill==='vocabulary-in-context'&&row.supportType==='original-grade2-vocabulary-teaching');
  const topic=live.subjects.find(row=>row.subject==='Reading / ELA')?.topics?.find(row=>/^Vocabulary:/i.test(row));
  if(!topic||!live.vocabulary?.length){
    assert.equal(supplemental.length,0,'removed vocabulary must not leave stale meanings');
  }else{
    const teacherTerms=topic.split(':').slice(1).join(':').split(',').map(word=>word.trim().toLowerCase());
    assert.ok(supplemental.every(row=>teacherTerms.some(term=>row.prompt.includes('“'+term+'”'))));
  }
  assert.ok(supplemental.every(row=>row.evidenceContract.doesNotClaim.includes('teacher-provided-definitions')));
});
