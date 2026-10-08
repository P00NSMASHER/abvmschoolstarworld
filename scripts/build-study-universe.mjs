import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const normalize=value=>String(value??"").normalize("NFKC").replace(/\s+/g," ").trim();
const key=value=>normalize(value).toLowerCase();
const slug=value=>key(value).replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");

function schoolDate(text,year){
  const match=normalize(text).match(/(?:^|,\s*)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})\b/i);
  if(!match)return null;
  const month=MONTHS[match[1].toLowerCase()],day=Number(match[2]);
  if(month===undefined||day<1||day>31)return null;
  return new Date(Date.UTC(year,month,day,12)).toISOString().slice(0,10);
}

function checkedQuestion(row,tier){
  if(!row||typeof row!=="object")throw new Error("Question must be an object");
  const required=["id","subject","skill","prompt","answer","explanation","sourceFact"];
  for(const field of required)if(!normalize(row[field]))throw new Error(`Question ${row.id||"(unknown)"} is missing ${field}`);
  if(!Array.isArray(row.choices)||row.choices.length<2||row.choices.length>4)throw new Error(`Question ${row.id} has invalid choices`);
  const choices=row.choices.map(normalize);
  if(choices.some(choice=>!choice)||new Set(choices.map(key)).size!==choices.length)throw new Error(`Question ${row.id} has duplicate or empty choices`);
  const answer=normalize(row.answer);
  if(choices.filter(choice=>choice===answer).length!==1)throw new Error(`Question ${row.id} answer is not exactly one choice`);
  return {id:normalize(row.id),subject:normalize(row.subject),skill:normalize(row.skill),prompt:normalize(row.prompt),choices,answer,
    explanation:normalize(row.explanation),hint:normalize(row.hint)||"Read the question again and look for a helpful clue.",
    questionType:normalize(row.questionType)||"practice",difficulty:row.difficulty??2,dok:row.dok??1,
    sourceFact:normalize(row.sourceFact),tier};
}

function unique(rows){
  const seen=new Set();return rows.filter(row=>{const fingerprint=key(row.prompt)+"\0"+key(row.answer);if(seen.has(fingerprint))return false;seen.add(fingerprint);return true;});
}
function roundRobin(groups,limit){
  const queues=[...groups.values()].map(rows=>[...rows]),result=[];
  while(result.length<limit&&queues.some(queue=>queue.length))for(const queue of queues)if(queue.length&&result.length<limit)result.push(queue.shift());
  return result;
}
function groupBy(rows,field){
  const out=new Map();for(const row of rows){const name=normalize(row[field])||"Other";if(!out.has(name))out.set(name,[]);out.get(name).push(row);}return out;
}
function testTokens(label){return slug(label).split("-").filter(token=>token.length>2&&!new Set(["test","chapter","handwriting","thursday","friday","monday","tuesday","wednesday"]).has(token));}
function testScore(question,label){
  const hay=key([question.subject,question.skill,question.sourceFact].join(" ")),tokens=testTokens(label);
  let score=tokens.filter(token=>hay.includes(token)).length;
  if(/math/i.test(label)&&/math/i.test(question.subject))score+=2;
  if(/religion/i.test(label)&&/religion/i.test(question.subject))score+=2;
  if(/spelling/i.test(label)&&/spelling|handwriting/i.test(question.subject))score+=2;
  if(/grammar/i.test(label)&&/grammar|subject|predicate/i.test(hay))score+=2;
  if(/reading/i.test(label)&&/reading|ela/i.test(question.subject))score+=2;
  return score;
}
function pickTiered(pools,limit,predicate=()=>true){return unique(pools.flatMap(rows=>rows.filter(predicate))).slice(0,limit);}

export function buildStudyUniverse({pack:wrapper,archive={},fallbackQuestions=[]}={}){
  const pack=wrapper?.pack||wrapper;
  if(!pack?.sourceSufficient||pack?.contentPipeline?.qa?.status!=="pass")throw new Error("A source-sufficient, QA-passed study pack is required");
  const current=unique((pack.contentPipeline.questions||[]).map(row=>checkedQuestion(row,"current")));
  const archiveRows=unique((archive.questions||[]).map(row=>checkedQuestion(row,"archive")));
  const fallback=unique(fallbackQuestions.map(row=>checkedQuestion(row,"star-fallback")));
  if(!current.length)throw new Error("Current reviewed questions are required");
  const subjects=[...new Set(current.map(row=>row.subject))].sort();
  const currentBySubject=groupBy(current,"subject"),archiveBySubject=groupBy(archiveRows,"subject"),fallbackBySubject=groupBy(fallback,"subject");
  const practice=Object.fromEntries(subjects.map(subject=>[subject,pickTiered([
    currentBySubject.get(subject)||[],archiveBySubject.get(subject)||[],fallbackBySubject.get(subject)||[]
  ],12).map(row=>row.id)]));
  const mixedReview=roundRobin(groupBy(unique([...current,...archiveRows,...fallback]),"subject"),16).map(row=>row.id);
  const asOf=new Date(pack.generatedAt||pack.sourceCapturedAt||Date.now());
  const year=asOf.getUTCFullYear(),asOfDay=asOf.toISOString().slice(0,10);
  const tests=(pack.importantDates||[]).filter(item=>item?.kind==="test").map(item=>({...item,isoDate:schoolDate(item.date,year)}))
    .filter(item=>item.isoDate&&item.isoDate>=asOfDay).sort((a,b)=>a.isoDate.localeCompare(b.isoDate)||key(a.label).localeCompare(key(b.label)));
  const selectableTestPrep=tests.map(test=>{
    const ranked=[...current,...archiveRows,...fallback].map(row=>({row,score:testScore(row,test.label)})).filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||({current:0,archive:1,"star-fallback":2}[a.row.tier]-({current:0,archive:1,"star-fallback":2}[b.row.tier]))||a.row.id.localeCompare(b.row.id));
    return {id:`test-${test.isoDate}-${slug(test.label)}`,date:test.isoDate,label:normalize(test.label),source:normalize(test.source)||"governed-school-source",
      questionIds:unique(ranked.map(x=>x.row)).slice(0,12).map(row=>row.id),disclaimer:"Original practice for the named skill; not hidden teacher-test content and not an official STAR item."};
  });
  const questionMap=new Map([...current,...archiveRows,...fallback].map(row=>[row.id,row]));
  const printableGuides=subjects.map(subject=>{
    const ids=practice[subject]||[],questions=ids.map(id=>questionMap.get(id)).filter(Boolean),subjectRow=(pack.subjects||[]).find(row=>normalize(row.subject)===subject);
    return {id:`guide-${slug(subject)}`,subject,title:`${subject} one-page study guide`,notes:[...(subjectRow?.studyNotes||[])].map(normalize).filter(Boolean).slice(0,6),
      focusSkills:[...new Set(questions.map(row=>row.skill))].slice(0,6),questionIds:ids.slice(0,6),sourceFacts:[...new Set(questions.map(row=>row.sourceFact))].slice(0,6)};
  });
  const verticalScripts=subjects.map(subject=>{
    const questions=(practice[subject]||[]).slice(0,3).map(id=>questionMap.get(id)).filter(Boolean);
    return {id:`vertical-${slug(subject)}`,subject,title:`60-second ${subject} practice`,format:"9:16 storyboard",disclaimer:"Original practice; not an official STAR item or score prediction.",beats:questions.map((row,index)=>({seconds:index===0?"0-18":index===1?"18-38":"38-58",prompt:row.prompt,pause:"Pause and choose an answer.",answer:row.answer,explanation:row.explanation}))};
  });
  const curriculumPackets=subjects.map(subject=>({id:`roblox-${slug(subject)}`,subject,room:subject,questionIds:(practice[subject]||[]).slice(0,12),
    answerAuthority:"server-only",wrongAnswerBehavior:"Show a hint and allow a retry; no punishment.",sourceOrder:["current","archive","star-fallback"],
    fallbackRule:"Use original STAR-style fallback only after current and cumulative reviewed questions are exhausted."}));
  const questions=unique([...current,...archiveRows,...fallback]);
  return {schemaVersion:1,contentOnly:true,generatedAt:pack.generatedAt||pack.sourceCapturedAt,schoolTimeZone:"America/New_York",
    source:{repository:"P00NSMASHER/abvmschoolstarworld",sourceHash:pack.sourceHash,sourceCheckedAt:pack.sourceCheckedAt||pack.generatedAt,weekLabel:pack.weekLabel},
    policy:{priorityOrder:["current-school-material","cumulative-reviewed-material","original-star-style-fallback"],privateLearnerDataIncluded:false,officialStarItems:false,
      hiddenTeacherTestItemsClaimed:false,selectionNote:"A private learning queue may choose a skill, but its evidence and learner history must never be exported."},
    questions,currentSubjectPractice:practice,mixedReview,selectableTestPrep,printableGuides,verticalScripts,curriculumPackets};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
  const pack=JSON.parse(fs.readFileSync(path.join(root,"pages/data/study-pack.json"),"utf8"));
  const archive=JSON.parse(fs.readFileSync(path.join(root,"pages/data/study-archive.json"),"utf8"));
  const {buildStarBank}=await import("../pages/star-practice.mjs");
  const output=buildStudyUniverse({pack,archive,fallbackQuestions:buildStarBank()});
  const destination=path.resolve(process.argv[2]||path.join(root,"artifacts/study-universe.json"));
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(output,null,2)+"\n");
  console.log(JSON.stringify({output:destination,questions:output.questions.length,tests:output.selectableTestPrep.length,guides:output.printableGuides.length,scripts:output.verticalScripts.length,packets:output.curriculumPackets.length}));
}
