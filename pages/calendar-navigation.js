/* ABVM Calendar-only date navigation and month grid.
   The school data remains governed by app.js. No network, storage, or
   shadow copies of the planner state. Kept separate to respect the 60KB
   application-controller hygiene ceiling. */
(()=>{"use strict";
const sameDay=(a,b)=>!!a&&!!b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const mondayOf=date=>{
 const result=new Date(date);result.setHours(12,0,0,0);
 const weekday=result.getDay();result.setDate(result.getDate()-(weekday===0?6:weekday-1));
 return result;
};
function weekForDate(date,referenceMonday){
 const selected=new Date(date),monday=mondayOf(selected);
 const weekend=[0,6].includes(selected.getDay());
 if(weekend)monday.setDate(monday.getDate()+7);
 return{offset:Math.round((monday-referenceMonday)/604800000),
  selected:weekend?monday:selected};
}
function monthForDate(date,current){
 const selected=new Date(date);
 return{offset:(selected.getFullYear()-current.getFullYear())*12+
   selected.getMonth()-current.getMonth(),selected};
}
function monthGrid({year,month,selected,current,eventsForDate,lunchForDate,kindClass,fmtDate,esc}){
 const first=new Date(year,month,1,12),last=new Date(year,month+1,0,12);
 let html="";
 for(let i=0;i<first.getDay();i++)html+='<span class="calendar-blank" aria-hidden="true"></span>';
 for(let day=1;day<=last.getDate();day++){
  const date=new Date(year,month,day,12),events=eventsForDate(date),lunch=lunchForDate(date);
  const dots=[...new Set([...events.map(event=>kindClass(event)),...(lunch?["lunch"]:[])])].slice(0,3);
  const weekend=[0,6].includes(date.getDay()),closed=events.some(event=>kindClass(event)==="closed");
  const isToday=sameDay(date,current),isSelected=sameDay(date,selected);
  const eventLabel=events.length?": "+events.map(event=>event.label).join(", "):"";
  html+='<button type="button" class="'+(weekend?"weekend ":"")+
   (closed?"closed ":"")+(isToday?"is-today ":"")+(isSelected?"active":"")+
   '" data-cal-day="'+date.toISOString()+'" aria-label="'+esc((isToday?"Today, ":"")+fmtDate(date)+eventLabel)+
   '" aria-current="'+(isToday?"date":"false")+'" aria-pressed="'+isSelected+
   '"><strong>'+day+'</strong><span class="calendar-dots" aria-hidden="true">'+
   dots.map(type=>'<span class="calendar-mark '+type+'"></span>').join("")+'</span></button>';
 }
 return html;
}
window.ABVMCalendarNavigation=Object.freeze({weekForDate,monthForDate,monthGrid});
})();
