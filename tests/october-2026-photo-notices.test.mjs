import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const notices=JSON.parse(readFileSync(new URL("../pages/data/uploaded-notices.json",import.meta.url),"utf8"));
const data=JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8"));
const dates=data.pack.importantDates;
const hasDate=(date,fragment)=>dates.some(row=>row.date===date&&row.label.includes(fragment));
test("seven October 8 notice photos have distinct evidence receipts",()=>{
 const ids=["reading-royals-family-night-2026-11-21","cyo-basketball-grades-3-8-2026","servants-for-all-hygiene-2026-10","hsa-nut-roll-office-2026","hsa-nut-roll-order-a-2026","hsa-nut-roll-order-b-2026","eucharistic-consecration-2026"];
 assert.equal(new Set(ids).size,7);
 for(const id of ids){const doc=notices.documents.find(d=>d.id===id);assert.ok(doc,id);assert.match(doc.provenance.sourceContentHash,/^[a-f0-9]{64}$/);assert.equal(doc.review.piiReviewed,true);}
});
test("fundraiser deadlines, consecration, Mass, family events and optional Holy Hours are dated",()=>{
 assert.ok(hasDate("Friday, Oct. 30","Nut Roll Sale"));
 assert.ok(hasDate("Tuesday, Nov. 17","Nut Roll Sale"));
 assert.ok(hasDate("Saturday, Nov. 21","Reading Royals"));
 assert.ok(hasDate("Tuesday, Oct. 20","Eucharistic Consecration"));
 assert.ok(hasDate("Sunday, Nov. 1","Family Festival"));
 assert.ok(hasDate("Thursday, Oct. 22","Optional Eucharistic Holy Hour"));
 assert.ok(hasDate("Tuesday, Nov. 3","Optional Eucharistic Holy Hour"));
 assert.ok(hasDate("Tuesday, Nov. 17","Optional Eucharistic Holy Hour"));
 assert.ok(hasDate("Tuesday, Dec. 8","Eucharistic Consecration"));
});
test("new donation notice does not silently replace the K-4 flag football date",()=>{
 assert.ok(dates.some(d=>d.date.includes("Oct. 26")&&/flag football/i.test(d.label)));
 assert.ok(data.pack.parentNotices.some(text=>/(?:Oct\.|October)\s*22\s+and\s+29/i.test(text)&&/(?:Oct\.|October)\s*26/i.test(text)));
});
test("links and no made-up basketball date, ticket prices or pickup time",()=>{
 const parents=data.pack.parentNotices.join("\\n");
 assert.ok(parents.includes("https://www.gofevo.com/event/AssumptionBVM2027"));
 assert.ok(parents.includes("https://forms.gle/C5BpMzwk5Uw2b2qXA"));
 assert.ok(parents.includes("school-designated time"));
 assert.ok(parents.includes("$0 student ticket"));
 assert.equal(dates.filter(d=>d.sourceDocument==="cyo-basketball-grades-3-8-2026").length,0);
});

test("latest Melissa weekly planner governs conflicting Grade 2 dates",()=>{
 const id="melissa-weekly-planner-2026-10-12-user-reviewed";
 assert.equal(notices.sourcePrecedence?.authoritativeCurrentDocument,id);
 assert.match(notices.sourcePrecedence.rule,/most recent dated email/i);
 assert.ok(notices.documents.some(doc=>doc.id===id&&doc.review?.status==="reviewed"));
 const required=[
  ["Wednesday, Oct. 14",/Progress Reports Sent Home/i],
  ["Tuesday, Oct. 20",/Grade 2.*No School.*Parent-Teacher Conferences/i],
  ["Thursday, Oct. 22",/Chick-fil-A Delivery/i],
  ["Friday, Oct. 23",/Lego Club/i],
  ["Friday, Oct. 23",/S.mores Family/i],
  ["Monday, Oct. 26",/K.4 Dress Down.*Flag Football/i]
 ];
 for(const [date,label] of required)assert.ok(dates.some(x=>x.date===date&&label.test(x.label)),date+" "+label);
 const outdated=dates.filter(x=>
  (x.date==="Thursday, Oct. 8"&&/progress report/i.test(x.label))||
  (x.date==="Friday, Oct. 16"&&/parent-teacher conference|chick-fil-a/i.test(x.label))||
  (x.date==="Monday, Oct. 19"&&/lego club|flag football|dress down/i.test(x.label))||
  (x.date==="Thursday, Oct. 23"&&/chick-fil-a/i.test(x.label))
 );
 assert.deepEqual(outdated,[],"older, contradicted events must not reappear");
});
