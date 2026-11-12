import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {integrateUploadedNotices} from "../scripts/integrate-uploaded-notices.mjs";
import {validateUploadedNoticeIntegration} from "../scripts/validate-uploaded-notices.mjs";
import {validateUploadedNoticePolicy} from "../scripts/uploaded-notice-policy.mjs";

const notices=JSON.parse(readFileSync(new URL("../pages/data/uploaded-notices.json",import.meta.url),"utf8"));
const studyPack=JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8"));
const documentId="hsa-melody-message-cheer-dec-2026";

test("parent-photo HSA Christmas flyer has exact source integrity and no invented enrollment",()=>{
  const document=notices.documents.find(item=>item.id===documentId);
  assert.ok(document,"parent-supplied Christmas flyer should be receipted");
  assert.equal(document.provenance.sourceContentHash,"1ea7cf8fca280c732faf50fc890a4c9627d202cf6ccd631ae684e5fadc7c5eb8");
  assert.equal(document.receivedAt,"2026-11-12");
  assert.equal(validateUploadedNoticePolicy(notices).documents,32);
  const content=document.facts.join(" ");
  assert.match(content,/Dec(?:ember)? 18, 2026/);
  assert.match(content,/caroling stops are not specified/i);
  assert.match(content,/does not state a submission deadline/i);
  assert.doesNotMatch(content,/Emma|Perkins|registered|will attend/i);
});

test("all three December dates and participation instructions reach the visible study pack",()=>{
  const expected=[
    ["Thursday, Dec. 3",/Christmas Card Club.*3:00.*3:45 PM/i],
    ["Wednesday, Dec. 9",/Christmas Card Club.*3:00.*3:45 PM/i],
    ["Friday, Dec. 18",/Melody & Message of Cheer.*5:30.*7:00 PM/i]
  ];
  for(const [date,label] of expected){
    const entries=studyPack.pack.importantDates.filter(item=>item.date===date&&label.test(item.label)&&item.sourceDocument===documentId);
    assert.equal(entries.length,1, "exactly one source-backed calendar entry expected for "+date);
  }
  assert.ok(studyPack.pack.reminders.some(x=>/return the school flyer form/.test(x)&&/pickup at 3:45 PM/.test(x)));
  assert.ok(studyPack.pack.parentNotices.some(x=>/Christmas carols/.test(x)&&/later flyer/.test(x)));
  assert.equal(validateUploadedNoticeIntegration(studyPack,notices).documents,32);
});

test("reviewed Christmas notice integration is idempotent",()=>{
  const copy=structuredClone(studyPack);
  const result=integrateUploadedNotices(copy,structuredClone(notices),{now:new Date("2026-11-12T16:47:00.000Z")});
  assert.equal(result.changed,false);
  assert.deepEqual(result.data,studyPack);
});
