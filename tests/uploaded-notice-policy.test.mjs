import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateUploadedNoticePolicy} from "../scripts/uploaded-notice-policy.mjs";

const source=JSON.parse(readFileSync(new URL("../pages/data/uploaded-notices.json",import.meta.url),"utf8"));

test("current uploaded notices satisfy provenance and PII policy",()=>{
  const result=validateUploadedNoticePolicy(structuredClone(source));
  assert.equal(result.documents,source.documents.length);
});

test("review receipt fails closed if facts change",()=>{
  const copy=structuredClone(source);
  copy.documents[0].facts.push("Unreviewed fact");
  assert.throws(()=>validateUploadedNoticePolicy(copy),/factsHash/);
});

test("high-confidence direct identifiers are blocked",()=>{
  const copy=structuredClone(source);
  copy.parentNotices.push({text:"Email parent@example.com for details.",topic:"bad",sourceDocument:copy.documents[0].id});
  assert.throws(()=>validateUploadedNoticePolicy(copy),/possible email/);
});

test("newly reviewed documents require source-content hashes",()=>{
  const copy=structuredClone(source);
  copy.documents[0].review.status="reviewed";
  copy.documents[0].provenance.sourceContentHash=null;
  assert.throws(()=>validateUploadedNoticePolicy(copy),/sourceContentHash/);
});
