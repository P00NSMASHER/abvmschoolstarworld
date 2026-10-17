import {correctOriginalQuestion} from '../scripts/question-corrections.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildRuntimePack,RUNTIME_QUESTION_FIELDS,runtimePackJson} from "../scripts/build-runtime-pack.mjs";
import {religionChapterScopes} from "../pages/study-hub-core.mjs";

const source=JSON.parse(fs.readFileSync("pages/data/study-pack.json","utf8"));
const runtime=buildRuntimePack(source);

test("runtime pack preserves live data and strips audit-only question metadata",()=>{
  assert.equal(runtime.pack.sourceHash,source.pack.sourceHash);
  assert.equal(runtime.pack.sourceSufficient,true);
  assert.deepEqual(runtime.pack.importantDates,source.pack.importantDates);
  assert.deepEqual(runtime.pack.homework,source.pack.homework);
  assert.deepEqual(runtime.pack.subjects,source.pack.subjects);
  assert.deepEqual(
    runtime.pack.contentPipeline.skills.map(({noteTopics,...skill})=>skill),
    source.pack.contentPipeline.skills.map(({sourceLineage,evidenceContract,...skill})=>skill),
    "runtime skill labels, notes, standards and other study fields must remain unchanged"
  );
  assert.equal(runtime.pack.contentPipeline.questions.length,source.pack.contentPipeline.questions.length);

  const forbidden=[
    "sourceLineage","evidenceContract","rubric","generatorVersion","provenance","templateId",
    "cognitiveDemand","sourceEvidence","sourceMode","supportType","assessedSkillIds","presentationFingerprint",
    "sourceFact","contentFingerprint"
  ];
  for(const question of runtime.pack.contentPipeline.questions){
    for(const field of Object.keys(question))assert.ok(RUNTIME_QUESTION_FIELDS.includes(field),"unexpected runtime question field: "+field);
    for(const field of forbidden)assert.equal(Object.hasOwn(question,field),false,"audit-only field leaked: "+field);
    assert.equal(Array.isArray(question.choices),true);
    assert.ok(question.choiceDiagnostics&&typeof question.choiceDiagnostics==="object");
  }

  const fullBytes=Buffer.byteLength(JSON.stringify(source),"utf8");
  const runtimeBytes=Buffer.byteLength(runtimePackJson(source),"utf8");
  assert.ok(runtimeBytes<fullBytes*.7,{fullBytes,runtimeBytes});
});


test("runtime pack compacts provenance while retaining governed or explicitly corrected item identity",()=>{
  const sourceById=new Map(source.pack.contentPipeline.questions.map(correctOriginalQuestion).map(question=>[question.id,question]));
  assert.ok(source.pack.contentPipeline.questions.some(question=>Object.hasOwn(question,"sourceFact")),"full governed pack must retain source facts");
  assert.ok(source.pack.contentPipeline.questions.some(question=>Object.hasOwn(question,"contentFingerprint")),"full governed pack must retain content fingerprints");
  for(const question of runtime.pack.contentPipeline.questions){
    const full=sourceById.get(question.id);
    assert.ok(full,"runtime question must correspond to governed source question: "+question.id);
    assert.equal(Object.hasOwn(question,"sourceFact"),false,"runtime must not duplicate full-pack source fact");
    assert.equal(Object.hasOwn(question,"contentFingerprint"),false,"runtime must not duplicate full-pack content fingerprint");
    const stable=full.variantFingerprint||full.contentFingerprint;
    if(stable)assert.equal(question.variantFingerprint,stable,"stable runtime item identity changed: "+question.id);
  }
});

test("real runtime pack retains only 18 source-verified Chapter 3 identifiers, not teacher evidence",()=>{
  const all=source.pack.contentPipeline.questions;
  const expected=all.filter(q=>religionChapterScopes(q).includes(3)).map(q=>q.id).sort();
  const encoded=runtime.pack.contentPipeline.questions.filter(q=>
    Array.isArray(q.sourceChapters)&&q.sourceChapters.includes(3)).map(q=>q.id).sort();
  assert.equal(expected.length,18,"Reviewed Chapter 3 content count must be intentional");
  assert.deepEqual(encoded,expected);
  assert.ok(runtime.pack.contentPipeline.questions.every(q=>
    !Object.hasOwn(q,"sourceChapters")||
    (q.subject==="Religion"&&Array.isArray(q.sourceChapters)&&
      q.sourceChapters.every(v=>Number.isInteger(v)&&v>0&&v<100))));
  assert.ok(runtime.pack.contentPipeline.questions.every(q=>!Object.hasOwn(q,"sourceLineage")));
  assert.doesNotMatch(JSON.stringify(runtime.pack.contentPipeline.questions),/matchedEvidence|sourceCaptureHash|evidenceExcerptHash|learnerResponse|studentName|privateHistory/);
});

test("runtime keeps a compact chapter-scoped study-guide checklist without audit lineage",()=>{
  const facts=runtime.pack.testGuideFacts?.religionChapters?.["3"];
  assert.ok(Array.isArray(facts)&&facts.length>=9,"Chapter 3 guide facts must survive runtime compaction");
  assert.ok(facts.some(row=>/(?:original|orignial|oirginal) sin/i.test(row)),"missing compact original-sin guide fact");
  for(const phrase of ["Church members","Pope Leo","Steps to Baptism"])
    assert.ok(facts.some(row=>row.toLowerCase().includes(phrase.toLowerCase())),"missing compact guide fact: "+phrase);
  assert.doesNotMatch(JSON.stringify(runtime.pack.testGuideFacts),/sourceCaptureHash|evidenceExcerptHash|learnerResponse|studentName|privateHistory/);
});


test("skill audit lineage stays in full pack and is omitted only from the runtime",()=>{
  const full=source.pack.contentPipeline.skills;
  const small=runtime.pack.contentPipeline.skills;
  assert.equal(small.length,full.length);
  assert.ok(full.some(skill=>skill.sourceLineage?.quality==="page-exact"));
  const fullBytes=Buffer.byteLength(JSON.stringify(full),"utf8");
  const runtimeBytes=Buffer.byteLength(JSON.stringify(small),"utf8");
  assert.ok(fullBytes-runtimeBytes>12000,"remove enough redundant per-skill audit hashes for newly refreshed question banks");
  for(let i=0;i<full.length;i++){
    assert.equal(Object.hasOwn(small[i],"sourceLineage"),false,"browser skill must not carry teacher capture hashes");
    assert.equal(Object.hasOwn(small[i],"evidenceContract"),false,"browser skill must not repeat the QA contract");
    const normalized=value=>String(value).toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
    const expectedTopics=source.pack.subjects.filter(row=>row.subject===full[i].subject).flatMap(row=>row.topics||[]).filter(topic=>(full[i].sourceLineage?.matchedEvidence||[]).some(line=>normalized(line).includes(normalized(topic))));
    assert.deepEqual(small[i].noteTopics,expectedTopics,'compact links reproduce exact source topic associations');
    for(const key of Object.keys(small[i]).filter(key=>key!=='noteTopics')){
      assert.deepEqual(small[i][key],full[i][key],"displayed skill data changed: "+full[i].id+"."+key);
    }
  }
});
test("retained original review questions stay date-bound, chapter-exact and free of audit-only text",()=>{
  const original=source.pack.contentPipeline.questions.find(q=>
    q.subject==="Religion"&&religionChapterScopes(q).includes(3));
  assert.ok(original,"governed Chapter 3 question is required for a faithful review fixture");
  const envelope=structuredClone(source);
  const reviewVerifiedAt="2026-10-08T15:00:17.769Z";
  const reviewExpiresAt="2026-10-22T15:00:17.769Z";
  const reviewSourceHash=source.pack.sourceHash;
  envelope.pack.recentReviewPipeline.questions=[{
    ...original,reviewVerifiedAt,reviewExpiresAt,reviewSourceHash,
  }];
  const [candidate]=buildRuntimePack(envelope).pack.recentReviewPipeline.questions;
  assert.equal(candidate.id,original.id);
  assert.deepEqual(candidate.choices,original.choices);
  assert.equal(candidate.answer,original.answer);
  assert.equal(candidate.variantFingerprint,original.variantFingerprint||original.contentFingerprint);
  assert.deepEqual(candidate.sourceChapters,religionChapterScopes(original));
  assert.ok(candidate.sourceChapters.includes(3),"reviewed Chapter 3 scope is preserved");
  assert.deepEqual([candidate.reviewVerifiedAt,candidate.reviewExpiresAt,candidate.reviewSourceHash],
    [reviewVerifiedAt,reviewExpiresAt,reviewSourceHash]);
  for(const field of ["sourceLineage","sourceFact","contentFingerprint","rubric","evidenceContract","sourceEvidence","provenance"]){
    assert.equal(Object.hasOwn(candidate,field),false,"recent-review browser payload includes audit field: "+field);
  }
  const bad=structuredClone(envelope);
  delete bad.pack.recentReviewPipeline.questions[0].reviewExpiresAt;
  assert.throws(()=>buildRuntimePack(bad),/missing its verified source or expiry window/);
});

test("curriculum turnover cannot defeat the 30 percent runtime budget with retired full-evidence questions",()=>{
  const envelope=structuredClone(source);
  const retiredSkills=envelope.pack.contentPipeline.skills.filter((_,index)=>index%3===0);
  const retiredIds=new Set(retiredSkills.map(skill=>skill.id));
  const retired=envelope.pack.contentPipeline.questions.filter(q=>retiredIds.has(q.skill));
  const current=envelope.pack.contentPipeline.questions.filter(q=>!retiredIds.has(q.skill));
  assert.ok(retired.length>0&&current.length>0,"both current and review questions are needed");
  const reviewVerifiedAt="2026-10-08T15:00:17.769Z";
  const reviewExpiresAt="2026-10-22T15:00:17.769Z";
  const reviewSourceHash=source.pack.sourceHash;
  envelope.pack.contentPipeline.skills=envelope.pack.contentPipeline.skills.filter(skill=>!retiredIds.has(skill.id));
  envelope.pack.contentPipeline.questions=current;
  envelope.pack.recentReviewPipeline.skills=retiredSkills.map(skill=>({
    ...skill,reviewVerifiedAt,reviewExpiresAt,reviewSourceHash,
  }));
  envelope.pack.recentReviewPipeline.questions=retired.map(question=>({
    ...question,reviewVerifiedAt,reviewExpiresAt,reviewSourceHash,
  }));
  const packed=buildRuntimePack(envelope);
  assert.equal(packed.pack.recentReviewPipeline.questions.length,retired.length);
  assert.equal(packed.pack.contentPipeline.questions.length,current.length);
  const fullBytes=Buffer.byteLength(JSON.stringify(envelope),"utf8");
  const runtimeBytes=Buffer.byteLength(runtimePackJson(envelope),"utf8");
  assert.ok(runtimeBytes<fullBytes*.7,{fullBytes,runtimeBytes});
});

test('only page-exact lineage can supply compact Reading text-set scope identifiers',()=>{
  const fixture=structuredClone(source);
  const [approved,unverified]=fixture.pack.contentPipeline.questions.filter(row=>row.subject==='Reading / ELA').slice(0,2);
  assert.ok(approved&&unverified);
  approved.sourceLineage.matchedEvidence.push('Unit 1 Text Set 3: reviewed source match');
  unverified.sourceLineage.matchedEvidence.push('Unit 1 Text Set 3: unverified source');
  unverified.sourceLineage.quality='unknown';
  const questions=buildRuntimePack(fixture).pack.contentPipeline.questions;
  assert.deepEqual(questions.find(q=>q.id===approved.id).sourceTestScopes,['Unit 1 Text Set 3']);
  assert.equal(questions.find(q=>q.id===unverified.id).sourceTestScopes,undefined);
  assert.doesNotMatch(JSON.stringify(questions),/reviewed source match|sourceCaptureHash/);
});
