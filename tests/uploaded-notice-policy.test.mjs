import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {currentImportantDates,validateUploadedNoticePolicy} from "../scripts/uploaded-notice-policy.mjs";

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


test("newer dated official notice supersedes an older nearby school date without a human gate",()=>{
  const copy=structuredClone(source);
  const authoritative=copy.documents.find(d=>d.id===copy.sourcePrecedence.authoritativeCurrentDocument);
  assert.ok(authoritative);
  const later=structuredClone(authoritative);
  later.id="new-weekly-reminder-precedence-test";
  later.receivedAt="2026-10-16T13:28:00.000Z";
  later.label="Newer verified weekly notice test";
  later.review.reviewedBy="automated-fixed-event-extraction-v1";
  copy.documents.push(later);
  copy.importantDates.push({date:"Monday, Oct. 19",label:"Lego Club",
    kind:"club",sourceDocument:later.id});

  assert.doesNotThrow(()=>validateUploadedNoticePolicy(copy));
  const lego=currentImportantDates(copy).filter(item=>/lego club/i.test(item.label));
  assert.deepEqual(lego,[copy.importantDates.at(-1)]);
});

test("same-date and unrelated newer school notices remain available",()=>{
  const copy=structuredClone(source);
  const authoritative=copy.documents.find(d=>d.id===copy.sourcePrecedence.authoritativeCurrentDocument);
  const later=structuredClone(authoritative);
  later.id="new-same-date-weekly-notice-test";
  later.receivedAt="2026-10-16T13:28:00.000Z";
  later.review.reviewedBy="automated-fixed-event-extraction-v1";
  copy.documents.push(later);
  copy.importantDates.push({date:"Friday, Oct. 23",label:"Lego Club",
    kind:"club",sourceDocument:later.id});
  copy.importantDates.push({date:"Thursday, Oct. 29",label:"Grades 5–8 Dress Down & Flag Football",
    kind:"school event",sourceDocument:later.id});

  assert.doesNotThrow(()=>validateUploadedNoticePolicy(copy));
  const current=currentImportantDates(copy);
  assert.ok(current.some(item=>item.sourceDocument===later.id&&/lego club/i.test(item.label)));
  assert.ok(current.some(item=>item.sourceDocument===later.id&&/flag football/i.test(item.label)));
});

test("source precedence requires an existing approved authority but accepts verified automation",()=>{
  const missing=structuredClone(source);
  missing.sourcePrecedence.authoritativeCurrentDocument="missing-document";
  assert.throws(()=>validateUploadedNoticePolicy(missing),/approved authority/);

  const automated=structuredClone(source);
  const authority=automated.documents.find(d=>d.id===automated.sourcePrecedence.authoritativeCurrentDocument);
  authority.review.reviewedBy="automated-fixed-event-extraction-v1";
  assert.doesNotThrow(()=>validateUploadedNoticePolicy(automated));
});

test("delayed older reminder cannot revive a superseded school event",()=>{
  const copy=structuredClone(source);
  const prior=copy.documents.find(d=>d.id==="weekly-reminders-2026-10-12");
  assert.ok(prior);
  const stale={date:"Monday, Oct. 19",label:"Lego Club",
    kind:"club",sourceDocument:prior.id};
  copy.importantDates.push(stale);

  assert.doesNotThrow(()=>validateUploadedNoticePolicy(copy));
  assert.ok(!currentImportantDates(copy).includes(stale));
});
