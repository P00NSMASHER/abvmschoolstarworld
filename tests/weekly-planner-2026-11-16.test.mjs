import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {dateKey,noticeHash} from "../scripts/integrate-uploaded-notices.mjs";
import {validateUploadedNoticePolicy} from "../scripts/uploaded-notice-policy.mjs";
import {validateUploadedNoticeIntegration} from "../scripts/validate-uploaded-notices.mjs";

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));
const notices=read("../pages/data/uploaded-notices.json");
const envelope=read("../pages/data/study-pack.json");
const plannerId="weekly-planner-2026-11-16-parent-photo";
const planner=notices.documents.find(doc=>doc.id===plannerId);
const expected=[
  ["nov-16","Raise Right physical gift card order"],
  ["nov-17","Nut roll delivery — pickup 3–4:30 PM"],
  ["dec-1","School resumes"],
  ["dec-3","Christmas card making"],
  ["dec-9","Christmas card making"],
  ["dec-14","Santa Secret Shop"],
  ["dec-17","Christmas Play — 1 PM"],
];

test("November 16 weekly planner has reviewed original-image lineage and privacy-safe facts",()=>{
  assert.ok(planner,"The reviewed weekly planner must be present");
  assert.equal(planner.receivedAt,"2026-11-15");
  assert.equal(planner.provenance.sourceContentHash,"46bd772b6e2c2343038b1e86dbfcc7cfaeb84670a9b48c726ca4c07ab0e1e3de");
  assert.equal(planner.provenance.factsHash,createHash("sha256").update(JSON.stringify(planner.facts)).digest("hex"));
  assert.equal(planner.review.status,"reviewed");
  assert.equal(planner.review.piiReviewed,true);
  assert.doesNotMatch(JSON.stringify(planner),/Emma Perkins|IMG_5132.jpeg/);
  assert.equal(validateUploadedNoticePolicy(notices).documents,notices.documents.length);
  assert.equal(validateUploadedNoticeIntegration(envelope,notices).documents,notices.documents.length);
  assert.equal(envelope.pack.uploadedNoticeHash,noticeHash(notices));
});

test("verified new school dates appear on the app calendar without inventing tests",()=>{
  for(const [day,label] of expected){
    assert.ok(envelope.pack.importantDates.some(item=>
      dateKey(item.date)===day&&item.label===label&&item.sourceDocument===plannerId),
      `Missing source-backed calendar entry: ${day} ${label}`);
  }
  assert.ok(envelope.pack.importantDates.some(item=>dateKey(item.date)==="nov-25"&&/noon dismissal/i.test(item.label)));
  for(const day of ["nov-26","nov-27","nov-30"]){
    assert.ok(envelope.pack.importantDates.some(item=>dateKey(item.date)===day&&/no school/i.test(item.label)));
  }
  assert.ok(notices.importantDates.filter(item=>item.sourceDocument===plannerId).every(item=>item.kind!=="test"));
});

test("Tuesday pickup window supersedes outdated unscheduled notice in the user-visible calendar",()=>{
  const runtime={window:{}};
  runInNewContext(readFileSync(new URL("../pages/school-updates.js",import.meta.url),"utf8"),runtime);
  const raw=envelope.pack.importantDates.filter(item=>dateKey(item.date)==="nov-17"&&/nut roll/i.test(item.label));
  assert.ok(raw.some(row=>row.sourceDocument==="nov-2026-school-calendar-parent-photo"),"retain monthly source");
  assert.ok(raw.some(row=>row.sourceDocument===plannerId),"retain newer detailed source");
  // The teacher candidate generator may additionally restore a generic teacher-home pickup.
  // All genuine source rows must still collapse to ONE visible, time-specific event.
  const shown=runtime.window.ABVMSchoolUpdates.uniqueEvents(raw);
  assert.equal(shown.length,1,"The calendar must show one pickup, not duplicate rows");
  assert.equal(shown[0].label,"Nut roll delivery — pickup 3–4:30 PM");
  assert.ok(envelope.pack.reminders.some(text=>/Nut Roll delivery pickup is 3–4:30 PM/.test(text)));
  assert.ok(envelope.pack.parentNotices.some(text=>/Nut Roll pickup.*3–4:30 PM/.test(text)));
  assert.ok(!envelope.pack.parentNotices.some(text=>/Nut Roll.*school-designated time/i.test(text)));
  assert.ok(!envelope.pack.importantDates.some(item=>/Nut Roll.*time assigned by school/i.test(item.label)));
});
