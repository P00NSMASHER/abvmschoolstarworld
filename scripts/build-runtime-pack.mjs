import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const INPUT=new URL("../pages/data/study-pack.json",import.meta.url);
const OUTPUT=new URL("../pages/data/study-pack-runtime.json",import.meta.url);
export const RUNTIME_QUESTION_FIELDS=Object.freeze([
  "id","subject","skill","questionType","prompt","choices","answer","explanation","hint","sourceFact",
  "dok","difficulty","standards","domain","contentFingerprint","variantFingerprint","richContent","choiceDiagnostics"
]);

function clone(value){return JSON.parse(JSON.stringify(value));}
function pickQuestion(question){
  return Object.fromEntries(
    RUNTIME_QUESTION_FIELDS
      .filter(key=>Object.prototype.hasOwnProperty.call(question||{},key))
      .map(key=>[key,question[key]])
  );
}
export function buildRuntimePack(envelope){
  if(!envelope?.pack?.sourceSufficient)throw new Error("Full study pack is not source-sufficient");
  const runtime=clone(envelope);
  const questions=runtime.pack?.contentPipeline?.questions;
  if(!Array.isArray(questions))throw new Error("Full study pack is missing contentPipeline.questions");
  runtime.pack.contentPipeline.questions=questions.map(pickQuestion);
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
  if(runtimeBytes>=fullBytes*.7)throw new Error("Runtime study pack did not shrink by at least 30%");
  fs.writeFileSync(OUTPUT,output,"utf8");
  console.log("Runtime study pack generated",{fullBytes,runtimeBytes,reductionPercent:Math.round((1-runtimeBytes/fullBytes)*1000)/10});
}
