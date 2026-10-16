import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {integrateUploadedNotices} from "../scripts/integrate-uploaded-notices.mjs";
import {validateUploadedNoticeIntegration} from "../scripts/validate-uploaded-notices.mjs";

const uploaded=JSON.parse(readFileSync(new URL("../pages/data/uploaded-notices.json",import.meta.url),"utf8"));
const source=JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8"));

test("the runtime study pack exactly receipts every reviewed uploaded notice",()=>{
  const result=validateUploadedNoticeIntegration(structuredClone(source),structuredClone(uploaded));
  assert.equal(result.documents,uploaded.documents.length);
  assert.equal(result.lastIntegratedAt,uploaded.lastIntegratedAt);
});

test("uploaded notice integration is idempotent",()=>{
  const now=new Date("2026-10-03T18:00:00.000Z");
  const first=integrateUploadedNotices(structuredClone(source),structuredClone(uploaded),{now});
  const snapshot=structuredClone(first.data);
  const second=integrateUploadedNotices(first.data,structuredClone(uploaded),{now});
  assert.equal(second.changed,false);
  assert.deepEqual(second.data,snapshot);
});

test("revised notice wording replaces the previous public wording",()=>{
  const stale=structuredClone(source);
  stale.pack.parentNotices.push("Gift Card Calendar winners were announced for Oct. 1 and Oct. 2: each prize was $50.");
  const result=integrateUploadedNotices(stale,structuredClone(uploaded),{now:new Date("2026-10-03T18:00:00.000Z")});
  const winnerNotices=result.data.pack.parentNotices.filter(text=>/Gift Card Calendar.*(?:winner|drawing)/i.test(text));
  assert.deepEqual(winnerNotices,[uploaded.parentNotices.find(item=>item.topic==="gift-card-winners").text]);
});

test("stale uploaded-notice receipts fail closed",()=>{
  const stale=structuredClone(source);
  stale.uploadedNotices.latestIntegratedAt="2000-01-01T00:00:00.000Z";
  assert.throws(()=>validateUploadedNoticeIntegration(stale,structuredClone(uploaded)),/latestIntegratedAt is stale/);
});

test("integration publishes only the newest verified nearby event and preserves raw provenance",()=>{
  const notices=structuredClone(uploaded);
  const authoritative=notices.documents.find(d=>d.id===notices.sourcePrecedence.authoritativeCurrentDocument);
  const later=structuredClone(authoritative);
  later.id="new-integration-precedence-test";
  later.receivedAt="2026-10-16T13:28:00.000Z";
  later.label="Newer verified weekly notice test";
  later.review.reviewedBy="automated-fixed-event-extraction-v1";
  notices.documents.push(later);
  notices.importantDates.push({date:"Monday, Oct. 19",label:"Lego Club",
    kind:"club",sourceDocument:later.id});

  const rawCount=notices.importantDates.length;
  const result=integrateUploadedNotices(structuredClone(source),notices,{
    now:new Date("2026-10-16T14:00:00.000Z")
  });
  const publicLego=result.data.pack.importantDates.filter(item=>/lego club/i.test(item.label)&&/oct/i.test(item.date));

  assert.deepEqual(publicLego,[{
    date:"Monday, Oct. 19",label:"Lego Club",kind:"club",
    sourceDocument:later.id,source:"uploaded-notice"
  }]);
  assert.equal(notices.importantDates.length,rawCount);
  assert.doesNotThrow(()=>validateUploadedNoticeIntegration(result.data,notices));
});
