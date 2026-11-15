import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {validateUploadedNoticePolicy} from "../scripts/uploaded-notice-policy.mjs";
import {validateUploadedNoticeIntegration} from "../scripts/validate-uploaded-notices.mjs";
import {integrateUploadedNotices} from "../scripts/integrate-uploaded-notices.mjs";

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));
const uploaded=read("../pages/data/uploaded-notices.json");
const app=read("../pages/data/study-pack.json");
const sourceId="abvm-weekly-planner-2026-11-16-parent-photo";

test("Nov 16–20 school planner carries its actual source hash and privacy-safe review",()=>{
  assert.equal(validateUploadedNoticePolicy(uploaded).documents,uploaded.documents.length);
  const photo=uploaded.documents.find(row=>row.id===sourceId);
  assert.ok(photo,"Missing November 15 parent-supplied weekly planner");
  assert.equal(photo.provenance.sourceContentHash,"46bd772b6e2c2343038b1e86dbfcc7cfaeb84670a9b48c726ca4c07ab0e1e3de");
  assert.equal(photo.receivedAt,"2026-11-15");
  assert.equal(photo.review.piiReviewed,true);
  assert.ok(!JSON.stringify(photo).includes("Emma"),"Child identity must not be public");
});

test("calendar contains source-backed exact Nov 17 pickup and all unique December dates",()=>{
  assert.equal(validateUploadedNoticeIntegration(app,uploaded).documents,uploaded.documents.length);
  const plan=uploaded.importantDates.filter(x=>x.sourceDocument===sourceId);
  const has=(date,label)=>plan.some(x=>x.date===date&&x.label===label);
  assert.ok(has("Monday, Nov. 16","RaiseRight physical gift card order"));
  assert.ok(has("Tuesday, Nov. 17","Nut roll delivery — Nut Roll Sale pickup 3–4:30 PM"));
  assert.ok(has("Thursday, Dec. 3","Christmas Card Making"));
  assert.ok(has("Wednesday, Dec. 9","Christmas Card Making"));
  assert.ok(has("Tuesday, Dec. 1","School resumes"));
  assert.ok(has("Monday, Dec. 14","Santa Secret Shop"));
  assert.ok(has("Thursday, Dec. 17","Christmas Play — 1 PM"));
  assert.ok(!uploaded.importantDates.some(x=>/time assigned by school/i.test(x.label)));
  assert.ok(uploaded.importantDates.some(x=>x.sourceDocument==="hsa-nut-roll-order-a-2026"&&x.label.includes("Nut Roll Sale")&&x.label.includes("3–4:30 PM")));
  for(const x of plan)assert.ok(app.pack.importantDates.some(y=>y.date===x.date&&y.label===x.label&&(y.sourceDocument===sourceId||(y.sourceDocuments||[]).includes(sourceId))),"Not published: "+x.label);
});

test("today and calendar do not show duplicate generic Nut Roll pickup without its time",()=>{
  const context={window:{}};
  vm.runInNewContext(readFileSync(new URL("../pages/school-updates.js",import.meta.url),"utf8"),context);
  const rows=app.pack.importantDates.filter(x=>x.date==="Tuesday, Nov. 17"&&/nut roll/i.test(x.label));
  const deduped=context.window.ABVMSchoolUpdates.uniqueEvents(rows);
  assert.equal(deduped.length,1,JSON.stringify(deduped));
  assert.match(deduped[0].label,/3–4:30 PM/);
  assert.ok(!rows.some(x=>x.source==="teacher-home"&&x.label==="Nut Roll pick up"));
});

test("missing the confirmed pickup or a December event fails the source integration guard",()=>{
  const damaged=structuredClone(app);
  damaged.pack.importantDates=damaged.pack.importantDates.filter(x=>!(x.date==="Tuesday, Nov. 17"&&/3–4:30 PM/.test(x.label)));
  assert.throws(()=>validateUploadedNoticeIntegration(damaged,uploaded),/missing important date/);
});

test("weekly planner notice import is idempotent on its exact data hash",()=>{
  const result=integrateUploadedNotices(structuredClone(app),structuredClone(uploaded),{now:new Date("2026-11-15T23:30:00.000Z")});
  assert.equal(result.changed,false);
  assert.deepEqual(result.data,app);
});
