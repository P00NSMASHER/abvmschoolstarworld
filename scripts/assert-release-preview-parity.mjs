#!/usr/bin/env node
// Read-only integration gate: preserve the latest main school information.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {SCHOOL_SIGN,verifyApprovedSchoolSignRestoration} from "./verify-approved-school-sign-parity.mjs";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const base=process.env.ABVM_MAIN_REF || "origin/main";
const candidate=process.env.ABVM_PREVIEW_REF || "HEAD";
const protectedPaths=[
  "pages/data","pages/school-updates.js","pages/weekly-learning.js",
  "pages/styles.css","pages/manifest.webmanifest","pages/assets/school",
  "pages/assets/lunch-art","pages/assets/illustrations","pages/assets/badges",
  "scripts/refresh-teacher-pages.mjs"
];
const git=(...args)=>execFileSync("git",args,{cwd:root,encoding:"utf8",maxBuffer:10000000}).trim();
const fail=message=>{throw new Error("ABVM PREVIEW SOURCE PARITY FAIL: "+message)};
const mainSha=git("rev-parse","--verify",base+"^{commit}");
const previewSha=git("rev-parse","--verify",candidate+"^{commit}");
if(mainSha===previewSha)fail("candidate is main, not a review-only preview");
const diff=git("diff","--no-renames","--name-status",mainSha,previewSha,"--",...protectedPaths);
const signRestorationReview=process.env.ABVM_APPROVED_SIGN_RESTORE==="1";
let restoredApprovedSign=null;
if(diff){
  if(!signRestorationReview)fail("these authoritative school files differ from the latest main:\n"+diff+
    "\nReconcile, preserve main's newer source data and rerun checks.");
  try {
    restoredApprovedSign=verifyApprovedSchoolSignRestoration({
      diff,
      mainBlob:git("rev-parse",mainSha+":"+SCHOOL_SIGN),
      previewBlob:git("rev-parse",previewSha+":"+SCHOOL_SIGN),
      bytes:readFileSync(resolve(root,SCHOOL_SIGN))
    });
  } catch(error) { fail("the sole permitted sign repair is not exactly approved: "+error.message); }
}
if(signRestorationReview&&!restoredApprovedSign)
  fail("sign-restoration review must contain exactly the approved school-sign repair; main may have advanced");
const entries=git("ls-tree","-r","--name-only",mainSha,"--",...protectedPaths).split("\n").filter(Boolean);
if(entries.length<10||!entries.includes("pages/data/study-pack.json"))fail("protected school source inventory is incomplete");
const data=JSON.parse(readFileSync(resolve(root,"pages/data/study-pack.json"),"utf8"));
const checked=data.sourceLastCheckedAt||data.pack?.sourceCheckedAt;
const notice=data.sourceLastSeenAt||null;
if(!checked||!Number.isFinite(Date.parse(checked)))fail("teacher-page check timestamp missing or invalid");
if(notice&&!Number.isFinite(Date.parse(notice)))fail("notice-arrival timestamp invalid");
if(data.sourceLastCheckedAt&&data.pack?.sourceCheckedAt&&data.sourceLastCheckedAt!==data.pack.sourceCheckedAt)
  fail("pack and envelope disagree about the teacher-page check");
const app=readFileSync(resolve(root,"pages/app.js"),"utf8");
const freshness=app.match(/function freshnessState\(\)\s*\{([\s\S]*?)\n\}/)?.[1]||"";
if(!/const raw\s*=\s*envelope\?\.sourceLastCheckedAt\s*\|\|\s*pack\?\.sourceCheckedAt\s*;/.test(freshness))
  fail("teacher freshness must use source-specific teacher-page check timestamps");
if(/const raw\s*=[^\n]*(sourceLastSeenAt|sourceCapturedAt|generatedAt)/.test(freshness))
  fail("notice arrivals or pack generation falsely imply teacher verification");
console.log(["ABVM RELEASE PREVIEW SOURCE PARITY PASS",
  "Main: "+mainSha,"Preview: "+previewSha,
  "Protected files: "+entries.length,"Teacher pages last checked: "+checked,
  "Last notice arrival: "+(notice||"unavailable"),restoredApprovedSign ? "Exactly one approved school-sign image restored: "+restoredApprovedSign.sha256 : "No school data or artwork replaced."].join("\n"));
if(process.env.GITHUB_STEP_SUMMARY&&existsSync(process.env.GITHUB_STEP_SUMMARY)){
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,"### ABVM preview source parity\n\n"+
  "| Main SHA | "+mainSha+" |\n|---|---|\n"+
  "| Preview SHA | "+previewSha+" |\n"+
  "| Unchanged protected files | "+entries.length+" |\n"+
  "| Teacher page check | "+checked+" |\n"+
  "| Notice arrival (not teacher verification) | "+(notice||"unavailable")+" |\n\n"+
  "PASS: Read-only; no release/data mutation. "+(restoredApprovedSign ? "Only exact reviewed school-sign repair differs from main." : "All protected sources and artwork match main.")+"\n");
}
