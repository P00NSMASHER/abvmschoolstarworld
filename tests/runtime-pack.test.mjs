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
    runtime.pack.contentPipeline.skills,
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


test("runtime pack compacts redundant per-question provenance without losing stable item identity",()=>{
  const sourceById=new Map(source.pack.contentPipeline.questions.map(question=>[question.id,question]));
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
    for(const key of Object.keys(small[i])){
      assert.deepEqual(small[i][key],full[i][key],"displayed skill data changed: "+full[i].id+"."+key);
    }
  }
});
