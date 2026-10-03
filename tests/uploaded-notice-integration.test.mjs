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
