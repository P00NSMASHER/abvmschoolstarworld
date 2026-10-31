/** Lesson dates, never crawl timestamps, determine the weekly notes selection. */
import {weekBounds,validCivilDay} from './study-model.mjs';
const array=value=>Array.isArray(value)?value:[];
// Public source packs may contain malformed rows; quarantine them without
// allowing missing skill IDs to become evidence for a fabricated weekly topic.
const records=value=>array(value).filter(row=>row!==null&&typeof row==='object'&&!Array.isArray(row));
const clean=value=>String(value||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
const chapter=value=>String(value||'').match(/\b(?:chapter|ch\.?)\s*(\d+)\b/i)?.[1];
export function explicitlyInWeek(row,now){
 const {start,end}=weekBounds(now);
 const dates=[row?.weekOf,row?.studiedOn].filter(value=>value!=null&&value!=='');
 // Conflicting explicit dates cannot be resolved by silently preferring one.
 return dates.length>0&&dates.every(value=>validCivilDay(value)&&value>=start&&value<=end)&&(!row?.weekOf||row.weekOf===start);
}
export function exactSkillTopics(pack,skill){
 if(!skill||typeof skill!=='object')return [];
 if(Array.isArray(skill.noteTopics))return skill.noteTopics;
 return records(pack?.subjects).filter(row=>row.subject===skill.subject).flatMap(row=>array(row.topics)).filter(topic=>typeof topic==='string'&&topic.trim()&&array(skill.sourceLineage?.matchedEvidence).some(line=>clean(line).includes(clean(topic))));
}
/** Attach only exact pipeline associations; a subject match alone is insufficient. */
export function sourceStudyNotes(pack={}){
 const skills=records(pack.contentPipeline?.skills);
 return records(pack.subjects).flatMap(subject=>{
  const topics=array(subject.topics).filter(value=>typeof value==='string'&&value.trim());
  return [
   ...topics.map(text=>({subject:subject.subject,text,kind:'topic'})),
   ...array(subject.studyNotes).filter(value=>typeof value==='string'&&value.trim()).map(text=>{
    const matched=skills.filter(skill=>skill.subject===subject.subject&&array(skill.studyNotes).includes(text));
    const linked=topics.filter(topic=>matched.some(skill=>exactSkillTopics(pack,skill).includes(topic)));
    return {subject:subject.subject,text,kind:'study-note',...(linked.length?{topics:linked}:{}),...(matched.length?{skillIds:matched.map(row=>row.id)}:{})};
   }),
  ].map(note=>({...note,...(subject.weekOf?{weekOf:subject.weekOf}:{}),...(subject.studiedOn?{studiedOn:subject.studiedOn}:{}),sourceHash:pack.sourceHash,sourceCapturedAt:pack.sourceCapturedAt}));
 });
}
export function weeklySourceNotes(pack,events,now,matchingQuestions){
 const {start,end}=weekBounds(now),tests=array(events).filter(row=>validCivilDay(row?.date)&&row.date>=start&&row.date<=end);
 const skills=records(pack.contentPipeline?.skills).filter(skill=>typeof skill.id==='string'&&skill.id.trim()&&typeof skill.subject==='string'&&skill.subject.trim());
 const ids=new Set(tests.flatMap(test=>records(matchingQuestions(test)).flatMap(q=>[q.skill,...array(q.assessedSkillIds)]))
  .filter(id=>typeof id==='string'&&id.trim()));
 const chapters=new Set(tests.filter(test=>/religion/i.test(test.label)).map(test=>chapter(test.label)).filter(Boolean));
 const selected=skills.filter(skill=>{
  if(!ids.has(skill.id))return false;
  if(skill.subject!=='Religion')return true;
  const scopes=exactSkillTopics(pack,skill).map(chapter).filter(Boolean);
  // A shared skill is not evidence that another chapter is current. Ambiguous
  // cross-chapter teaching stays cumulative; exact chapter explanations remain.
  return scopes.length>0&&scopes.every(value=>chapters.has(value));
 });
 const selectedIds=new Set(selected.map(skill=>skill.id));
 const source=sourceStudyNotes(pack);
 const topicAllowed=note=>explicitlyInWeek(note,now)||(note.subject==='Religion'?Boolean(chapter(note.text)&&chapters.has(chapter(note.text))):selected.some(skill=>skill.subject===note.subject&&exactSkillTopics(pack,skill).includes(note.text)));
 const topics=source.filter(note=>note.kind==='topic'&&topicAllowed(note));
 // Selected skill labels provide a useful box when the source has no topic row.
 for(const skill of selected)if(!topics.some(note=>note.subject===skill.subject&&exactSkillTopics(pack,skill).includes(note.text)))topics.push({subject:skill.subject,kind:'topic',text:skill.label,sourceHash:pack.sourceHash});
 const notes=source.filter(note=>note.kind!=='topic'&&(explicitlyInWeek(note,now)||array(note.skillIds).some(id=>selectedIds.has(id)))).map(note=>({...note,topics:topics.filter(topic=>topic.subject===note.subject&&selected.some(skill=>array(note.skillIds).includes(skill.id)&&(topic.text===skill.label||exactSkillTopics(pack,skill).includes(topic.text)))).map(topic=>topic.text)}));
 return [...topics,...notes];
}
