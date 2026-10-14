import {createHash} from 'node:crypto';
import {parseHomework} from './teacher-page-parsers.mjs';

export const HOMEWORK_SOURCE_URL = 'https://sites.google.com/view/abvmgr2/homework';
const VALID_SUBJECTS = new Set(['Math','Spelling','Reading','Religion','Parent']);
const standingRoutine = task => /^(?:read|read\s+\d+\s*(?:min(?:ute)?s?)?)$/i.test(task)
  || /cover books|reading log|behavior chart|everything should be returned|return everything in the hw folder|attend mass/i.test(task);

export function summarizeTeacherHomework(lines,checkedAt=new Date().toISOString(),previous=null) {
  if(!Array.isArray(lines) || !lines.some(line=>/^Homework\s*:?\s*$/i.test(String(line).trim()))) {
    throw new Error('Official homework heading not verified.');
  }
  const rows=parseHomework(lines);
  const items=rows.filter(row=>VALID_SUBJECTS.has(row.subject) && !standingRoutine(row.task))
    .map(({subject,task})=>({subject,task:String(task).trim()}))
    .filter(row=>row.task.length>0);
  const unique=[...new Map(items.map(row=>[row.subject+'|'+row.task.toLowerCase(),row])).values()];
  if(unique.length>20)throw new Error('Homework page has an implausible number of assignments.');
  const explicitNoHomework=rows.some(row=>row.subject==='Homework' && /^no homework assigned$/i.test(row.task));
  const status=unique.length?'assignments':explicitNoHomework?'no-homework':'no-specific-posting';
  const contentHash=createHash('sha256').update(JSON.stringify({status,assignments:unique})).digest('hex');
  const priorDate=Date.parse(previous?.firstObservedAt||'');
  const firstObservedAt=previous?.contentHash===contentHash&&Number.isFinite(priorDate)
    ? previous.firstObservedAt : checkedAt;
  return {schemaVersion:1,sourceUrl:HOMEWORK_SOURCE_URL,sourceDateProvided:false,
    status,checkedAt,firstObservedAt,contentHash,assignments:unique};
}
const easternDay=value=>{
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date).map(part=>[part.type,part.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
};
export function shouldPublishHomework(candidate,previous,{hours=18}={}) {
  if(!previous || previous.schemaVersion!==1 || previous.contentHash!==candidate.contentHash)return true;
  // Never leave yesterday's validated posting hidden all morning merely because
  // its last publication was fewer than 18 hours ago.
  if(easternDay(candidate.checkedAt)!==easternDay(previous.checkedAt))return true;
  return Date.parse(candidate.checkedAt)-Date.parse(previous.checkedAt)>=hours*3600000;
}
