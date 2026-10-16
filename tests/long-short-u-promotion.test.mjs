import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCurriculumFamily,registeredRuntimeMetadata} from '../scripts/curriculum-family-registry.mjs';
import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
const sourcePages=[{title:'Tests',url:'https://sites.google.com/view/abvmgr2/tests',
 checkedAt:'2026-10-16T15:27:09.726Z',contentHash:'3b3888d4e1a9cf81c83a6abb3d9c34248608c67246f8b78eb4a88d668cfb1b4d',
 lines:['Friday Oct. 23: Spelling (long/short u)/Handwriting']}];
const pack=()=>({sourceHash:'teacher-pages-long-short-u',subjects:[{subject:'Spelling / Handwriting',topics:['long / short u'],studyNotes:[]}],vocabulary:[]});

test('the explicitly published long/short-u topic yields a complete original question family',()=>{
 const family=matchCurriculumFamily('Spelling / Handwriting','long / short u');
 assert.ok(family,'missing source-backed long/short-u family');
 assert.equal(family.id,'long-short-u');
 assert.equal(registeredRuntimeMetadata('long-short-u')?.id,'long-short-u');
 const pipeline=buildGrade2ContentPipeline(pack(),{sourceHash:'teacher-pages-long-short-u',generatedAt:sourcePages[0].checkedAt,sourcePages,requirePageExactLineage:true});
 assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
 assert.equal(pipeline.qa.unsupportedSkillCount,0);
 const questions=pipeline.questions.filter(q=>q.skill==='long-short-u');
 assert.equal(questions.length,9);
 assert.deepEqual([...new Set(questions.map(q=>q.questionType))].sort(),['direct','reasoning','transfer']);
 assert.equal(new Set(questions.map(q=>q.prompt)).size,9);
 assert.ok(questions.every(q=>q.sourceLineage.quality==='page-exact'&&q.sourceLineage.sourceTitle==='Tests'));
 assert.ok(questions.every(q=>q.choices.length===3&&q.choices.includes(q.answer)));
 assert.ok(pipeline.skills.find(s=>s.id==='long-short-u').studyNotes.length>=2);
});

test('the long/short-u family cannot enter unrelated subjects or infer an unprinted vowel contrast',()=>{
 assert.equal(matchCurriculumFamily('Religion','long / short u'),null);
 for(const topic of ['long / short o','long u','short u','vowel sounds'])assert.equal(matchCurriculumFamily('Spelling / Handwriting',topic),null,topic);
 const p=pack();p.subjects[0].topics=['long / short u'];
 assert.throws(()=>buildGrade2ContentPipeline(p,{sourcePages:[{...sourcePages[0],lines:['Friday Oct. 23: Spelling (long/short o)/Handwriting']}],requirePageExactLineage:true}),/skill-lineage-unresolved:long-short-u/);
});

test('saved candidate and runtime bank stay identical while automated acceptance remains pending',async()=>{
 const {readFileSync}=await import('node:fs');
 const {curriculumCandidateIntrinsicBlockers,validateCurriculumCandidateManifest}=await import('../scripts/curriculum-coverage-autopilot.mjs');
 const {LONG_SHORT_U_FAMILY:family}=await import('../scripts/curriculum-families/long-short-u.mjs');
 const candidate=JSON.parse(readFileSync(new URL('../curriculum-candidates/curriculum-spelling-handwriting-long-short-u-b5341c4e17.json',import.meta.url),'utf8'));
 assert.deepEqual(candidate.proposedQuestions,[family.baseQuestion,...family.supplementalQuestions]);
 assert.deepEqual(curriculumCandidateIntrinsicBlockers(candidate),[]);
 assert.deepEqual(validateCurriculumCandidateManifest(candidate),[]);
 assert.deepEqual(candidate.readiness.blockers,['automated-qa-required']);
 assert.equal(candidate.readiness.automaticPromotion,false);
});

test('the actual shared-vowel test label selects all u questions for practice and printable guides',async()=>{
 const {questionsForTest}=await import('../pages/study-hub-core.mjs');
 const {createStudyMaterials}=await import('../pages/study-materials.mjs');
 const pipeline=buildGrade2ContentPipeline(pack(),{sourceHash:'teacher-pages-long-short-u',sourcePages,requirePageExactLineage:true});
 const event={date:'2026-10-23',label:'Spelling (long/short u)/Handwriting',kind:'test'};
 const other={...pipeline.questions[0],id:'old-i',skill:'short-i-long-i',sourceFact:'Short i and long i'};
 const rows=[...pipeline.questions,other].map(q=>({...q,tier:'material'}));
 assert.equal(questionsForTest(event,rows).length,9);
 assert.equal(questionsForTest({...event,label:'Spelling (long o / Short )/Handwriting'},rows).length,0);
 const model=createStudyMaterials({pack:{...pack(),weekLabel:'Week of October 19, 2026',contentPipeline:pipeline},events:[event],catalog:{sourceKey:'test-u',questions:rows},now:()=>Date.parse('2026-10-21T12:00:00Z'),storage:{getItem:()=>null,setItem(){}}});
 const guide=model.testGuide(0);
 assert.equal(guide.practice.length,9);
 assert.ok(guide.practice.every(q=>q.skill==='long-short-u'));
 assert.deepEqual(guide.spellingWords,[],'original examples must not become a verified teacher word list');
});
