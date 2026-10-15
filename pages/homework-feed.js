(()=>{
"use strict";
const SOURCE_URL="https://sites.google.com/view/abvmgr2/homework";
const SUBJECTS=new Set(["Math","Spelling","Reading","Religion","Parent"]);
const stamp=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"});
const schoolKey=date=>{
  const d=date instanceof Date?date:new Date(date);
  if(!Number.isFinite(d.getTime()))return "";
  const values=Object.fromEntries(stamp.formatToParts(d).map(part=>[part.type,part.value]));
  return values.year+"-"+values.month+"-"+values.day;
};
const routine=task=>/^(?:read|read\s+\d+\s*(?:min(?:ute)?s?)?)$/i.test(task)
  ||/cover books|reading log|behavior chart|everything should be returned|return everything in the hw folder|attend mass/i.test(task);
function validate(data){
  if(!data||data.schemaVersion!==1||data.sourceUrl!==SOURCE_URL||data.sourceDateProvided!==false||
    !["assignments","no-homework","no-specific-posting"].includes(data.status)||
    !Array.isArray(data.assignments)||data.assignments.length>20||
    !/^[a-f0-9]{64}$/i.test(String(data.contentHash||""))||
    !Number.isFinite(Date.parse(data.checkedAt))||
    !Number.isFinite(Date.parse(data.firstObservedAt))||
    !Number.isFinite(Date.parse(data.contentChangedAt)))throw Error("Invalid verified Homework feed");
  for(const row of data.assignments){
    if(!row||!SUBJECTS.has(row.subject)||typeof row.task!=="string"||
      !row.task.trim()||row.task.length>220||routine(row.task))throw Error("Invalid or standing Homework item");
  }
  if((data.status==="assignments")!==(data.assignments.length>0))throw Error("Homework posting status is inconsistent");
  if(Date.parse(data.firstObservedAt)>Date.parse(data.checkedAt)||
    Date.parse(data.contentChangedAt)>Date.parse(data.checkedAt))
    throw Error("Invalid verified Homework observation order");
  return data;
}
function forDate(data,dateKey,now=new Date()){
  const current=schoolKey(now);
  if(dateKey!==current)return{state:"other-day",assignments:[]};
  if(!data)return{state:"unverified",assignments:[]};
  let feed;
  try{feed=validate(data);}catch{return{state:"unverified",assignments:[]};}
  const checked=new Date(feed.checkedAt),firstObserved=new Date(feed.firstObservedAt),age=now.getTime()-checked.getTime();
  // An undated posting is safe to treat as today's homework only on the
  // Eastern school day when this exact content was first observed. Rechecking
  // unchanged text tomorrow proves source availability, not a new assignment.
  if(schoolKey(firstObserved)!==current||schoolKey(checked)!==current||age< -5*60*1000||age>30*60*60*1000)
    return{state:"outdated",checkedAt:feed.checkedAt,firstObservedAt:feed.firstObservedAt,
      contentChangedAt:feed.contentChangedAt,assignments:[]};
  return{state:feed.status,checkedAt:feed.checkedAt,firstObservedAt:feed.firstObservedAt,
    contentChangedAt:feed.contentChangedAt,assignments:feed.assignments};
}
window.ABVMHomeworkFeed=Object.freeze({validate,forDate,schoolKey,sourceUrl:SOURCE_URL});
})();