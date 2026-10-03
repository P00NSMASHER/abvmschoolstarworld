import {createHash} from "node:crypto";
import {readFileSync, writeFileSync} from "node:fs";
import {validateUploadedNoticePolicy} from "./uploaded-notice-policy.mjs";

const DATA_PATH=new URL("../pages/data/study-pack.json",import.meta.url);
const NOTICES_PATH=new URL("../pages/data/uploaded-notices.json",import.meta.url);

const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};

function dateKey(value){
  const m=String(value||"").match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!m)return "";
  return `${m[1].replace(".","").toLowerCase()}-${Number(m[2])}`;
}
function topicKey(value){
  const label=String(value||"").toLowerCase();
  const patterns=[
    ["star",/\bstar\b/],["mass-communication",/mass.*communication|communication.*mass/],
    ["communication-folder",/communication folder/],["mass",/\bmass\b/],
    ["stationery",/stationa(?:ry|ery).*money/],["pretzel",/pretzel/],["dress-down",/dress down/],
    ["lego",/lego club/],["hsa",/hsa.*meeting/],["picture",/picture day/],["closed",/no school|closed/],
    ["dismissal",/dismissal/],["conference-schedule",/conference schedule portal/],["conference",/conference/],
    ["dance",/welcome back dance/],["chick-fil",/chick[-\s]?fil[-\s]?a/],["flag-football",/flag football/],
    ["door-decorating",/door decorating/],["winter-uniform",/winter (?:uniform|dress code)/],
    ["progress-report",/progress report/],["raise-right",/raise right/],
    ["student-council",/student council/],["red-ribbon",/red ribbon/],
    ["halloween",/halloween/],["birthday-party",/birthday party/],["cyo-basketball",/cyo.*basketball|basketball.*cyo/],
    ["schwartz",/schwartz/],["spelling",/spelling/],["subtraction",/subtraction/],
    ["grammar",/grammar|types of sentences/],["addition",/addition/]
  ];
  return patterns.find(([,pattern])=>pattern.test(label))?.[0]
    || label.replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(word=>word.length>3).slice(0,3).join("-");
}
function eventTime(value,now=new Date()){
  const m=String(value||"").match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!m)return Number.MAX_SAFE_INTEGER;
  const month=MONTHS[m[1].replace(".","").toLowerCase()];
  let year=now.getUTCFullYear();
  if(now.getUTCMonth()>=7&&month<=5)year++;
  if(now.getUTCMonth()<=5&&month>=7)year--;
  return Date.UTC(year,month,Number(m[2]));
}
function mergeEvents(existing,uploaded,now){
  const incoming=uploaded.importantDates.map(item=>({...item,source:"uploaded-notice"}));
  const incomingKeys=new Set(incoming.map(item=>`${dateKey(item.date)}:${topicKey(item.label)}`));
  const replacementKeys=new Set(uploaded.replacements.map(item=>`${dateKey(item.date)}:${item.topic}`));
  const kept=(existing||[]).filter(item=>{
    if(item.source==="uploaded-notice")return false;
    const key=`${dateKey(item.date)}:${topicKey(item.label)}`;
    return !incomingKeys.has(key)&&!replacementKeys.has(key);
  });
  return [...kept,...incoming].sort((a,b)=>{
    const d=eventTime(a.date,now)-eventTime(b.date,now);
    if(d)return d;
    return Number(b.source==="uploaded-notice")-Number(a.source==="uploaded-notice");
  });
}
function mergeText(existing,incoming,previousTopics=[]){
  const topics=new Set([...previousTopics,...incoming.map(item=>item.topic)]);
  const kept=(existing||[]).filter(text=>!topics.has(topicKey(text)));
  return [...new Set([...incoming.map(item=>item.text),...kept])];
}
function noticeHash(uploaded){
  return "uploaded-notices-"+createHash("sha256").update(JSON.stringify(uploaded)).digest("hex").slice(0,20);
}
export function integrateUploadedNotices(data,uploaded,{now=new Date()}={}){
  validateUploadedNoticePolicy(uploaded);
  const pack=data.pack||{};
  const nextHash=noticeHash(uploaded);
  const changed=pack.uploadedNoticeHash!==nextHash;
  pack.importantDates=mergeEvents(pack.importantDates,uploaded,now);
  pack.reminders=mergeText(pack.reminders,uploaded.reminders,pack.uploadedNoticeTopics?.reminders);
  pack.parentNotices=mergeText(pack.parentNotices,uploaded.parentNotices,pack.uploadedNoticeTopics?.parentNotices);
  pack.uploadedNoticeTopics={
    reminders:[...new Set(uploaded.reminders.map(item=>item.topic))],
    parentNotices:[...new Set(uploaded.parentNotices.map(item=>item.topic))]
  };
  pack.uploadedNoticeHash=nextHash;
  if(changed){
    const stamp=now.toISOString();
    pack.sourceCapturedAt=stamp;
    pack.generatedAt=stamp;
    data.sourceCapturedAt=stamp;
  }
  const countSentence=`${uploaded.documents.length} uploaded school notices are integrated with the teacher pages.`;
  if(/\d+ uploaded school notices are integrated with the teacher pages\./.test(String(pack.summary||""))){
    pack.summary=String(pack.summary).replace(/\d+ uploaded school notices are integrated with the teacher pages\./,countSentence);
  }
  if(Date.parse(uploaded.lastIntegratedAt)>Date.parse(data.sourceLastSeenAt||0))data.sourceLastSeenAt=uploaded.lastIntegratedAt;
  data.uploadedNotices={
    count:uploaded.documents.length,
    latestIntegratedAt:uploaded.lastIntegratedAt,
    documents:uploaded.documents.map(({id,label,receivedAt})=>({id,label,receivedAt}))
  };
  data.pack=pack;
  return{data,changed,uploadedNoticeHash:nextHash};
}

const data=JSON.parse(readFileSync(DATA_PATH,"utf8"));
const before=JSON.stringify(data);
const uploaded=JSON.parse(readFileSync(NOTICES_PATH,"utf8"));
const result=integrateUploadedNotices(data,uploaded,{now:new Date()});
const after=JSON.stringify(result.data);
if(after!==before){
  writeFileSync(DATA_PATH,JSON.stringify(result.data,null,2)+"\n","utf8");
  console.log("Integrated uploaded school notices",{count:uploaded.documents.length,uploadedNoticeHash:result.uploadedNoticeHash});
}else{
  console.log("Uploaded school notices already integrated",{count:uploaded.documents.length,uploadedNoticeHash:result.uploadedNoticeHash});
}
