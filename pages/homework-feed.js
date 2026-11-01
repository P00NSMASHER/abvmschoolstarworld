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
// Verified source checks must carry an unambiguous, real civil timestamp.
// Date.parse alone accepts timezone-less values and normalizes Feb 30.
function validObservationTime(value){
  if(typeof value!=="string")return false;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match)return false;
  const [,yearText,monthText,dayText,hourText,minuteText,secondText,zone]=match;
  const year=Number(yearText),month=Number(monthText),day=Number(dayText);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1]||
     Number(hourText)>23||Number(minuteText)>59||Number(secondText)>59)return false;
  if(zone!=="Z"){
    const offsetHours=Number(zone.slice(1,3)),offsetMinutes=Number(zone.slice(4,6));
    if(offsetHours>14||offsetMinutes>59||(offsetHours===14&&offsetMinutes!==0))return false;
  }
  return Number.isFinite(Date.parse(value));
}
function validate(data){
  if(!data||data.schemaVersion!==1||data.sourceUrl!==SOURCE_URL||data.sourceDateProvided!==false||
    !["assignments","no-homework","no-specific-posting"].includes(data.status)||
    !Array.isArray(data.assignments)||data.assignments.length>20||
    !/^[a-f0-9]{64}$/i.test(String(data.contentHash||""))||
    !validObservationTime(data.checkedAt)||
    !validObservationTime(data.firstObservedAt)||
    !validObservationTime(data.contentChangedAt))throw Error("Invalid verified Homework feed");
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
  // A successful check today can report the current state of the page even if
  // an empty or explicit no-homework message first appeared yesterday. Only
  // actionable undated assignments require first observation on this school day:
  // an unchanged recheck never promotes yesterday's tasks into today's work.
  const checkedToday=schoolKey(checked)===current&&age>=-5*60*1000&&age<=30*60*60*1000;
  const assignmentsObservedToday=schoolKey(firstObserved)===current;
  if(!checkedToday)
    return{state:"outdated",checkedAt:feed.checkedAt,firstObservedAt:feed.firstObservedAt,
      contentChangedAt:feed.contentChangedAt,assignments:[],reason:"verification-stale"};
  if(feed.status==="assignments"&&!assignmentsObservedToday)
    return{state:"outdated",checkedAt:feed.checkedAt,firstObservedAt:feed.firstObservedAt,
      contentChangedAt:feed.contentChangedAt,assignments:[],reason:"undated-carryover"};
  return{state:feed.status,checkedAt:feed.checkedAt,firstObservedAt:feed.firstObservedAt,
    contentChangedAt:feed.contentChangedAt,assignments:feed.assignments};
}
function viewSignature(data,dateKey,now=new Date()){
  const state=forDate(data,dateKey,now);
  return JSON.stringify([state.state,state.assignments,state.firstObservedAt,state.contentChangedAt]);
}
window.ABVMHomeworkFeed=Object.freeze({validate,forDate,viewSignature,schoolKey,sourceUrl:SOURCE_URL});
})();
