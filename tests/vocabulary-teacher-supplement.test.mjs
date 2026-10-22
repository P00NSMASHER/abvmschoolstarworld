import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {ORIGINAL_GRADE2_VOCABULARY,originalGrade2VocabularyMeaning,teacherVocabularyTerms} from '../pages/grade2-original-vocabulary.mjs';
import {printableStudyGuideHtml,resolveVocabularyMeaning} from '../pages/study-games-materials-view.mjs';

const envelope=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
const pack=()=>structuredClone(envelope.pack);
const supportedPack=()=>{
  const p=pack(),terms=Object.keys(ORIGINAL_GRADE2_VOCABULARY);
  p.vocabulary=terms.map(term=>({
    subject:'Reading / ELA',term,
    meaning:'Current Reading Work vocabulary word; the teacher page does not provide a definition.',
  }));
  const reading=p.subjects.find(row=>row.subject==='Reading / ELA');
  reading.topics=reading.topics.filter(row=>!/^Vocabulary:/i.test(row));
  reading.topics.push('Vocabulary: '+terms.join(', '));
  return p;
};
const sourcePagesFor=p=>envelope.sourcePages.map(page=>page.title==='Reading Work'?{
  ...page,
  lines:[
    ...p.subjects.find(row=>row.subject==='Reading / ELA').topics.map(line=>line.replace(/^Vocabulary:/i,'Vocab Words:')),
    ...p.subjects.find(row=>row.subject==='Reading / ELA').studyNotes,
  ],
}:page);
const generate=p=>buildGrade2ContentPipeline(p,{
  sourceHash:p.sourceHash,sourcePages:sourcePagesFor(p),requirePageExactLineage:false,
});
const supplementalQuestions=p=>p.questions.filter(q=>q.skill==='vocabulary-in-context');

test('teacher-listed words all receive original Grade 2 definitions without false teacher attribution',()=>{
  const p=supportedPack(),result=generate(p),terms=p.vocabulary.map(row=>row.term);
  const rows=supplementalQuestions(result);
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
  assert.ok(p.vocabulary.every(row=>/teacher page does not provide a definition/i.test(row.meaning)),'teacher fields must remain untouched');
});

test('original meanings withdraw when current teacher vocabulary list is removed',()=>{
  const p=pack(),reading=p.subjects.find(row=>row.subject==='Reading / ELA');
  reading.topics=reading.topics.filter(row=>!/^Vocabulary:/i.test(row));
  const result=generate(p);
  assert.equal(supplementalQuestions(result).length,0);
  assert.equal(result.coverage.some(row=>row.topic==='Reading / ELA vocabulary definitions'&&row.status==='COVERED'),false);
});

test('unknown teacher word remains an evidence gap rather than an invented explanation',()=>{
  const p=pack();
  p.vocabulary=[{subject:'Reading / ELA',term:'flibber',meaning:'Current Reading Work vocabulary word; the teacher page does not provide a definition.'}];
  p.subjects.find(row=>row.subject==='Reading / ELA').topics=p.subjects.find(row=>row.subject==='Reading / ELA').topics.map(row=>
    /^Vocabulary:/i.test(row)?'Vocabulary: flibber':row);
  const result=generate(p);
  assert.equal(supplementalQuestions(result).length,0);
  assert.ok(result.coverage.some(row=>row.topic==='Reading / ELA vocabulary definitions'&&row.status==='SOURCE_INSUFFICIENT'&&row.uncovered?.includes('flibber')));
});

test('a verified teacher meaning overrides the independent explanation',()=>{
  const p=supportedPack(),official='looks closely to make sure something is correct';
  p.vocabulary.find(row=>row.term==='checks').meaning=official;
  const result=generate(p);
  const checks=supplementalQuestions(result).find(row=>row.prompt.includes('“checks”'));
  assert.ok(checks);
  assert.equal(checks.answer,official);
  assert.equal(checks.sourceMode,'CURATED_CONTEXT','original distractors must not be misrepresented as teacher material');
  assert.equal(checks.supportType,'teacher-meaning-with-original-choices');
  assert.match(checks.explanation,/verified teacher/i);
  assert.ok(supplementalQuestions(result).some(row=>row.supportType==='original-grade2-vocabulary-teaching'));
});

test('printable guides and Notes use the same original meanings with visible provenance',()=>{
  const placeholder='Current Reading Work vocabulary word; the teacher page does not provide a definition.';
  assert.equal(resolveVocabularyMeaning({term:'checks',meaning:placeholder}),originalGrade2VocabularyMeaning('checks'));
  assert.equal(originalGrade2VocabularyMeaning('nonexistent-word'),'');
  const html=printableStudyGuideHtml({
    label:'Reading',date:'2026-10-23',subject:'Reading / ELA',
    vocabulary:[{term:'checks',meaning:placeholder},{term:'choose',meaning:placeholder}],
    practice:[],facts:[],sourceLabel:'Verified Reading Work vocabulary words',
  });
  assert.match(html,/looks at something carefully to make sure it is correct/);
  assert.match(html,/Original study explanation — not supplied by the teacher/);
  assert.doesNotMatch(html,/the teacher page does not provide a definition/);
  assert.equal((html.match(/Original study explanation — not supplied by the teacher/g)||[]).length,2);
});

test('reviewed vocabulary punctuation interpretation is narrow and leaves unknown phrases untouched',()=>{
 assert.deepEqual(teacherVocabularyTerms('adult, groom. mammal, offspring'),['adult','groom','mammal','offspring']);
 assert.deepEqual(teacherVocabularyTerms('Dr. Smith, unknown. phrase'),['Dr. Smith','unknown. phrase']);
 assert.deepEqual(teacherVocabularyTerms('groom, mammal'),['groom','mammal']);
});

test('original teaching changes trigger fresh candidate and production teacher checks with retained public candidate evidence',()=>{
 for(const name of ['teacher-refresh-candidate.yml','sync-study-pack.yml']){
  const workflow=readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
  assert.ok(workflow.includes("- 'pages/grade2-original-vocabulary.mjs'"));
 }
 const workflow=readFileSync(new URL('../.github/workflows/teacher-refresh-candidate.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('sha256sum pages/data/study-pack.json > candidate-sha256.txt'));
 assert.ok(workflow.includes('            pages/data/study-pack.json'));
 assert.ok(workflow.includes('            candidate-commit.txt'));
});
