import test from "node:test";
import assert from "node:assert/strict";
import {buildStudyUniverse} from "../scripts/build-study-universe.mjs";

const q=(id,subject,skill,tier={})=>({id,subject,skill,prompt:`Prompt ${id}?`,choices:["Right","Wrong"],answer:"Right",explanation:`Explanation ${id}.`,hint:`Hint ${id}.`,sourceFact:`Verified ${skill}`,...tier});
function fixture(){return{
  pack:{pack:{sourceSufficient:true,sourceHash:"teacher-pages-test",sourceCheckedAt:"2026-10-08T00:00:00Z",generatedAt:"2026-10-08T00:00:00Z",weekLabel:"Week of October 5, 2026",
    importantDates:[{date:"Thursday, Oct. 15",label:"Math (subtraction)",kind:"test",source:"teacher-tests"},{date:"Friday, Oct. 2",label:"Old test",kind:"test",source:"teacher-tests"}],
    subjects:[{subject:"Math",studyNotes:["Subtract by counting back."]},{subject:"Reading",studyNotes:["Use details."]}],
    contentPipeline:{qa:{status:"pass"},questions:[q("m1","Math","math-subtraction",{questionType:"direct"}),q("r1","Reading","details",{questionType:"transfer"})]}}},
  archive:{questions:[q("m-old","Math","addition"),q("r-old","Reading","main-idea")]},
  fallbackQuestions:[q("m-star","Math","Subtraction"),q("rel-star","Religion","Details")]
};}

test("builds every reusable Study Universe surface with governed ordering",()=>{
  const out=buildStudyUniverse(fixture());
  assert.equal(out.contentOnly,true);assert.equal(out.policy.privateLearnerDataIncluded,false);assert.equal(out.policy.officialStarItems,false);
  assert.deepEqual(out.currentSubjectPractice.Math,["m1","m-old","m-star"]);
  assert.equal(out.selectableTestPrep.length,1);assert.equal(out.selectableTestPrep[0].label,"Math (subtraction)");assert.equal(out.selectableTestPrep[0].questionIds[0],"m1");
  assert.equal(out.printableGuides.length,2);assert.equal(out.verticalScripts.length,2);assert.equal(out.curriculumPackets.length,2);assert.ok(out.mixedReview.includes("m1"));assert.ok(out.mixedReview.includes("r1"));
  assert.match(out.selectableTestPrep[0].disclaimer,/not hidden teacher-test content/i);
});

test("rejects malformed answer keys and non-reviewed packs",()=>{
  const bad=fixture();bad.pack.pack.contentPipeline.questions[0].answer="Missing";
  assert.throws(()=>buildStudyUniverse(bad),/answer is not exactly one choice/);
  const unreviewed=fixture();unreviewed.pack.pack.contentPipeline.qa.status="fail";
  assert.throws(()=>buildStudyUniverse(unreviewed),/QA-passed/);
});
