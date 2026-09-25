import {MONTHS,WEEKDAY,sameDay,today,fmtDate,fmtShort,fmtCompactDate} from "./js/date-utils.js";
import {storageKey,readStoredFlag,toggleStoredFlag} from "./js/storage.js";
import {initInstallTracking,installExperience,promptInstall,registerFreshServiceWorker} from "./js/install.js";
import {
  kindClass,eventIconName,specialIconName,calendarLabel,primaryCalendarEvent,calendarScheduleEvent,
  scheduleSecondaryEvents,calendarContentEvents,scheduleStatusText,scheduleStatusDetail,
  normalizedCalendarDetail,sameCalendarDetail,calendarDetailKicker,taskIconName,calendarCellLabel
} from "./js/events.js";
import {eventSpan,mergeAnnualCalendarItems,createSchoolModel} from "./js/school-model.js";

(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], stack=()=>$("#app-content");
const VALID_TABS=["today","week","calendar","study","family"];
let envelope=null, pack=null, activeTab=VALID_TABS.includes(location.hash.slice(1))?location.hash.slice(1):"today", selectedDay=null, calendarDay=null, calendarOffset=0, calendarMode="month";
const {
  eventItemsForDate,currentReminders,reminderForDate,currentParentNotices,lunchForDate,
  weekDays,currentWeekRange,currentTest,nextDeadline,readingSubject,religionSubject,
  mathSubject,spellingSubject,readingRoutine,specialForDate,
}=createSchoolModel(()=>pack);

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

const ICON_PATHS={
  verified:'<path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-5"/>',
  book:'<path d="M4 5.5c2.8-.8 5.4-.3 8 1.5v13c-2.6-1.8-5.2-2.3-8-1.5v-13Z"/><path d="M20 5.5c-2.8-.8-5.4-.3-8 1.5v13c2.6-1.8 5.2-2.3 8-1.5v-13Z"/>',
  pencil:'<path d="m4 20 3.8-.8L19 8l-3-3L4.8 16.2 4 20Z"/><path d="m14.5 6.5 3 3"/>',
  math:'<path d="M5 7h6M8 4v6M14 6h5M14 17h5M16.5 14.5v5M5 14l6 6M11 14l-6 6"/>',
  cross:'<path d="M12 3v18M7 8h10"/>',
  calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  folder:'<path d="M3 7h7l2 2h9v10H3V7Z"/><path d="M3 7V5h7l2 2"/>',
  document:'<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
  pin:'<path d="m8 3 8 8M15 4l5 5-4 2-5 5-3-3 5-5 2-4ZM8 16l-5 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  lunch:'<path d="M5 4v7M8 4v7M5 8h3M6.5 11v9M15 4v16M15 4c3 2 4 5 4 8h-4"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  idea:'<path d="M9 18h6M10 21h4"/><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5c-.7.5-1 1.2-1 2h-5c0-.8-.3-1.5-1-2Z"/>',
  words:'<path d="M5 5h14v10H9l-4 4V5Z"/><path d="M9 9h6M9 12h4"/>',
  home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  camera:'<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7l1.4-3h5.2L16 7"/><circle cx="12" cy="13" r="4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  users:'<path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16.5 11a3.5 3.5 0 1 0 0-7"/><path d="M2.5 21c.5-4 2.6-6 5.5-6s5 2 5.5 6M14 15c4 0 6.5 2 7 6"/>',
  shirt:'<path d="M8 5 5 7 2 11l4 2 2-2v9h8v-9l2 2 4-2-3-4-3-2c-1 2-7 2-8 0Z"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h3a6 6 0 0 0 0-12Z"/><circle cx="8" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="6" r="1"/>',
  gym:'<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>',
  music:'<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  computer:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  library:'<path d="M4 4h6v16H4zM14 4h6v16h-6z"/><path d="M10 7h4M10 17h4"/>',
  report:'<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  party:'<path d="m5 20 4-11 6 6L5 20Z"/><path d="M14 4h.01M19 7h.01M17 2l1 2M11 3l1 2M20 12l2 1"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>'
};
function icon(name,extra=""){return '<svg class="ui-icon '+extra+'" viewBox="0 0 24 24" aria-hidden="true">'+(ICON_PATHS[name]||ICON_PATHS.star)+'</svg>'}

function toast(message){
  const t=$("#toast"); if(!t)return;
  t.textContent=message;t.classList.add("show");
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),1700);
}
function schoolHeader(){
  return '<div class="school-bar"><div class="school-identity"><img class="school-mark" src="./assets/abvm-app-icon-192.png" width="52" height="52" alt="Assumption BVM Catholic School seal"><div class="school-name"><span>Assumption BVM</span><span>Grade 2 Parent Companion</span></div></div><button class="bell-button" type="button" aria-label="Show school information freshness">'+icon("verified")+'</button></div>';
}
function scene(kind,kicker,title,subtitle,light=true,extra=""){
  return '<section class="top-scene '+kind+' scene-'+kind+'">'+schoolHeader()+
    '<div class="scene-title '+(light?'light':'ink')+'"><div class="section-label">'+esc(kicker)+'</div><h1>'+esc(title)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+extra+'</section>';
}
function freshness(){
  const checked=envelope?.sourceLastCheckedAt||pack?.sourceCheckedAt;
  const raw=checked||envelope?.sourceLastSeenAt||pack?.sourceCapturedAt||pack?.generatedAt;
  const d=raw?new Date(raw):null;
  const isToday=d&&!Number.isNaN(d.getTime())&&schoolDayKey(d)===schoolDayKey(new Date());
  const label=d&&!Number.isNaN(d.getTime())
    ?(checked?"Checked ":"Verified ")+(isToday?"today":d.toLocaleDateString(undefined,{month:"short",day:"numeric",timeZone:"America/New_York"}))+" at "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})+" ET"
    :"Verified school information";
  return '<div class="freshness"><span></span>'+label+'</div>';
}
function schoolDayKey(date){
  if(!date||Number.isNaN(date.getTime()))return"";
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return value.year+"-"+value.month+"-"+value.day;
}
function homeworkStatus(){
  const raw=envelope?.sourceLastCheckedAt||pack?.sourceCheckedAt;
  const d=raw?new Date(raw):null;
  return d&&schoolDayKey(d)===schoolDayKey(new Date())?"Checked today":"Latest teacher posting";
}
function uploadedNoticeStatus(){
  const info=envelope?.uploadedNotices;
  if(!info?.count)return"";
  const d=info.latestIntegratedAt?new Date(info.latestIntegratedAt):null;
  const when=d&&!Number.isNaN(d.getTime())?"; latest added "+d.toLocaleDateString(undefined,{month:"short",day:"numeric",timeZone:"America/New_York"}):"";
  return info.count+" uploaded school notice"+(info.count===1?"":"s")+" integrated"+when+".";
}
function checkKey(item,index){return storageKey("abvm-gold",pack?.sourceHash||"pack",index,item?.task||"")}
function checked(item,index){return readStoredFlag(checkKey(item,index))}
function familyKey(action,index){return storageKey("abvm-family",pack?.sourceHash||"pack",index,action)}
function familyChecked(action,index){return readStoredFlag(familyKey(action,index))}
function taskHtml(item,index){
  const done=checked(item,index),subject=(item.subject||"").toLowerCase(),task=(item.task||"").toLowerCase(),due=(item.due||"").toLowerCase();
  let tag="POSTED",tagClass="";
  if(/parent/.test(subject)){tag="PARENT";tagClass="if-participating"}
  else if(/ongoing/.test(due)){tag="ONGOING";tagClass="if-participating"}
  else if(/folder/.test(subject)||/folder/.test(task)){tag="FOLDER";tagClass="if-participating"}
  const taskName=item.task||"Task";
  const actionLabel=done?"Completed: "+taskName+". Tap to mark incomplete.":"Mark complete: "+taskName;
  return '<button class="check-item '+(done?'is-done':'')+'" type="button" data-check="'+index+'" aria-pressed="'+done+'" aria-label="'+esc(actionLabel)+'">'+
    '<span class="check-box">'+(done?'✓':'')+'</span>'+
    '<span class="check-copy"><span class="task-tag '+tagClass+'">'+tag+'</span><strong>'+esc(taskName)+'</strong>'+(item.subject?'<small>'+esc(item.subject)+(item.due?' · '+esc(item.due):'')+'</small>':'')+'</span>'+
    '<span class="task-deco" aria-hidden="true">'+icon(taskIconName(item))+'</span></button>';
}
function eventRow(item){
  return '<div class="event-row"><span class="event-icon '+kindClass(item)+'" aria-hidden="true">'+icon(eventIconName(item))+'</span><span class="kind">'+esc((item.kind||"School").replace(/\b\w/g,m=>m.toUpperCase()))+'</span><strong>'+esc(item.label||"School item")+'</strong></div>';
}
function lunchCard(lunch){
  if(!lunch)return"";
  const summary=(lunch.items||[]).join(", ").replace(/, ([^,]*)$/,", and $1");
  return '<section class="lunch-card">'+
    '<img class="lunch-photo" src="'+esc(lunch.image||"")+'" width="720" height="720" loading="lazy" decoding="async" alt="'+esc(lunch.imageAlt||("School lunch: "+summary))+'">'+
    '<div class="lunch-card-copy"><p>SCHOOL LUNCH</p><strong>'+esc(summary)+'</strong></div></section>';
}
function weekPriority(){
  const next=currentTest();
  if(next){
    const isToday=sameDay(next.d,today());
    return{
      title:isToday?next.x.label:"Prepare for "+next.x.label,
      detail:isToday?"Keep review short and calm. Focus on the teacher-posted material.":"Use short review sessions before "+fmtCompactDate(next.d)+". Keep required reading in the normal routine."
    };
  }
  return{title:"Keep the week organized.",detail:"Use the teacher-posted work first and keep reading in the normal routine."};
}

function renderToday(){
  const d=today(),events=eventItemsForDate(d),lunch=lunchForDate(d),priority=weekPriority(),deadline=nextDeadline(),schedule=calendarScheduleEvent(events),contentEvents=calendarContentEvents(events),special=specialForDate(d);
  const specialRow=special?'<div class="event-row special"><span class="event-icon">'+icon(specialIconName(special))+'</span><span class="kind">Special</span><strong>'+esc(calendarDisplayText(special))+'</strong></div>':"";
  const schoolRows=(contentEvents.length||special)?contentEvents.map(eventRow).join("")+specialRow:'<div class="event-row regular"><span class="event-icon">'+icon("check")+'</span><span class="kind">School</span><strong>Regular school day</strong></div>';
  const deadlineHtml=deadline
    ?'<section class="today-deadline"><span class="deadline-icon">'+icon("pin")+'</span><div><p>Next deadline</p><strong>'+esc(deadline.x.label)+'</strong><small>'+esc(fmtCompactDate(deadline.span.start))+'</small></div></section>'
    :'<section class="today-deadline clear"><span class="deadline-icon">'+icon("check")+'</span><div><p>Next deadline</p><strong>No posted deadline due</strong><small>Nothing extra is due right now.</small></div></section>';
  const content='<div class="content today-content">'+
    '<section class="date-hero-card today-overview"><div class="today-overview-head"><div class="big-date"><strong>'+WEEKDAY[d.getDay()].slice(0,3).toUpperCase()+'</strong><span>'+d.getDate()+'</span></div><div class="date-hero-copy"><p>At school</p><h2>'+(contentEvents.length+(special?1:0)?contentEvents.length+(special?1:0)+" item"+(contentEvents.length+(special?1:0)===1?"":"s")+" today":"Regular school day")+'</h2><span>'+esc(priority.title)+'</span></div></div><div class="today-event-stack">'+schoolRows+'</div></section>'+
    (schedule?'<section class="schedule-alert '+kindClass(schedule)+'"><span>'+icon(kindClass(schedule)==="closed"?"ban":"clock")+'</span><div><small>'+esc(scheduleStatusText(schedule))+'</small><strong>'+esc(scheduleStatusDetail(schedule))+'</strong></div></section>':'')+
    deadlineHtml+
    '<section class="gold-card homework-dashboard"><div class="checklist-title"><div><span class="today-section-kicker">To do</span><h3>Homework</h3></div><span class="edit-pill">'+homeworkStatus()+'</span></div><p class="checklist-help">Tap a circle when a task is finished.</p><div class="task-list">'+(pack?.homework||[]).map(taskHtml).join("")+'</div></section>'+
    lunchCard(lunch)+'</div>';
  stack().innerHTML='<div class="screen today-screen" role="region" aria-label="Today"><header class="today-page-head">'+schoolHeader()+'<div class="today-page-title"><h1>Today</h1><p>'+esc(fmtDate(d))+'</p></div></header>'+freshness()+content+'</div>';
}
function renderWeek(){
  const days=weekDays();
  if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=days.find(d=>sameDay(d,today()))||days[0];
  const events=eventItemsForDate(selectedDay),items=calendarContentEvents(events),lunch=lunchForDate(selectedDay),special=specialForDate(selectedDay),schedule=calendarScheduleEvent(events),now=today();
  const picker=days.map(d=>{
    const active=sameDay(d,selectedDay),isToday=sameDay(d,now),dayEvents=eventItemsForDate(d),hasItems=calendarContentEvents(dayEvents).length||calendarScheduleEvent(dayEvents)||specialForDate(d);
    return '<button class="'+[active?"active":"",isToday?"today":"",d<now?"past":""].filter(Boolean).join(" ")+'" type="button" data-day="'+d.toISOString()+'" aria-label="'+esc(fmtDate(d)+(isToday?", today":""))+'" aria-pressed="'+active+'"><span>'+WEEKDAY[d.getDay()].slice(0,3)+'</span><strong>'+d.getDate()+'</strong>'+(hasItems?'<i aria-hidden="true"></i>':'')+'</button>';
  }).join("");
  const future=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)})).filter(o=>o.span&&o.span.start>selectedDay).sort((a,b)=>a.span.start-b.span.start).slice(0,4).map(o=>({x:o.x,d:o.span.start}));
  const noSchool=schedule&&kindClass(schedule)==="closed",halfDay=schedule&&kindClass(schedule)==="halfday",weekend=[0,6].includes(selectedDay.getDay());
  const dayStatus=noSchool?"No School":halfDay?"Half Day":weekend?"Weekend":"School Day";
  const agendaCount=items.length+(special&&!noSchool?1:0)+(schedule?1:0);
  stack().innerHTML='<div class="screen week-screen" role="region" aria-label="This week"><header class="week-page-head">'+schoolHeader()+'<div class="week-page-title"><h1>Week</h1><p>'+esc(fmtCompactDate(days[0]))+' – '+esc(fmtCompactDate(days[days.length-1]))+'</p></div></header>'+
    '<div class="content week-content"><div class="day-picker">'+picker+'</div>'+
    '<section class="day-detail"><div class="day-detail-inner"><div class="day-detail-title"><div><span class="week-kicker">'+WEEKDAY[selectedDay.getDay()]+'</span><h2>'+esc(fmtDate(selectedDay))+'</h2><p class="week-day-summary">'+(agendaCount?agendaCount+" item"+(agendaCount===1?"":"s")+" on the schedule":"Nothing extra scheduled")+'</p></div><span class="school-day-pill '+(noSchool?'closed':halfDay?'halfday':weekend?'weekend':'')+'">'+dayStatus+'</span></div>'+
    (schedule?'<div class="schedule-alert compact '+kindClass(schedule)+'"><span>'+icon(kindClass(schedule)==="closed"?"ban":"clock")+'</span><div><small>'+esc(scheduleStatusText(schedule))+'</small><strong>'+esc(scheduleStatusDetail(schedule))+'</strong></div></div>':'')+
    (special&&!noSchool?'<div class="selected-special"><span>'+icon(specialIconName(special))+'</span><div><small>Class special</small><strong>'+esc(special)+'</strong></div></div>':'')+
    '<div class="event-stack week-event-stack">'+(items.length?items.map(eventRow).join(""):'<div class="empty-note">No additional school events are listed.</div>')+'</div></div></section>'+
    lunchCard(lunch)+
    '<section class="reminder-strip"><span class="bang">'+icon("check")+'</span><p><strong>Remember</strong>'+esc(reminderForDate(selectedDay))+'</p></section>'+
    '<section class="future-card"><div class="week-section-head"><h3>Coming up</h3></div>'+(future.length?future.map(o=>'<div class="future-row"><span>'+esc(fmtCompactDate(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join(""):'<div class="empty-note">Nothing else is posted after this day yet.</div>')+'</section></div></div>';
}
function calendarDisplayText(value){
  return String(value||"").replace(/\bFundraiswer\b/gi,"Fundraiser");
}
function calendarSpecialClass(value){
  const v=String(value||"").toLowerCase();
  if(/music/.test(v))return"music";
  if(/mass|church|relig/.test(v))return"mass";
  if(/gym|pe\b/.test(v))return"gym";
  if(/library/.test(v))return"library";
  if(/computer|technology/.test(v))return"computer";
  if(/art/.test(v))return"art";
  return"special";
}
function calendarDetailRow(iconName,type,title,klass=""){
  return '<div class="calendar-detail-row '+klass+'"><span class="calendar-detail-icon" aria-hidden="true">'+icon(iconName)+'</span><div class="calendar-detail-copy"><small>'+esc(type)+'</small><strong>'+esc(calendarDisplayText(title))+'</strong></div></div>';
}
function monthGrid(year,month){
  const first=new Date(year,month,1,12),last=new Date(year,month+1,0,12),blanks=first.getDay();
  let html="";
  for(let i=0;i<blanks;i++)html+='<span class="calendar-blank"></span>';
  for(let day=1;day<=last.getDate();day++){
    const d=new Date(year,month,day,12),events=eventItemsForDate(d),special=specialForDate(d);
    const schedule=calendarScheduleEvent(events),contentEvents=calendarContentEvents(events),primary=primaryCalendarEvent(contentEvents);
    const scheduleClass=schedule?kindClass(schedule):"",primaryClass=primary?kindClass(primary):"";
    const weekend=[0,6].includes(d.getDay()),closed=scheduleClass==="closed",halfday=scheduleClass==="halfday";
    const distinctSpecial=Boolean(special&&!closed&&!contentEvents.some(item=>sameCalendarDetail(item.label,special)));
    const specialLabel=distinctSpecial?special.split(",")[0].trim():"";
    const specialClass=calendarSpecialClass(specialLabel||special);
    const cellItems=[];
    if(schedule)cellItems.push({label:scheduleStatusText(schedule),klass:scheduleClass});
    for(const item of contentEvents)cellItems.push({label:calendarDisplayText(item.label),klass:kindClass(item)});
    if(distinctSpecial)cellItems.push({label:calendarDisplayText(specialLabel),klass:specialClass});
    const shownItems=cellItems.slice(0,2),moreCount=Math.max(0,cellItems.length-shownItems.length);
    const classes=[
      weekend?"weekend":"",
      closed?"closed":"",
      halfday?"halfday":"",
      primaryClass?("event-"+primaryClass):"",
      (!primaryClass&&!schedule&&distinctSpecial)?("special-"+specialClass):"",
      sameDay(d,today())?"today":"",
      calendarDay&&sameDay(d,calendarDay)?"active":""
    ].filter(Boolean).join(" ");
    const ariaDetails=[
      ...events.map(item=>calendarDisplayText(item.label)),
      ...(special?[calendarDisplayText(special)]:[])
    ].filter(Boolean);
    const eventStack=shownItems.length
      ?'<span class="calendar-cell-events" aria-hidden="true">'+shownItems.map(item=>'<span class="calendar-cell-event '+(item.klass||"special")+'"><i></i><em>'+esc(item.label)+'</em></span>').join("")+(moreCount?'<span class="calendar-cell-more">+'+moreCount+' more</span>':'')+'</span>'
      :"";
    html+='<button class="'+classes+'" type="button" data-cal-day="'+d.toISOString()+'" aria-pressed="'+Boolean(calendarDay&&sameDay(d,calendarDay))+'" aria-label="'+esc(fmtDate(d)+(ariaDetails.length?': '+ariaDetails.join(', '):''))+'">'+
      '<strong>'+day+'</strong>'+eventStack+'</button>';
  }
  return html;
}
function renderCalendar(){
  const base=today(),shown=new Date(base.getFullYear(),base.getMonth()+calendarOffset,1,12),y=shown.getFullYear(),m=shown.getMonth();
  if(!calendarDay||calendarDay.getMonth()!==m||calendarDay.getFullYear()!==y){
    calendarDay=(base.getMonth()===m&&base.getFullYear()===y)?new Date(base):new Date(y,m,1,12);
  }
  const events=eventItemsForDate(calendarDay),lunch=lunchForDate(calendarDay),special=specialForDate(calendarDay),schedule=calendarScheduleEvent(events),contentEvents=calendarContentEvents(events),primary=primaryCalendarEvent(contentEvents);
  const effectiveSpecial=(schedule&&kindClass(schedule)==="closed")?"":special;
  const displaySpecial=effectiveSpecial&&!contentEvents.some(item=>sameCalendarDetail(item.label,effectiveSpecial))?effectiveSpecial:"";
  const monthEnd=new Date(y,m+1,0,12);
  const agenda=[];
  for(let day=1;day<=monthEnd.getDate();day++){
    const d=new Date(y,m,day,12),items=eventItemsForDate(d);
    if(items.length)agenda.push({d,events:items,schedule:calendarScheduleEvent(items),content:calendarContentEvents(items)});
  }

  const monthPanel='<div class="calendar-month-panel '+(calendarMode==="month"?"active":"")+'">'+
    '<div class="calendar-weekdays">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=>"<span>"+day+"</span>").join("")+'</div>'+
    '<div class="calendar-grid">'+monthGrid(y,m)+'</div>'+
    '</div>';

  const listPanel='<div class="calendar-list-panel '+(calendarMode==="list"?"active":"")+'">'+
    (agenda.length?agenda.map(item=>{
      const top=primaryCalendarEvent(item.content);
      const title=item.schedule?scheduleStatusText(item.schedule):(top?calendarDisplayText(top.label):"School event");
      const markerClass=item.schedule?kindClass(item.schedule):(top?kindClass(top):"school");
      const extraCount=item.schedule?item.content.length:Math.max(0,item.content.length-(top?1:0));
      const meta=item.schedule?scheduleStatusDetail(item.schedule):(top?calendarLabel(top):"School event");
      return '<button class="calendar-list-row" type="button" data-cal-day="'+item.d.toISOString()+'">'+
        '<span class="calendar-list-date"><b>'+item.d.getDate()+'</b><small>'+WEEKDAY[item.d.getDay()].slice(0,3)+'</small></span>'+
        '<span class="calendar-list-marker '+markerClass+'" aria-hidden="true"></span>'+
        '<span class="calendar-list-copy"><strong>'+esc(title)+'</strong><small>'+esc(meta)+(extraCount?' · +'+extraCount+' more':'')+'</small></span>'+
        '<span class="chevron" aria-hidden="true">›</span></button>';
    }).join(""):'<div class="calendar-empty-state">No school dates are listed for this month.</div>')+
    '</div>';

  const legend='<div class="calendar-legend" aria-label="Calendar color key">'+
    '<span><i class="music"></i>Music</span>'+
    '<span><i class="mass"></i>Mass</span>'+
    '<span><i class="gym"></i>Gym</span>'+
    '<span><i class="library"></i>Library</span>'+
    '<span><i class="computer"></i>Computer</span>'+
    '<span><i class="test"></i>STAR Testing</span>'+
    '<span><i class="closed"></i>No School</span>'+
    '<span><i class="halfday"></i>Half Day</span>'+
    '<span><i class="special"></i>Special</span>'+
    '</div>';

  const detailRows=[];
  if(schedule){
    detailRows.push(calendarDetailRow(
      kindClass(schedule)==="closed"?"ban":"clock",
      scheduleStatusText(schedule),
      scheduleStatusDetail(schedule),
      "schedule "+kindClass(schedule)
    ));
  }
  for(const item of contentEvents){
    detailRows.push(calendarDetailRow(
      eventIconName(item),
      calendarLabel(item),
      item.label,
      "event "+kindClass(item)+(item===primary?" primary":"")
    ));
  }
  if(displaySpecial){
    detailRows.push(calendarDetailRow(
      specialIconName(displaySpecial),
      schedule&&kindClass(schedule)==="halfday"?"Usual class special":"Class special",
      displaySpecial,
      "special "+calendarSpecialClass(displaySpecial)
    ));
  }
  if(lunch){
    detailRows.push(calendarDetailRow(
      "lunch",
      "Lunch",
      (lunch.items||[]).join(", ").replace(/, ([^,]*)$/,", and $1"),
      "lunch"
    ));
  }

  const selectedStatus=schedule
    ?'<span class="calendar-day-status '+kindClass(schedule)+'">'+esc(scheduleStatusText(schedule))+'</span>'
    :"";
  const eventCount=(schedule?1:0)+contentEvents.length+(displaySpecial?1:0);
  const daySummary=eventCount?eventCount+" event"+(eventCount===1?"":"s"):"Regular school day";
  const noSpecialItems=!schedule&&!contentEvents.length&&!displaySpecial;
  const details=(noSpecialItems?'<p class="calendar-empty">No special events. Regular school day.</p>':'')+
    '<div class="calendar-detail-list">'+detailRows.join("")+'</div>';

  stack().innerHTML='<div class="screen calendar-screen" role="region" tabindex="0" aria-label="'+MONTHS[m]+' calendar">'+
    '<header class="calendar-page-head">'+schoolHeader()+'<div class="calendar-page-title"><h1>Calendar</h1><p>Tap a date for details.</p></div></header>'+
    '<div class="calendar-wrap">'+
      '<section class="calendar-card">'+
        '<div class="calendar-title-row">'+
          '<button class="month-arrow" data-month="-1" type="button" aria-label="Previous month">‹</button>'+
          '<div class="calendar-heading"><span class="calendar-view-kicker">'+(calendarMode==="month"?"MONTH VIEW":"AGENDA")+'</span><h2>'+MONTHS[m]+" "+y+'</h2></div>'+
          '<button class="month-arrow" data-month="1" type="button" aria-label="Next month">›</button>'+
        '</div>'+
        '<div class="calendar-tabs" role="group" aria-label="Calendar view">'+
          '<button class="'+(calendarMode==="month"?"active":"")+'" data-cal-mode="month" type="button" aria-label="Month View" aria-pressed="'+(calendarMode==="month")+'">Month View</button>'+
          '<button class="'+(calendarMode==="list"?"active":"")+'" data-cal-mode="list" type="button" aria-label="List View" aria-pressed="'+(calendarMode==="list")+'">List View</button>'+
        '</div>'+
        monthPanel+listPanel+legend+
      '</section>'+
      '<section class="calendar-day-card">'+
        '<div class="calendar-day-heading"><div><span>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</span><h2>'+WEEKDAY[calendarDay.getDay()]+", "+MONTHS[calendarDay.getMonth()]+" "+calendarDay.getDate()+'</h2><p class="calendar-day-summary">'+esc(daySummary)+'</p></div><div class="calendar-day-badges">'+selectedStatus+'</div></div>'+
        details+
      '</section>'+
    '</div>'+
  '</div>';
}
function subjectCard(id,klass,title,icon,subj){
  const notes=[...(subj?.topics||[]),...(subj?.studyNotes||[])].filter((n,i,a)=>n&&a.indexOf(n)===i);
  const open=id==="study-reading"?" open":"";
  return '<details id="'+id+'" class="subject-card subject-disclosure '+klass+'"'+open+'><summary><span class="subject-head"><span class="icon" aria-hidden="true">'+icon+'</span><span><span class="subject-kicker">'+esc(title.toUpperCase())+'</span><strong>'+esc(title)+'</strong></span></span><span class="disclosure-chevron" aria-hidden="true">›</span></summary><div class="subject-disclosure-body"><ul>'+notes.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul></div></details>';
}
function renderStudy(){
  const r=readingSubject(),rel=religionSubject(),math=mathSubject(),spell=spellingSubject(),[,fri]=currentWeekRange(),now=today();
  const assessments=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)})).filter(o=>o.span&&o.span.end>=now&&o.span.start<=fri&&kindClass(o.x)==="test").sort((a,b)=>a.span.start-b.span.start).map(o=>({x:o.x,d:o.span.start<now?new Date(now):o.span.start}));
  const starActive=(pack?.importantDates||[]).some(x=>/star/i.test(x.label||"")&&eventSpan(x.date)?.end>=now);
  const essentials=[{when:"Daily",label:readingRoutine(),icon:icon("book"),klass:"green"},...assessments.slice(0,4).map((o,i)=>({when:fmtCompactDate(o.d),label:o.x.label,icon:icon(eventIconName(o.x)),klass:["yellow","pink","blue","pink"][i]||"blue"}))];
  const sight=(r?.topics||[]).find(x=>/^Sight words:/i.test(x))?.replace(/^Sight words:\s*/i,"").split(",").map(x=>x.trim()).filter(Boolean)||[],vocab=(pack?.vocabulary||[]).map(v=>v.term);
  stack().innerHTML='<div class="screen study-screen" role="region" aria-label="Study room"><header class="study-page-head">'+schoolHeader()+'<div class="study-page-title"><h1>Study</h1><p>What to review this week</p></div></header>'+
    '<div class="study-content"><section class="study-at-a-glance"><div class="study-card-head"><span>Up next</span><h2>Quick Look</h2></div>'+essentials.map(e=>'<div class="essential-row"><span class="essential-icon '+e.klass+'">'+e.icon+'</span><div><time>'+esc(e.when)+'</time><strong>'+esc(e.label)+'</strong></div></div>').join("")+'</section>'+
    '<nav class="study-section-nav" aria-label="Jump to a study section"><button type="button" data-study-jump="study-reading">Reading</button><button type="button" data-study-jump="study-spelling">Spelling</button><button type="button" data-study-jump="study-religion">Religion</button><button type="button" data-study-jump="study-math">Math</button><button type="button" data-study-jump="study-words">Words</button></nav>'+
    '<div class="study-section-label"><span>Subjects</span><p>Tap a subject to open its review list.</p></div>'+
    subjectCard("study-reading","reading","Reading",icon("book"),r)+subjectCard("study-spelling","spelling","Spelling and phonics",icon("pencil"),spell)+subjectCard("study-religion","religion",rel?.subject||"Religion",icon("cross"),rel)+subjectCard("study-math","math","Math",icon("math"),math)+
    '<details id="study-words" class="subject-card subject-disclosure sight words-card"><summary><span class="subject-head"><span class="icon">'+icon("words")+'</span><span><span class="subject-kicker">WORDS</span><strong>Sight words & vocabulary</strong></span></span><span class="disclosure-chevron" aria-hidden="true">›</span></summary><div class="subject-disclosure-body"><h3 class="word-subhead">Sight words</h3><div class="sight-cloud">'+sight.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div><h3 class="word-subhead">Vocabulary</h3><div class="word-grid">'+vocab.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></div></details>'+
    (starActive?'<section class="calm-card"><span>'+icon("moon")+'</span><div><h3>STAR reminder</h3><p>Keep preparation calm: normal reading, normal routines, and a good night’s sleep.</p></div></section>':"")+
    '<section class="calm-card study-tip"><span>'+icon("check")+'</span><div><h3>Short and focused wins</h3><p>Use the teacher-posted material above, then stop when the planned review is complete.</p></div></section></div></div>';
}
function installCard(){
  const experience=installExperience();
  if(!experience.show)return"";
  return '<section class="install-card"><span class="install-icon">'+icon("home")+'</span><div><h3>'+esc(experience.title)+'</h3><p>'+esc(experience.detail)+'</p>'+(experience.canPrompt?'<button class="install-action" type="button" data-install-app>Install app</button>':'')+'</div></section>';
}
function renderFamily(){
  const priority=weekPriority(),[,fri]=currentWeekRange(),now=today();
  const tests=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.end>=now&&o.span.start<=fri&&kindClass(o.x)==="test").length;
  const dueItems=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.end>=now&&kindClass(o.x)==="due")
    .sort((a,b)=>a.span.start-b.span.start);
  const nextDue=dueItems[0]||null;
  const actions=[...(pack?.homework||[]).map(x=>x.task),...currentReminders()].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,12);
  const notices=currentParentNotices(),gaps=pack?.gaps||[];
  stack().innerHTML='<div class="screen family-screen" role="region" aria-label="Family dashboard">'+
    '<header class="family-page-head">'+schoolHeader()+'<div class="family-page-title"><h1>Family</h1><p>What needs your attention</p></div></header>'+freshness()+
    '<div class="family-content"><section class="family-priority"><p>This week</p><h2>'+esc(priority.title)+'</h2><span>'+esc(priority.detail)+'</span></section>'+
    '<div class="family-stats"><article><span>Assessments</span><strong>'+tests+'</strong><small>remaining this week</small></article><article><span>Next deadline</span><strong>'+esc(nextDue?fmtCompactDate(nextDue.span.start):"Clear")+'</strong><small>'+esc(nextDue?nextDue.x.label:"Nothing posted")+'</small></article></div>'+
    '<details class="family-card family-disclosure" open><summary><span>Family checklist</span><span class="disclosure-chevron" aria-hidden="true">›</span></summary><div class="family-disclosure-body"><p class="family-section-hint">Tap a task to mark it complete. Progress is saved on this device.</p><div class="family-actions">'+actions.map((a,i)=>{const done=familyChecked(a,i),label=(done?"Completed: ":"Mark complete: ")+a+(done?". Tap to mark incomplete.":"");return '<button class="family-action '+(done?'is-done':'')+'" type="button" data-family-check="'+i+'" aria-pressed="'+done+'" aria-label="'+esc(label)+'"><span class="box">'+(done?icon("check"):'')+'</span><span>'+esc(a)+'</span></button>'}).join("")+'</div></div></details>'+
    '<section class="reading-policy"><span class="round">20</span><div><h3>Reading every day</h3><p>Read or be read to for 20 minutes and keep the Reading Log in the homework folder.</p></div></section>'+
    '<section class="family-card family-static-card" aria-labelledby="family-current-notices"><h3 id="family-current-notices">Current notices</h3><ul class="notice-list static-notice-list" role="list">'+notices.map(n=>'<li class="notice"><span class="notice-dot" aria-hidden="true"></span><p>'+esc(n)+'</p></li>').join("")+'</ul></section>'+
    '<details class="family-card family-disclosure"><summary><span>Source coverage</span><span class="disclosure-chevron" aria-hidden="true">›</span></summary><div class="family-disclosure-body"><ul class="notice-list static-notice-list" role="list"><li class="notice"><span class="notice-dot" aria-hidden="true"></span><p>'+esc(envelope?.source||"Verified ABVM school sources")+'</p></li>'+(uploadedNoticeStatus()?'<li class="notice"><span class="notice-dot" aria-hidden="true"></span><p>'+esc(uploadedNoticeStatus())+'</p></li>':'')+gaps.map(n=>'<li class="notice"><span class="notice-dot" aria-hidden="true"></span><p>'+esc(n)+'</p></li>').join("")+'</ul></div></details>'+
    installCard()+
    '</div></div>';
}
function render(){
  if(!pack)return;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderStudy,family:renderFamily}[activeTab]||renderToday)();
  $$(".bottom-nav button").forEach(b=>{const on=b.dataset.tab===activeTab;b.classList.toggle("active",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
  const screen=stack().querySelector(".screen");if(screen)screen.scrollTop=0;bindScreen();
}
function bindScreen(){
  $$("[data-study-jump]").forEach(b=>b.addEventListener("click",()=>{
    const target=document.getElementById(b.dataset.studyJump);
    if(target){
      if(target.tagName==="DETAILS")target.open=true;
      target.scrollIntoView({behavior:"smooth",block:"start"});
    }
  }));
  $$("[data-check]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.check),item=(pack.homework||[])[i],k=checkKey(item,i);toggleStoredFlag(k);render()}));
  $$("[data-family-check]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.familyCheck),actions=[...(pack?.homework||[]).map(x=>x.task),...currentReminders()].filter((x,j,a)=>x&&a.indexOf(x)===j).slice(0,12),action=actions[i],k=familyKey(action,i);toggleStoredFlag(k);renderFamily();bindScreen()}));
  $$("[data-day]").forEach(b=>b.addEventListener("click",()=>{selectedDay=new Date(b.dataset.day);renderWeek();bindScreen()}));
  $$("[data-cal-day]").forEach(b=>b.addEventListener("click",()=>{calendarDay=new Date(b.dataset.calDay);renderCalendar();bindScreen()}));
  $$("[data-month]").forEach(b=>b.addEventListener("click",()=>{calendarOffset+=Number(b.dataset.month);calendarDay=null;renderCalendar();bindScreen()}));
  $$("[data-cal-mode]").forEach(b=>b.addEventListener("click",()=>{calendarMode=b.dataset.calMode;renderCalendar();bindScreen()}));
  const installButton=$("[data-install-app]");
  if(installButton)installButton.addEventListener("click",async()=>{
    const result=await promptInstall();
    toast(result?.outcome==="accepted"?"App installation started.":"Install prompt closed.");
    if(activeTab==="family"){renderFamily();bindScreen()}
  });
  const freshnessButton=$(".bell-button");if(freshnessButton)freshnessButton.addEventListener("click",()=>toast($(".freshness")?.textContent.trim()||"Verified school information is loaded."));
}
function activateTab(tab,push=true){
  const next=VALID_TABS.includes(tab)?tab:"today";
  if(push&&location.hash!=="#"+next)history.pushState({tab:next},"","#"+next);
  activeTab=next;render();
}
if(!VALID_TABS.includes(location.hash.slice(1)))history.replaceState({tab:"today"},"","#today");
$$(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.tab,true)));
function syncTabFromLocation(){
  const next=VALID_TABS.includes(location.hash.slice(1))?location.hash.slice(1):"today";
  if(next!==activeTab)activateTab(next,false);
}
window.addEventListener("popstate",syncTabFromLocation);
window.addEventListener("hashchange",syncTabFromLocation);
initInstallTracking(()=>{
  if(pack&&activeTab==="family"){renderFamily();bindScreen()}
});

async function load(){
  let data,annual={importantDates:[]};
  try{
    const [r,annualData]=await Promise.all([
      fetch("./data/study-pack.json",{cache:"no-store"}),
      fetch("./data/school-year-calendar.json",{cache:"no-store"}).then(async response=>response.ok?response.json():annual).catch(()=>annual)
    ]);
    if(!r.ok)throw new Error("HTTP "+r.status);
    data=await r.json();if(!data?.pack?.sourceSufficient)throw new Error("Incomplete school pack");
    annual=annualData||annual;
  }catch(e){
    stack().innerHTML='<div class="screen"><div class="content load-error"><section class="gold-card"><div class="section-label">ABVM GRADE 2</div><h1 class="card-title">School information is temporarily unavailable</h1><p class="muted">Your saved checklist is safe. Check your connection, then refresh the page.</p><button class="retry-button" type="button" onclick="location.reload()">Try again</button></section></div></div>';
    return;
  }
  envelope=data;pack=data.pack;
  pack.importantDates=mergeAnnualCalendarItems(pack.importantDates||[],annual.importantDates||[]);
  render();
}
load();
registerFreshServiceWorker();
})();
