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


test("newer import cannot silently move a user-confirmed Grade 2 school date",()=>{
  const copy=structuredClone(source);
  const authoritative=copy.documents.find(d=>d.id===copy.sourcePrecedence.authoritativeCurrentDocument);
  assert.ok(authoritative);
  const later=structuredClone(authoritative);
  later.id="new-weekly-reminder-conflict-test";
  later.receivedAt="2026-10-19";
  later.label="Newer reviewed weekly notice test";
  copy.documents.push(later);
  copy.importantDates.push({date:"Monday, Oct. 19",label:"Lego Club",
    kind:"club",sourceDocument:later.id});
  assert.throws(()=>validateUploadedNoticePolicy(copy),/conflicts with parent-confirmed Lego Club date/);
});

test("same-date and unrelated newer school notices are not rejected",()=>{
  const copy=structuredClone(source);
  const authoritative=copy.documents.find(d=>d.id===copy.sourcePrecedence.authoritativeCurrentDocument);
  const later=structuredClone(authoritative);
  later.id="new-same-date-weekly-notice-test";
  later.receivedAt="2026-10-19";
  copy.documents.push(later);
  copy.importantDates.push({date:"Friday, Oct. 23",label:"Lego Club",
    kind:"club",sourceDocument:later.id});
  copy.importantDates.push({date:"Thursday, Oct. 29",label:"Grades 5–8 Dress Down & Flag Football",
    kind:"school event",sourceDocument:later.id});
  assert.doesNotThrow(()=>validateUploadedNoticePolicy(copy));
});

test("school source precedence requires a real manually-reviewed authority",()=>{
  const copy=structuredClone(source);
  copy.sourcePrecedence.authoritativeCurrentDocument="missing-document";
  assert.throws(()=>validateUploadedNoticePolicy(copy),/manually reviewed/);
  const automated=structuredClone(source);
  const authority=automated.documents.find(d=>d.id===automated.sourcePrecedence.authoritativeCurrentDocument);
  authority.review.reviewedBy="automated-fixed-event-extraction-v1";
  assert.throws(()=>validateUploadedNoticePolicy(automated),/manually reviewed/);
});
