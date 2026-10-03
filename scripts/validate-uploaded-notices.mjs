import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {noticeHash} from "./integrate-uploaded-notices.mjs";
import {validateUploadedNoticePolicy} from "./uploaded-notice-policy.mjs";

const NOTICES_PATH=new URL("../pages/data/uploaded-notices.json",import.meta.url);
const PACK_PATH=new URL("../pages/data/study-pack.json",import.meta.url);

const sortedUnique=values=>[...new Set(values)].sort();
const sameValues=(left,right)=>JSON.stringify(sortedUnique(left))===JSON.stringify(sortedUnique(right));

export function validateUploadedNoticeIntegration(data,uploaded){
  const errors=[],pack=data?.pack||{},metadata=data?.uploadedNotices||{};
  const expectedHash=noticeHash(uploaded);
  if(pack.uploadedNoticeHash!==expectedHash)errors.push("study-pack uploadedNoticeHash does not match uploaded-notices.json");
  if(metadata.count!==uploaded.documents.length)errors.push("study-pack uploaded notice count is stale");
  if(metadata.latestIntegratedAt!==uploaded.lastIntegratedAt)errors.push("study-pack latestIntegratedAt is stale");

  const expectedDocuments=uploaded.documents.map(({id,label,receivedAt})=>({id,label,receivedAt}));
  if(JSON.stringify(metadata.documents||[])!==JSON.stringify(expectedDocuments))errors.push("study-pack uploaded notice document receipt is stale");

  const dates=new Set((pack.importantDates||[]).map(item=>[item.date,item.label,item.sourceDocument].join("\u0000")));
  for(const item of uploaded.importantDates||[]){
    if(!dates.has([item.date,item.label,item.sourceDocument].join("\u0000")))errors.push(`missing important date from ${item.sourceDocument}: ${item.label}`);
  }
  const reminders=new Set(pack.reminders||[]),parentNotices=new Set(pack.parentNotices||[]);
  for(const item of uploaded.reminders||[])if(!reminders.has(item.text))errors.push(`missing reminder topic: ${item.topic}`);
  for(const item of uploaded.parentNotices||[])if(!parentNotices.has(item.text))errors.push(`missing parent notice topic: ${item.topic}`);

  for(const field of ["reminders","parentNotices"]){
    const expected=(uploaded[field]||[]).map(item=>item.topic);
    const actual=pack.uploadedNoticeTopics?.[field]||[];
    if(!sameValues(actual,expected))errors.push(`study-pack ${field} topic receipt is stale`);
  }
  if(errors.length)throw new Error("Uploaded notice integration is stale:\n- "+errors.join("\n- ")+"\nRun node scripts/integrate-uploaded-notices.mjs.");
  return{documents:uploaded.documents.length,uploadedNoticeHash:expectedHash,lastIntegratedAt:uploaded.lastIntegratedAt};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const uploaded=JSON.parse(readFileSync(NOTICES_PATH,"utf8"));
  const data=JSON.parse(readFileSync(PACK_PATH,"utf8"));
  const policy=validateUploadedNoticePolicy(uploaded);
  const integration=validateUploadedNoticeIntegration(data,uploaded);
  console.log("Uploaded notice policy and integration passed",{...policy,...integration});
}
