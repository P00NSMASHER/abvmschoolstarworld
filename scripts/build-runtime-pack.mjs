import {exactSkillTopics} from '../pages/study-notes-scope.mjs';
import {correctOriginalQuestion} from './question-corrections.mjs';
import fs from "node:fs";
import {religionChapterScopes} from "../pages/study-hub-core.mjs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const INPUT=new URL("../pages/data/study-pack.json",import.meta.url);
const OUTPUT=new URL("../pages/data/study-pack-runtime.json",import.meta.url);
export const RUNTIME_QUESTION_FIELDS=Object.freeze([
  "id","subject","skill","questionType","prompt","choices","answer","explanation","hint",
  "dok","difficulty","standards","domain","variantFingerprint","richContent","choiceDiagnostics","sourceChapters","sourceTestScopes"
]);

function clone(value){return JSON.parse(JSON.stringify(value));}
function religionGuideFacts(skills){
  const chapters=new Map();
  for(const skill of skills||[])for(const evidence of skill?.sourceLineage?.matchedEvidence||[]){
    const match=String(evidence).match(/^\s*Chapter\s+([1-9]\d*)\s*:/i);
    if(!match)continue;
    const facts=String(evidence).split(/\s*\*\s*/).slice(1).map(value=>value.trim()).filter(Boolean);
    if(!chapters.has(match[1]))chapters.set(match[1],[]);
    const saved=chapters.get(match[1]);
    for(const fact of facts)if(!saved.includes(fact))saved.push(fact);
  }
  return Object.fromEntries([...chapters.entries()].sort((a,b)=>Number(a[0])-Number(b[0])));
}
function pickQuestion(question){
  question=correctOriginalQuestion(question);
  // This public pack gets compact instructional content, never governance metadata.
  const picked=Object.fromEntries(
    RUNTIME_QUESTION_FIELDS
      .filter(key=>key!=="sourceChapters"&&Object.prototype.hasOwnProperty.call(question||{},key))
      .map(key=>[key,question[key]])
  );
  // contentFingerprint and sourceFact remain in the governed full pack. The browser
  // does not consume sourceFact, and variantFingerprint is its stable item identity.
  // Preserve that identity if an older row only has contentFingerprint.
  if(!picked.variantFingerprint&&question?.contentFingerprint)picked.variantFingerprint=question.contentFingerprint;
  const l=question?.sourceLineage;
  const validLineage=l?.quality==="page-exact" &&
    /^https:\/\/sites\.google\.com\//.test(l.sourceUrl||"") &&
    /^[a-fA-F0-9]{64}$/.test(l.sourceCaptureHash||"") &&
    /^sha256:[a-f0-9]{64}$/.test(l.evidenceExcerptHash||"");
  if(question?.subject==="Reading / ELA"&&validLineage){
    const scopes=new Set();
    for(const entry of l.matchedEvidence||[]){
      if(typeof entry!=="string")continue;
      for(const match of entry.matchAll(/\bunit\s*(\d+)\s*text\s*set\s*(\d+)\b/gi)){
        scopes.add("Unit "+Number(match[1])+" Text Set "+Number(match[2]));
      }
    }
    if(scopes.size)picked.sourceTestScopes=[...scopes];
  }
  if(question?.subject==="Religion"&&validLineage){
    const scopes=religionChapterScopes({subject:"Religion",sourceLineage:l});
    if(scopes.length)picked.sourceChapters=scopes;
  }
  return picked;
}
export function buildRuntimePack(envelope){
  if(!envelope?.pack?.sourceSufficient)throw new Error("Full study pack is not source-sufficient");
  const runtime=clone(envelope);
  const questions=runtime.pack?.contentPipeline?.questions;
  if(!Array.isArray(questions))throw new Error("Full study pack is missing contentPipeline.questions");
  runtime.pack.contentPipeline.questions=questions.map(pickQuestion);
  const skills=runtime.pack.contentPipeline.skills;
  if(!Array.isArray(skills))throw new Error("Full study pack is missing contentPipeline.skills");
  // Audit lineage and assessment contracts stay intact in the governed full pack.
  // Phone/tablet clients use the skill ID, label and teaching notes, not hashes
  // or raw teacher evidence repeated once for every skill in the runtime pack.
  const scopedReligionFacts=religionGuideFacts(envelope.pack.contentPipeline.skills);
  if(Object.keys(scopedReligionFacts).length)runtime.pack.testGuideFacts={religionChapters:scopedReligionFacts};
  runtime.pack.contentPipeline.skills=skills.map(({sourceLineage,evidenceContract,...skill})=>({...skill,noteTopics:exactSkillTopics(envelope.pack,{...skill,sourceLineage})}));
  // The 14-day review bank may retain previously verified question families.
  // Those full records carry large governance-only source/evidence fields;
  // compact them exactly like current questions, but keep dated expiry proof.
  const reviewQuestions=runtime.pack?.recentReviewPipeline?.questions;
  if(!Array.isArray(reviewQuestions))throw new Error("Full study pack is missing recentReviewPipeline.questions");
  runtime.pack.recentReviewPipeline.questions=reviewQuestions.map(question=>{
    if(!["reviewVerifiedAt","reviewExpiresAt","reviewSourceHash"].every(field=>
      typeof question?.[field]==="string"&&question[field].trim())){
      throw new Error("Recent-review question is missing its verified source or expiry window");
    }
    const picked=pickQuestion(question);
    for(const field of ["reviewVerifiedAt","reviewExpiresAt","reviewSourceHash"])picked[field]=question[field];
    return picked;
  });
  return runtime;
}
export function runtimePackJson(envelope){
  return JSON.stringify(buildRuntimePack(envelope))+"\n";
}

const isDirect=process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]);
if(isDirect){
  const source=JSON.parse(fs.readFileSync(INPUT,"utf8"));
  const output=runtimePackJson(source);
  const fullBytes=Buffer.byteLength(JSON.stringify(source),"utf8");
  const runtimeBytes=Buffer.byteLength(output,"utf8");
  if(runtimeBytes>=fullBytes*.7){
    const reductionPercent=Math.round((1-runtimeBytes/fullBytes)*1000)/10;
    throw new Error(`Runtime study pack did not shrink by at least 30% (fullBytes=${fullBytes}, runtimeBytes=${runtimeBytes}, reductionPercent=${reductionPercent})`);
  }
  fs.writeFileSync(OUTPUT,output,"utf8");
  console.log("Runtime study pack generated",{fullBytes,runtimeBytes,reductionPercent:Math.round((1-runtimeBytes/fullBytes)*1000)/10});
}
