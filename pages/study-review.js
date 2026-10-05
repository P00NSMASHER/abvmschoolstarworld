/*
Adapted SM-2 calculation: SkillCoco
MIT License

Copyright (c) 2026 Gourav Shah (Initcron Systems Private Limited)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(()=>{"use strict";
// SM-2 calculation adapted from SkillCoco (MIT); see THIRD_PARTY_NOTICES.md.
const DAY=86400000,ZONE="America/New_York",DONE_KEY="abvm-daily-practice:v1";
const dayFormatter=new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"});
const day=now=>dayFormatter.format(new Date(now));
function afterDays(now,days){
  const p=Object.fromEntries(dayFormatter.formatToParts(new Date(now)).map(x=>[x.type,x.value]));
  // Noon UTC is safely within the intended Eastern school date, including DST.
  return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+days,12);
}
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const FALLBACK=Object.freeze({"two-step-word-problem":"Two-step problems","place-value":"Place value","compare-numbers":"Comparing numbers",time:"Time",measurement:"Measurement","data-interpretation":"Reading charts","addition-within-100":"Addition","subtraction-within-100":"Subtraction",inference:"Reading clues",theme:"Story lessons","text-evidence":"Finding evidence","author-purpose":"Why authors write","word-choice":"Word meanings","cause-effect":"Cause and effect"});
const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
function sm2(quality,repetitions=0,ease=2.5,interval=0){
  const q=Math.max(0,Math.min(5,Math.floor(finite(quality,0)))),r=Math.max(0,Math.floor(finite(repetitions,0))),e=Math.max(1.3,finite(ease,2.5)),i=Math.max(0,finite(interval,0));
  if(q<3)return{repetitions:0,ease:e,intervalDays:1};
  return{repetitions:r+1,ease:Math.max(1.3,e+.1-(5-q)*(.08+(5-q)*.02)),intervalDays:r===0?1:r===1?6:i*e};
}
function validReview(row,now){
  const r=row?.Review;
  return r&&r.version===1&&Number.isFinite(r.reviewedAt)&&r.reviewedAt>0&&r.reviewedAt<=now+60000&&Number.isFinite(r.dueAt)&&r.dueAt>=r.reviewedAt&&r.dueAt<=r.reviewedAt+31*DAY&&Number.isFinite(r.intervalDays)&&r.intervalDays>=1&&r.intervalDays<=30&&Number.isFinite(r.ease)&&r.ease>=1.3&&r.ease<=3.5&&Number.isInteger(r.repetitions)&&r.repetitions>=0&&r.repetitions<=100?r:null;
}
function schedule(row,{correct=false,independent=false,now=Date.now()}={}){
  if(!Number.isFinite(now)||now<=0)throw new Error("Review time must be valid");
  const prior=validReview(row,now),sameDay=prior&&day(prior.reviewedAt)===day(now);
  // Repeating a skill today must not extend its long-term interval.
  if(prior&&correct&&independent&&(sameDay||!isDue(row,now)))return{...prior};
  const next=sm2(correct&&independent?4:correct?2:1,prior?.repetitions,prior?.ease,prior?.intervalDays);
  const intervalDays=Math.max(1,Math.min(30,Math.round(next.intervalDays)));
  return{version:1,repetitions:Math.min(100,next.repetitions),ease:Math.min(3.5,next.ease),intervalDays,reviewedAt:now,dueAt:afterDays(now,intervalDays)};
}
function dueAt(row,now){
  const review=validReview(row,now);if(review)return review.dueAt;
  const last=Math.max(finite(row?.LastSeenAt,0),finite(row?.LastResolution?.resolvedAt,0));
  return last>0&&last<=now+60000?afterDays(last,1):null;
}
function isDue(row,now=Date.now()){
  const at=dueAt(row,now);return at!==null&&day(at)<=day(now);
}
function candidates(pack={}){
  const result=new Map(Object.entries(FALLBACK).map(([id,label])=>[id,{id,label}]));
  for(const skill of pack?.contentPipeline?.skills||[])if(typeof skill?.id==="string"&&skill.id.trim())result.set(skill.id,{id:skill.id,label:String(skill.label||skill.id)});
  return result;
}
function dueSkills(pack,learning={},now=Date.now()){
  return [...candidates(pack).values()].filter(s=>isDue(learning[s.id],now)).sort((a,b)=>dueAt(learning[a.id],now)-dueAt(learning[b.id],now)||a.id.localeCompare(b.id));
}
function completion(now=Date.now()){
  try{const r=JSON.parse(localStorage.getItem(DONE_KEY)||"null");return r?.day===day(now)&&Number.isFinite(r.completedAt)&&r.completedAt<=now+60000?r:null}catch{return null}
}
function complete(now=Date.now()){
  try{localStorage.setItem(DONE_KEY,JSON.stringify({day:day(now),completedAt:now}));return true}catch{return false}
}
function render({pack={},learning={},now=Date.now()}={}){
  const due=dueSkills(pack,learning,now),done=completion(now),count=due.length;
  const title=done?"Today’s practice is complete":"A little practice, every day";
  const copy=done?"Nice work. Come back tomorrow, or keep exploring at your own pace.":count?count+' skill'+(count===1?' is':'s are')+' ready for another look. We’ll mix a short review with school skills.':"Eight questions, one step at a time. School skills come first, with Grade 2 practice to fill the gaps.";
  return '<section class="daily-practice" aria-labelledby="daily-practice-title"><p class="daily-eyebrow">'+(done?'DONE FOR TODAY':'YOUR DAILY PRACTICE')+'</p><h2 id="daily-practice-title">'+title+'</h2><p>'+copy+'</p>'+(count&&!done?'<ul aria-label="Skills to revisit">'+due.slice(0,3).map(s=>'<li>'+esc(s.label)+'</li>').join('')+'</ul>':'')+'<button type="button" data-subject-practice="daily">'+(done?'Practice a little more':'Start 5-minute practice')+'<span aria-hidden="true">›</span></button><small>Hints are always available. No timer. Progress stays on this device.</small></section>';
}
window.ABVMStudyReview=Object.freeze({sm2,schedule,validReview,dueAt,isDue,dueSkills,complete,completion,render});
})();
