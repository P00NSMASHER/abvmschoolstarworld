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

test("same-day uploaded notice labels are emitted once with complete provenance",()=>{
  const duplicated=structuredClone(uploaded);
  const event=structuredClone(duplicated.importantDates[0]);
  const alternateDocument=duplicated.documents.find(item=>item.id!==event.sourceDocument);
  assert.ok(alternateDocument);
  duplicated.importantDates.push({...event,sourceDocument:alternateDocument.id});
  const result=integrateUploadedNotices(structuredClone(source),duplicated,{now:new Date("2026-10-16T22:00:00.000Z")});
  const matches=result.data.pack.importantDates.filter(item=>item.date===event.date&&item.label===event.label);
  assert.equal(matches.length,1);
  assert.deepEqual(matches[0].sourceDocuments.sort(),[event.sourceDocument,alternateDocument.id].sort());
});

test('notice deduplication normalizes repeated whitespace, without losing source receipts',()=>{
  const duplicated=structuredClone(uploaded);
  const first=duplicated.importantDates[0];
  const other=duplicated.documents.find(item=>item.id!==first.sourceDocument);
  assert.ok(other);
  duplicated.importantDates.push({...structuredClone(first),label:'  '+first.label.toUpperCase().replaceAll(' ','   ')+' ',sourceDocument:other.id});
  const result=integrateUploadedNotices(structuredClone(source),duplicated,{now:new Date('2026-10-16T22:00:00Z')});
  const clean=value=>String(value).toLowerCase().trim().replace(/\s+/g,' ');
  const rows=result.data.pack.importantDates.filter(row=>row.date===first.date&&clean(row.label)===clean(first.label));
  assert.equal(rows.length,1);
  assert.deepEqual(new Set(rows[0].sourceDocuments),new Set([first.sourceDocument,other.id]));
});

test('freshly merged September abbreviation variants keep all independently reviewed source receipts',()=>{
  const result=integrateUploadedNotices(structuredClone(source),structuredClone(uploaded),{now:new Date('2026-10-17T07:00:00Z')});
  assert.doesNotThrow(()=>validateUploadedNoticeIntegration(result.data,uploaded));
  const rows=result.data.pack.importantDates.filter(row=>/pretzel delivery/i.test(row.label)&&/sep/i.test(row.date));
  assert.equal(rows.length,1);
  assert.deepEqual(new Set([rows[0].sourceDocument,...rows[0].sourceDocuments||[]]),new Set([
    'weekly-reminders-2026-09-21','weekly-reminders-2026-09-07','weekly-reminders-2026-09-14'
  ]));
});
