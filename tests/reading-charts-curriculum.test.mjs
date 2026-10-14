import test from "node:test";
import assert from "node:assert/strict";
import {READING_CHARTS_FAMILY} from "../scripts/curriculum-families/reading-charts.mjs";
import {matchCurriculumFamily} from "../scripts/curriculum-family-registry.mjs";
import {buildGrade2ContentPipeline,validateGrade2ContentPipeline} from "../scripts/grade2-content-pipeline.mjs";
import {buildCurriculumCoveragePlan} from "../scripts/curriculum-coverage-autopilot.mjs";
import {buildStudyUniverse} from "../scripts/build-study-universe.mjs";
import {questionsForTest} from "../pages/study-hub-core.mjs";

const checkedAt="2026-10-14T22:45:00.000Z";
const sourceHash="teacher-pages-"+"9".repeat(20);
const teachingLine="Reading Comprehension: ask & answer questions; main idea/details; charts";
const page=(line=teachingLine)=>({
  title:"Reading Work",
  url:"https://sites.google.com/view/abvmgr2/reading-work",
  checkedAt,contentHash:"a".repeat(64),lines:[line]
});
function current(sourceLine=teachingLine){
  const sources=[page(sourceLine)];
  const pack={sourceHash,subjects:[{subject:"Reading / ELA",topics:[],studyNotes:[sourceLine]}],vocabulary:[]};
  const pipeline=buildGrade2ContentPipeline(pack,{
    generatedAt:checkedAt,sourceHash,sourcePages:sources,requirePageExactLineage:true
  });
  return {sources,pack,pipeline};
}
test("current public teacher line produces 12 distinct, grounded chart questions without educator sign-off",()=>{
  const {sources,pipeline}=current();
  const rows=pipeline.questions.filter(q=>q.skill==="reading-charts");
  assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
  assert.equal(pipeline.qa.status,"pass");
  assert.equal(rows.length,12);
  assert.equal(new Set(rows.map(q=>q.prompt)).size,12);
  assert.equal(new Set(rows.map(q=>q.variantFingerprint)).size,12);
  assert.deepEqual(new Set(rows.map(q=>q.questionType)),new Set(["direct","transfer","reasoning"]));
  assert.equal(pipeline.qa.rejectedCount,0);
  for(const row of rows){
    assert.equal(row.choices.length,3);
    assert.equal(row.choices.filter(c=>c===row.answer).length,1);
    assert.equal(row.sourceLineage.quality,"page-exact");
    assert.equal(row.sourceLineage.sourceUrl,sources[0].url);
    assert.equal(row.sourceLineage.sourceCaptureHash,sources[0].contentHash);
    assert.equal(row.sourceLineage.sourceCheckedAt,checkedAt);
    assert.deepEqual(row.sourceLineage.matchedEvidence,[teachingLine]);
    assert.doesNotMatch(row.prompt,/teacher test|official exam|teacher wrote/i);
  }
  const plan=buildCurriculumCoveragePlan({pipeline,sourcePages:sources,sourceHash,generatedAt:checkedAt});
  assert.equal(plan.unsupportedCount,0,"charts are fully covered by original practice");
  assert.equal(matchCurriculumFamily("Reading / ELA","charts")?.id,"reading-charts");
});
test("standalone reading-chart test uses only source-backed chart questions and guides",()=>{
  const {pipeline}=current();
  const importantDates=[{date:"2026-10-15",label:"Reading (charts)",kind:"test"}];
  const result=buildStudyUniverse({
    pack:{sourceSufficient:true,sourceHash,generatedAt:checkedAt,weekLabel:"Week of October 12, 2026",contentPipeline:pipeline,importantDates},
    archive:{sources:{},questions:[]},
    fallbackQuestions:[],
  });
  const prep=result.selectableTestPrep[0];
  assert.equal(prep.date,"2026-10-15");
  assert.equal(prep.supported,true);
  assert.equal(prep.questionIds.length,12);
  const byId=new Map(result.questions.map(q=>[q.id,q]));
  assert(prep.questionIds.every(id=>byId.get(id).skill==="reading-charts"));
  const guide=result.printableGuides.find(g=>g.subject==="Reading / ELA");
  assert(guide?.focusSkills.includes("reading-charts"));
  assert.equal(result.policy.hiddenTeacherTestItemsClaimed,false);
});
test("removed chart topic cannot remain as current school practice",()=>{
  const {pipeline}=current("Grammar: subject & predicate");
  assert.equal(pipeline.qa.status,"pass");
  assert.equal(pipeline.questions.some(q=>q.skill==="reading-charts"),false);
});
test("named math operations never bleed into a different operation's test guide",()=>{
  const rows=[
    {subject:"Math",skill:"math-subtraction",id:"sub"},
    {subject:"Math",skill:"addition-within-20",id:"add"},
    {subject:"Math",skill:"math-place-value",id:"value"},
  ];
  assert.deepEqual(questionsForTest({label:"Math (subtraction)"},rows).map(q=>q.id),["sub"]);
  assert.deepEqual(questionsForTest({label:"Math (addition)"},rows).map(q=>q.id),["add"]);
  assert.deepEqual(questionsForTest({label:"Math"},rows).map(q=>q.id),["sub","add","value"]);
});
test("chart-only versus broad reading test scopes remain distinct",()=>{
  const rows=[
    {subject:"Reading / ELA",skill:"reading-charts",id:"chart"},
    {subject:"Reading / ELA",skill:"main-idea-details",id:"main"},
    {subject:"Reading / ELA",skill:"subject-predicate",id:"grammar"},
  ];
  assert.deepEqual(questionsForTest({label:"Reading (charts)"},rows).map(q=>q.id),["chart"]);
  assert.deepEqual(questionsForTest({label:"Reading"},rows).map(q=>q.id),["chart","main"]);
  assert.deepEqual(questionsForTest({label:"Reading (charts and main idea)"},rows).map(q=>q.id),["chart","main"]);
});
test("family presents original examples at Grade 2 complexity with checked answers",()=>{
  const rows=[READING_CHARTS_FAMILY.baseQuestion,...READING_CHARTS_FAMILY.supplementalQuestions];
  assert(rows.length>=READING_CHARTS_FAMILY.minimumSemanticVariants);
  assert(READING_CHARTS_FAMILY.enabledByDefault);
  assert.equal(READING_CHARTS_FAMILY.rolloutStatus,"APPROVED");
  assert.deepEqual(rows.filter(q=>q.questionType==="direct").length,4);
  assert.deepEqual(rows.filter(q=>q.questionType==="transfer").length,4);
  assert.deepEqual(rows.filter(q=>q.questionType==="reasoning").length,4);
  const answerByContext=new Map([
    ["bird-count chart","10 birds"],
    ["snack chart","4 more"],
    ["plant-growth chart","Wind"],
    ["pet-choice chart","Cats and dogs received the same number of choices."],
  ]);
  for(const [context,expected] of answerByContext){
    const row=rows.find(q=>q.prompt.includes(context));
    assert.equal(row?.answer,expected);
  }
});
