import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildRuntimePack,RUNTIME_QUESTION_FIELDS,runtimePackJson} from "../scripts/build-runtime-pack.mjs";

const source=JSON.parse(fs.readFileSync("pages/data/study-pack.json","utf8"));
const runtime=buildRuntimePack(source);

test("runtime pack preserves live data and strips audit-only question metadata",()=>{
  assert.equal(runtime.pack.sourceHash,source.pack.sourceHash);
  assert.equal(runtime.pack.sourceSufficient,true);
  assert.deepEqual(runtime.pack.importantDates,source.pack.importantDates);
  assert.deepEqual(runtime.pack.homework,source.pack.homework);
  assert.deepEqual(runtime.pack.subjects,source.pack.subjects);
  assert.deepEqual(runtime.pack.contentPipeline.skills,source.pack.contentPipeline.skills);
  assert.equal(runtime.pack.contentPipeline.questions.length,source.pack.contentPipeline.questions.length);

  const forbidden=[
    "sourceLineage","evidenceContract","rubric","generatorVersion","provenance","templateId",
    "cognitiveDemand","sourceEvidence","sourceMode","supportType","assessedSkillIds","presentationFingerprint"
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
