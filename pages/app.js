(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], stack=()=>$("#app-content");
const VALID_TABS=["today","week","calendar","study","family"];
let envelope=null, pack=null, activeTab=VALID_TABS.includes(location.hash.slice(1))?location.hash.slice(1):"today", selectedDay=null, calendarDay=null, calendarOffset=0, calendarMode="month";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const WEEKDAY=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

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
function parseDate(text){return eventSpan(text)?.start||null}
function eventSpan(text){
  if(!text)return null;
  const value=String(text);
  const m=value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!m)return null;
  const month=SHORT_MONTHS[m[1].toLowerCase()],day=Number(m[2]);
  const start=schoolYearMonthDate(month,day);
  const tail=value.slice((m.index||0)+m[0].length);
  const endMatch=tail.match(/(?:–|-)\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{1,2})\b/i);
  let end=new Date(start);
  if(endMatch){
    const endMonth=endMatch[1]?SHORT_MONTHS[endMatch[1].toLowerCase()]:month;
    end=schoolYearMonthDate(endMonth,Number(endMatch[2]));
    if(end<start)end.setFullYear(end.getFullYear()+1);
  }
  return{start,end};
}
function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function today(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date());
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return new Date(Number(value.year),Number(value.month)-1,Number(value.day),12);
}
function fmtDate(d){return d?WEEKDAY[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate():""}
function fmtShort(d){return d?WEEKDAY[d.getDay()].slice(0,3)+" "+d.getDate():""}
function schoolYearMonthDate(month,day){
  const now=today();let year=now.getFullYear();
  if(now.getMonth()>=7&&month<=5)year++;
  else if(now.getMonth()<=5&&month>=7)year--;
  return new Date(year,month,day,12);
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
function kindClass(item){
  const k=(item?.kind||"").toLowerCase(),l=(item?.label||"").toLowerCase();
  if(/no school|school closed|closed|holiday/.test(l)||/holiday|closed/.test(k))return"closed";
  if(/12:00|noon|early dismissal|half day/.test(l)||/schedule change/.test(k))return"halfday";
  if(/picture day|school picture|portraits?/.test(l))return"picture";
  if(/dress down|dress-down/.test(l))return"dress";
  if(/conference/.test(k)||/conference/.test(l))return"conference";
  if(/progress report|report card/.test(l))return"report";
  if(/test|assessment/.test(k)||/test|star reading|star testing/.test(l))return"test";
  if(/mass|relig|faith/.test(k)||/mass|church/.test(l))return"faith";
  if(/deadline|due/.test(k)||/due|money|order|rsvp/.test(l))return"due";
  if(/club/.test(k)||/lego/.test(l))return"club";
  if(/party|dance|santa workshop|movie night|family night|s’more|smore/.test(l))return"celebration";
  if(/meeting/.test(k)||/meeting/.test(l))return"meeting";
  return"school";
}
function eventIconName(item){
  const k=kindClass(item),l=(item?.label||"").toLowerCase();
  if(k==="picture")return"camera";
  if(k==="halfday")return"clock";
  if(k==="closed")return"ban";
  if(k==="conference"||k==="meeting")return"users";
  if(k==="dress")return"shirt";
  if(k==="report")return"report";
  if(k==="celebration")return"party";
  if(/reading/.test(l))return"book";
  if(/spelling|handwriting/.test(l))return"pencil";
  if(/math|addition|subtraction/.test(l))return"math";
  if(k==="faith")return"cross";
  if(k==="due")return"pin";
  if(k==="test")return"document";
  return"calendar";
}
function specialIconName(name){
  const s=String(name||"").toLowerCase();
  if(/mass|church/.test(s))return"cross";
  if(/gym/.test(s))return"gym";
  if(/art/.test(s))return"palette";
  if(/music/.test(s))return"music";
  if(/computer/.test(s))return"computer";
  if(/library/.test(s))return"library";
  return"star";
}
function calendarLabel(item){
  const k=kindClass(item),raw=String(item?.label||"School event");
  if(k==="halfday")return"Half Day";
  if(k==="closed")return"No School";
  if(k==="conference")return"Conference";
  if(k==="report")return"Progress Reports";
  if(k==="picture")return"Picture Day";
  if(k==="dress")return"Dress Down";
  if(k==="test")return /star/i.test(raw)?"STAR Testing":"Test";
  if(k==="due")return"Due";
  if(k==="meeting")return"Meeting";
  if(k==="club")return"Lego Club";
  if(k==="celebration"){
    if(/halloween/i.test(raw))return"Halloween";
    if(/dance/i.test(raw))return"Dance";
    if(/movie/i.test(raw))return"Movie Night";
    return"Special Event";
  }
  if(k==="faith")return"Mass";
  return raw.length>18?raw.slice(0,16).trim()+"…":raw;
}
function primaryCalendarEvent(events){
  const rank={closed:0,halfday:1,picture:2,dress:3,conference:4,report:5,test:6,due:7,celebration:8,faith:9,club:10,meeting:11,school:12};
  return [...events].sort((a,b)=>(rank[kindClass(a)]??99)-(rank[kindClass(b)]??99))[0]||null;
}
function calendarScheduleEvent(events){
  return events.find(e=>kindClass(e)==="closed")||events.find(e=>kindClass(e)==="halfday")||null;
}
function calendarContentEvents(events){
  return events.filter(e=>!["closed","halfday"].includes(kindClass(e)));
}
function scheduleStatusText(item){
  if(!item)return"";
  return kindClass(item)==="closed"?"No School":"Half Day";
}
function scheduleStatusDetail(item){
  if(!item)return"";
  return kindClass(item)==="closed"?"School is closed":"Dismissal at 12:00 PM";
}
const CALENDAR_VISUAL_LIBRARY={
  picture:{
    variants:["./assets/calendar/picture-day.svg","./assets/calendar/picture-day-2.svg"],
    alt:"Premium school Picture Day camera visual"
  },
  mass:{
    variants:["./assets/calendar/mass-1.svg","./assets/calendar/mass-2.svg"],
    alt:"Premium Mass and church visual"
  },
  gym:{
    variants:["./assets/calendar/gym-1.svg","./assets/calendar/gym-2.svg"],
    alt:"Premium gym class visual"
  },
  art:{
    variants:["./assets/calendar/art-1.svg","./assets/calendar/art-2.svg"],
    alt:"Premium art class visual"
  },
  dress:{
    variants:["./assets/calendar/dress-down-1.svg","./assets/calendar/dress-down-2.svg"],
    alt:"Premium Dress Down Day visual"
  }
};
function calendarVisualCategory(primary,special){
  const pk=primary?kindClass(primary):"";
  const s=String(special||"").toLowerCase();
  if(pk==="picture")return"picture";
  if(pk==="dress")return"dress";
  if(pk==="faith"||/mass|church/.test(s))return"mass";
  if(/gym/.test(s))return"gym";
  if(/art/.test(s))return"art";
  return null;
}
function stableCalendarVisualIndex(date,count){
  if(count<=1)return 0;
  const key=(date.getFullYear()*372)+(date.getMonth()*31)+date.getDate();
  return Math.abs(key)%count;
}
function calendarVisualFor(date,primary,special){
  const category=calendarVisualCategory(primary,special);
  const entry=category?CALENDAR_VISUAL_LIBRARY[category]:null;
  if(!entry?.variants?.length)return null;
  const index=stableCalendarVisualIndex(date,entry.variants.length);
  return{src:entry.variants[index],alt:entry.alt,category,index};
}
function taskIconName(item){
  const s=((item?.subject||"")+" "+(item?.task||"")).toLowerCase();
  if(/read/.test(s))return"book";
  if(/spell/.test(s))return"pencil";
  if(/math/.test(s))return"math";
  if(/folder/.test(s))return"folder";
  if(/form|cover/.test(s))return"document";
  return"check";
}
function eventItemsForDate(date){
  return(pack?.importantDates||[]).filter(x=>{
    const span=eventSpan(x.date);return span&&date>=span.start&&date<=span.end;
  });
}
function eventIsPast(item,ref=today()){const span=eventSpan(item?.date);return span?span.end<ref:false}
function currentReminders(){
  const now=today();
  return(pack?.reminders||[]).filter(text=>{const span=eventSpan(text);return !span||span.end>=now}).sort((a,b)=>{
    const aSpan=eventSpan(a),bSpan=eventSpan(b);
    if(aSpan&&bSpan)return aSpan.start-bSpan.start;
    if(aSpan)return-1;if(bSpan)return 1;return 0;
  });
}
function reminderForDate(date){
  const dated=(pack?.reminders||[]).map((text,index)=>({text,index,span:eventSpan(text)}))
    .filter(item=>item.span&&date>=item.span.start&&date<=item.span.end)
    .sort((a,b)=>(a.span.end-a.span.start)-(b.span.end-b.span.start)||a.index-b.index)[0];
  if(dated)return dated.text;
  const deadline=eventItemsForDate(date).find(item=>kindClass(item)==="due");
  return deadline?deadline.label+".":"Check the homework folder and reading log.";
}
function currentParentNotices(){
  const now=today(),picture=(pack?.importantDates||[]).find(x=>/picture day/i.test(x.label||""));
  return(pack?.parentNotices||[]).filter(text=>{
    const span=eventSpan(text);
    if(span&&span.end<now)return false;
    if(/^Picture (ordering|backgrounds)/i.test(text)&&picture&&eventIsPast(picture,now))return false;
    return true;
  });
}
function lunchForDate(date){return(pack?.lunchMenu||[]).find(x=>sameDay(parseDate(x.day),date))||null}
function weekDays(){
  const base=today(),day=base.getDay(),mon=new Date(base);
  mon.setDate(base.getDate()-(day===0?6:day-1));
  return Array.from({length:5},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d});
}
function currentWeekRange(){const days=weekDays();return[days[0],days[4]]}
function upcomingTests(limit=6){
  const now=today();
  return(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.end>=now&&kindClass(o.x)==="test")
    .sort((a,b)=>a.span.start-b.span.start)
    .slice(0,limit)
    .map(o=>({x:o.x,d:o.span.start<now?new Date(now):o.span.start,span:o.span}));
}
function currentTest(){return upcomingTests(1)[0]||null}
function nextDeadline(){
  const now=today();
  return(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.end>=now&&kindClass(o.x)==="due")
    .sort((a,b)=>a.span.start-b.span.start)[0]||null;
}
function subject(re){return(pack?.subjects||[]).find(s=>re.test(s.subject||""))}
function readingSubject(){return subject(/Reading \/ ELA/i)}
function religionSubject(){return subject(/^Religion$/i)}
function mathSubject(){return subject(/^Math$/i)}
function spellingSubject(){return subject(/Spelling/i)}
function readingRoutine(){return subject(/Reading Routine/i)?.topics?.[0]||"Read for 20 minutes every day."}
function specialForDate(date){
  const prefix=WEEKDAY[date.getDay()]+":";
  const line=(subject(/^Specials$/i)?.topics||[]).find(x=>String(x).startsWith(prefix));
  return line?String(line).slice(prefix.length).trim():"";
}
function checkKey(item,index){return"abvm-gold:"+String(pack?.sourceHash||"pack")+":"+index+":"+(item?.task||"")}
function checked(item,index){return localStorage.getItem(checkKey(item,index))==="1"}
function familyKey(action,index){return"abvm-family:"+String(pack?.sourceHash||"pack")+":"+index+":"+action}
function familyChecked(action,index){return localStorage.getItem(familyKey(action,index))==="1"}
function taskHtml(item,index){
  const done=checked(item,index),subject=(item.subject||"").toLowerCase(),task=(item.task||"").toLowerCase(),due=(item.due||"").toLowerCase();
  let tag="POSTED",tagClass="";
  if(/parent/.test(subject)){tag="PARENT";tagClass="if-participating"}
  else if(/ongoing/.test(due)){tag="ONGOING";tagClass="if-participating"}
  else if(/folder/.test(subject)||/folder/.test(task)){tag="FOLDER";tagClass="if-participating"}
  return '<button class="check-item '+(done?'is-done':'')+'" type="button" data-check="'+index+'" aria-pressed="'+done+'">'+
    '<span class="check-box">'+(done?'✓':'')+'</span>'+
    '<span class="check-copy"><span class="task-tag '+tagClass+'">'+tag+'</span><strong>'+esc(item.task||"Task")+'</strong>'+(item.subject?'<small>'+esc(item.subject)+(item.due?' · '+esc(item.due):'')+'</small>':'')+'</span>'+
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
      detail:isToday?"Keep review short and calm. Focus on the teacher-posted material.":"Use short review sessions before "+fmtShort(next.d)+". Keep required reading in the normal routine."
    };
  }
  return{title:"Keep the week organized.",detail:"Use the teacher-posted work first and keep reading in the normal routine."};
}

function renderToday(){
  const d=today(),events=eventItemsForDate(d),lunch=lunchForDate(d),priority=weekPriority(),deadline=nextDeadline(),schedule=calendarScheduleEvent(events),contentEvents=calendarContentEvents(events);
  const mainEvent=contentEvents.find(e=>kindClass(e)==="test")||contentEvents[0]||schedule||null;
  const otherEvents=events.filter(e=>e!==mainEvent&&e!==schedule);
  const headline=mainEvent?.label||"Normal school day";
  const subline=otherEvents.length?otherEvents.map(e=>e.label).join(" · "):"Stay with the current homework and reading routine.";
  const deadlineHtml=deadline
    ?'<section class="today-deadline"><span class="deadline-icon">'+icon("pin")+'</span><div><p>NEXT DEADLINE</p><strong>'+esc(deadline.x.label)+'</strong><small>'+esc(deadline.x.date||fmtShort(deadline.span.start))+'</small></div></section>'
    :'<section class="today-deadline clear"><span class="deadline-icon">'+icon("check")+'</span><div><p>NEXT DEADLINE</p><strong>No posted deadline due</strong><small>Keep the normal school routine.</small></div></section>';
  const content='<div class="content overlap">'+
    '<section class="date-hero-card"><div class="big-date"><strong>'+WEEKDAY[d.getDay()].slice(0,3).toUpperCase()+'</strong><span>'+d.getDate()+'</span><small>Today</small></div><div class="date-hero-copy"><p>TODAY AT SCHOOL</p><h2>'+esc(headline)+'</h2><span>'+esc(subline)+'</span></div></section>'+
    (schedule?'<section class="schedule-alert '+kindClass(schedule)+'"><span>'+icon(kindClass(schedule)==="closed"?"ban":"clock")+'</span><div><small>'+esc(scheduleStatusText(schedule).toUpperCase())+'</small><strong>'+esc(scheduleStatusDetail(schedule))+'</strong></div></section>':'')+
    deadlineHtml+
    '<section class="gold-card glass-card homework-dashboard"><div class="checklist-title"><h3>Homework</h3><span class="edit-pill">'+homeworkStatus()+'</span></div><div class="task-list">'+(pack?.homework||[]).map(taskHtml).join("")+'</div></section>'+
    lunchCard(lunch)+
    '</div>';
  stack().innerHTML='<div class="screen" role="region" aria-label="Today">'+scene("today","TODAY",fmtDate(d),priority.title,false)+freshness()+content+'</div>';
}
function renderWeek(){
  const days=weekDays();
  if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=days.find(d=>sameDay(d,today()))||days[0];
  const events=eventItemsForDate(selectedDay),lunch=lunchForDate(selectedDay),special=specialForDate(selectedDay),schedule=calendarScheduleEvent(events);
  const now=today();
  const picker=days.map(d=>{
    const active=sameDay(d,selectedDay),isToday=sameDay(d,now),past=d<now;
    const classes=[active?"active":"",isToday?"today":"",past?"past":""].filter(Boolean).join(" ");
    return '<button class="'+classes+'" type="button" data-day="'+d.toISOString()+'" aria-label="'+esc(fmtDate(d)+(isToday?", today":""))+'" aria-pressed="'+active+'"><span>'+WEEKDAY[d.getDay()].slice(0,3)+'</span><strong>'+d.getDate()+'</strong></button>';
  }).join("");
  const future=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.start>selectedDay)
    .sort((a,b)=>a.span.start-b.span.start).slice(0,4)
    .map(o=>({x:o.x,d:o.span.start<selectedDay?selectedDay:o.span.start}));
  const noSchool=schedule&&kindClass(schedule)==="closed",halfDay=schedule&&kindClass(schedule)==="halfday",weekend=[0,6].includes(selectedDay.getDay());
  const dayStatus=noSchool?"No school":halfDay?"Half day • 12:00 PM":weekend?"Weekend":"School day";
  const note='<div class="week-hero-note"><span>CALM PLAN</span><b>Five days, one clear view</b></div>';
  stack().innerHTML='<div class="screen" role="region" aria-label="This week">'+scene("week","YOUR SCHOOL PLAN","This Week","Tap a day for events, lunch, and specials",false,note)+
    '<div class="content overlap"><div class="day-picker">'+picker+'</div>'+
    '<section class="day-detail"><div class="day-detail-inner"><div class="day-detail-title"><div><p>'+MONTHS[selectedDay.getMonth()].toUpperCase()+'</p><h2>'+esc(fmtDate(selectedDay))+'</h2></div><span class="school-day-pill '+(noSchool?'closed':halfDay?'halfday':weekend?'closed':'')+'">'+dayStatus+'</span></div>'+
    (schedule?'<div class="schedule-alert compact '+kindClass(schedule)+'"><span>'+icon(kindClass(schedule)==="closed"?"ban":"clock")+'</span><div><small>'+esc(scheduleStatusText(schedule).toUpperCase())+'</small><strong>'+esc(scheduleStatusDetail(schedule))+'</strong></div></div>':'')+
    (special&&!noSchool?'<div class="selected-special"><span>'+icon("star")+'</span><div><small>'+(halfDay?'USUAL SPECIAL':'SPECIAL')+'</small><strong>'+esc(special)+'</strong>'+(halfDay?'<em>Early dismissal may change the usual schedule.</em>':'')+'</div></div>':'')+
    '<div class="event-stack" style="margin-top:14px">'+(events.length?events.map(eventRow).join(""):'<div class="empty-note">No special school events are listed for this date.</div>')+'</div></div></section>'+
    lunchCard(lunch)+
    '<section class="reminder-strip"><span class="bang">!</span><p><strong>Don’t forget</strong>'+esc(reminderForDate(selectedDay))+'</p></section>'+
    '<section class="future-card"><h3>Coming soon</h3>'+(future.length?future.map(o=>'<div class="future-row"><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join(""):'<div class="empty-note">Nothing else is posted after this day yet.</div>')+'</section></div></div>';
}
function monthGrid(year,month){
  const first=new Date(year,month,1,12),last=new Date(year,month+1,0,12),blanks=first.getDay();
  let html="";
  for(let i=0;i<blanks;i++)html+='<span class="calendar-blank"></span>';
  for(let day=1;day<=last.getDate();day++){
    const d=new Date(year,month,day,12),events=eventItemsForDate(d),special=specialForDate(d);
    const schedule=calendarScheduleEvent(events),contentEvents=calendarContentEvents(events),primary=primaryCalendarEvent(contentEvents);
    const scheduleClass=schedule?kindClass(schedule):"",klass=primary?kindClass(primary):"";
    const weekend=[0,6].includes(d.getDay()),closed=scheduleClass==="closed",halfday=scheduleClass==="halfday";
    const specialPrimary=!primary&&!closed&&special?special.split(",")[0].trim():"";
    const label=primary?calendarLabel(primary):specialPrimary;
    const iconName=primary?eventIconName(primary):specialIconName(specialPrimary);
    const hiddenCount=Math.max(0,contentEvents.length-(primary?1:0))+((special&&primary&&!closed)?1:0);
    html+='<button class="'+(weekend?'weekend ':'')+(closed?'closed ':'')+(halfday?'halfday ':'')+(klass?('event-'+klass+' '):'')+(calendarDay&&sameDay(d,calendarDay)?'active':'')+'" type="button" data-cal-day="'+d.toISOString()+'" aria-pressed="'+Boolean(calendarDay&&sameDay(d,calendarDay))+'" aria-label="'+esc(fmtDate(d)+(events.length?': '+events.map(e=>e.label).join(', '):special?': '+special:''))+'"><strong>'+day+'</strong>'+
      (schedule?'<span class="calendar-status-flag '+scheduleClass+'">'+(scheduleClass==="closed"?"No School":"Half Day")+'</span>':'')+
      (label?'<span class="calendar-chip '+(klass||'special')+'"><span class="mini-icon">'+icon(iconName)+'</span><span>'+esc(label)+'</span></span>':'')+
      (hiddenCount?'<span class="calendar-more">+'+hiddenCount+' more</span>':'')+
      '</button>';
  }
  return html;
}
function renderCalendar(){
  const base=today(),shown=new Date(base.getFullYear(),base.getMonth()+calendarOffset,1,12),y=shown.getFullYear(),m=shown.getMonth();
  if(!calendarDay||calendarDay.getMonth()!==m||calendarDay.getFullYear()!==y){
    calendarDay=(base.getMonth()===m&&base.getFullYear()===y)?new Date(base):new Date(y,m,1,12);
  }
  const events=eventItemsForDate(calendarDay),lunch=lunchForDate(calendarDay),special=specialForDate(calendarDay),schedule=calendarScheduleEvent(events),contentEvents=calendarContentEvents(events),primary=primaryCalendarEvent(contentEvents),effectiveSpecial=(schedule&&kindClass(schedule)==="closed")?"":special,visual=calendarVisualFor(calendarDay,primary,effectiveSpecial);
  const monthStart=new Date(y,m,1,12),monthEnd=new Date(y,m+1,0,12);
  const agenda=[];
  for(let day=1;day<=monthEnd.getDate();day++){
    const d=new Date(y,m,day,12),items=eventItemsForDate(d);
    if(items.length)agenda.push({d,events:items,schedule:calendarScheduleEvent(items),content:calendarContentEvents(items)});
  }
  const monthPanel='<div class="calendar-month-panel '+(calendarMode==="month"?"active":"")+'">'+
      '<div class="calendar-weekdays">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>"<span>"+x+"</span>").join("")+'</div>'+
      '<div class="calendar-grid">'+monthGrid(y,m)+'</div>'+
    '</div>';
  const listPanel='<div class="calendar-list-panel '+(calendarMode==="list"?"active":"")+'">'+
      (agenda.length?agenda.map(o=>{
        const top=primaryCalendarEvent(o.content),count=o.events.length;
        const title=top?top.label:(o.schedule?o.schedule.label:"School event");
        return '<button class="calendar-list-row grouped" type="button" data-cal-day="'+o.d.toISOString()+'"><span class="calendar-list-date"><b>'+o.d.getDate()+'</b><small>'+WEEKDAY[o.d.getDay()].slice(0,3)+'</small></span>'+
          (o.schedule?'<span class="calendar-list-status '+kindClass(o.schedule)+'">'+esc(scheduleStatusText(o.schedule))+'</span>':'<span class="event-icon '+kindClass(top)+'">'+icon(eventIconName(top))+'</span>')+
          '<span class="calendar-list-copy"><strong>'+esc(title)+'</strong><small>'+count+' school event'+(count===1?"":"s")+(o.schedule?' · '+esc(scheduleStatusDetail(o.schedule)):'')+'</small></span><span class="chevron" aria-hidden="true">›</span></button>';
      }).join(""):'<div class="empty-note">No school dates are listed for this month.</div>')+
    '</div>';

  stack().innerHTML='<div class="screen calendar-screen" role="region" aria-label="'+MONTHS[m]+' calendar">'+
    scene("calendar","SCHOOL MONTH AT A GLANCE",MONTHS[m]+" "+y,"School Month at a Glance",false)+
    '<div class="calendar-wrap"><section class="calendar-card"><div class="calendar-title-row"><button class="month-arrow" data-month="-1" type="button" aria-label="Previous month">‹</button><div class="calendar-heading"><p>'+esc(calendarMode==="month"?"MONTH VIEW":"LIST VIEW")+'</p><h2>'+MONTHS[m]+" "+y+'</h2></div><button class="month-arrow" data-month="1" type="button" aria-label="Next month">›</button></div>'+
    '<div class="calendar-tabs"><button class="'+(calendarMode==="month"?"active":"")+'" data-cal-mode="month" type="button" aria-pressed="'+(calendarMode==="month")+'">Month View</button><button class="'+(calendarMode==="list"?"active":"")+'" data-cal-mode="list" type="button" aria-pressed="'+(calendarMode==="list")+'">List View</button></div>'+
    monthPanel+listPanel+'</section>'+
    '<section class="calendar-day-card '+(primary?('day-'+kindClass(primary)):'')+'"><div class="calendar-day-heading"><p>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</p><h2>'+esc(fmtDate(calendarDay))+'</h2></div>'+
    (schedule?'<div class="schedule-alert '+kindClass(schedule)+'"><span>'+icon(kindClass(schedule)==="closed"?"ban":"clock")+'</span><div><small>'+esc(scheduleStatusText(schedule).toUpperCase())+'</small><strong>'+esc(scheduleStatusDetail(schedule))+'</strong></div></div>':'')+
    (visual?'<figure class="calendar-day-visual"><img src="'+esc(visual.src)+'" alt="'+esc(visual.alt)+'" width="960" height="600" loading="lazy" decoding="async"></figure>':'')+
    (primary?'<div class="calendar-primary-event '+kindClass(primary)+'"><span class="event-icon '+kindClass(primary)+'">'+icon(eventIconName(primary))+'</span><div><small>'+esc(calendarLabel(primary).toUpperCase())+'</small><strong>'+esc(primary.label)+'</strong></div></div>':'')+
    (effectiveSpecial?'<div class="calendar-special"><span>'+icon(specialIconName(effectiveSpecial))+'</span><div><small>'+(schedule&&kindClass(schedule)==="halfday"?'USUAL CLASS SPECIAL':'CLASS SPECIAL')+'</small><strong>'+esc(effectiveSpecial)+'</strong>'+(schedule&&kindClass(schedule)==="halfday"?'<em>Early dismissal may change the usual schedule.</em>':'')+'</div></div>':'')+
    (contentEvents.length>1?'<div class="calendar-event-list">'+contentEvents.filter(e=>e!==primary).map(e=>'<div><span class="event-icon '+kindClass(e)+'">'+icon(eventIconName(e))+'</span><span><strong>'+esc(e.label)+'</strong></span></div>').join("")+'</div>':(!events.length&&!effectiveSpecial?'<p class="calendar-empty">Regular school day. No special events are posted.</p>':''))+
    (lunch?'<div class="calendar-lunch"><img class="calendar-lunch-photo" src="'+esc(lunch.image||"")+'" width="720" height="720" loading="lazy" decoding="async" alt="'+esc(lunch.imageAlt||"School lunch")+'"><div><b>School Lunch</b><p>'+esc((lunch.items||[]).join(", ").replace(/, ([^,]*)$/,", and $1"))+'</p></div></div>':'')+'</section>'+
    '</div></div>';
}
function subjectCard(id,klass,title,icon,subj){
  const notes=[...(subj?.topics||[]),...(subj?.studyNotes||[])].filter((n,i,a)=>n&&a.indexOf(n)===i);
  return '<section id="'+id+'" class="subject-card '+klass+'"><div class="subject-head"><span class="icon" aria-hidden="true">'+icon+'</span><div><p>'+esc(title.toUpperCase())+'</p><h2>'+esc(title)+'</h2></div></div><ul>'+notes.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul></section>';
}
function renderStudy(){
  const r=readingSubject(),rel=religionSubject(),math=mathSubject(),spell=spellingSubject();
  const [,fri]=currentWeekRange(),now=today();
  const assessments=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.end>=now&&o.span.start<=fri&&kindClass(o.x)==="test")
    .sort((a,b)=>a.span.start-b.span.start)
    .map(o=>({x:o.x,d:o.span.start<now?new Date(now):o.span.start,span:o.span}));
  const starActive=(pack?.importantDates||[]).some(x=>/star/i.test(x.label||"")&&eventSpan(x.date)?.end>=now);
  const essentials=[{when:"Daily",label:readingRoutine(),icon:icon("book"),klass:"green"},...assessments.slice(0,4).map((o,i)=>({when:fmtShort(o.d),label:o.x.label,icon:icon(eventIconName(o.x)),klass:["yellow","pink","blue","pink"][i]||"blue"}))];
  const sight=(r?.topics||[]).find(x=>/^Sight words:/i.test(x))?.replace(/^Sight words:\s*/i,"").split(",").map(x=>x.trim()).filter(Boolean)||[];
  const vocab=(pack?.vocabulary||[]).map(v=>v.term);
  stack().innerHTML='<div class="screen study-screen" role="region" aria-label="Study room">'+
    scene("study","THIS WEEK","Study","Everything to review, in one calm place",true)+
    '<div class="study-content"><section class="study-intro"><span class="study-bulb">'+icon("idea")+'</span><div><h2>Start with what is next</h2><p>Tests and daily reading are first. Subject details are below.</p></div></section>'+
    '<section class="study-at-a-glance"><div class="section-label">TESTS & DAILY ROUTINE</div><h2>Quick Look</h2>'+essentials.map(e=>'<div class="essential-row"><span class="essential-icon '+e.klass+'">'+e.icon+'</span><div><time>'+esc(e.when)+'</time><strong>'+esc(e.label)+'</strong></div></div>').join("")+'</section>'+
    subjectCard("study-reading","reading","Reading",icon("book"),r)+
    subjectCard("study-spelling","spelling","Spelling and phonics",icon("pencil"),spell)+
    subjectCard("study-religion","religion",rel?.subject||"Religion",icon("cross"),rel)+
    subjectCard("study-math","math","Math",icon("math"),math)+
    '<section id="study-words" class="subject-card sight words-card"><div class="subject-head"><span class="icon">'+icon("words")+'</span><div><p>WORDS</p><h2>Sight words & vocabulary</h2></div></div>'+
      '<h3 class="word-subhead">Sight words</h3><div class="sight-cloud">'+sight.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div>'+
      '<h3 class="word-subhead">Vocabulary</h3><div class="word-grid">'+vocab.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></section>'+
    (starActive?'<section class="calm-card"><h3>STAR reminder</h3><p>Keep assessment preparation calm. Normal reading, normal routines, and a good night’s sleep are enough.</p></section>':'')+
    '<section class="calm-card study-tip"><span>'+icon("check")+'</span><div><h3>Keep review short and focused</h3><p>Use the teacher-posted material above, then stop when the planned review is complete.</p></div></section>'+
    '</div></div>';
}
function renderFamily(){
  const priority=weekPriority(),[mon,fri]=currentWeekRange(),now=today();
  const tests=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.end>=now&&o.span.start<=fri&&kindClass(o.x)==="test").length;
  const dueItems=(pack?.importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
    .filter(o=>o.span&&o.span.end>=now&&kindClass(o.x)==="due")
    .sort((a,b)=>a.span.start-b.span.start);
  const nextDue=dueItems[0]||null;
  const actions=[...(pack?.homework||[]).map(x=>x.task),...currentReminders()].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,12);
  const notices=currentParentNotices(),gaps=pack?.gaps||[];
  stack().innerHTML='<div class="screen family-screen" role="region" aria-label="Family dashboard">'+
    scene("family","FAMILY VIEW","Family","The practical details that keep school days running smoothly",false)+freshness()+
    '<div class="family-content"><section class="family-priority"><p>WEEKLY PRIORITY</p><h2>'+esc(priority.title)+'</h2><span>'+esc(priority.detail)+'</span></section>'+
    '<div class="family-stats"><article><strong>'+tests+'</strong><span>tests or assessments remaining this week</span></article><article><strong>'+esc(nextDue?fmtShort(nextDue.span.start):"✓")+'</strong><span>'+esc(nextDue?nextDue.x.label:"No posted deadline due")+'</span></article></div>'+
    '<section class="family-card"><h3>Family checklist</h3><div class="family-actions">'+actions.map((a,i)=>'<button class="family-action '+(familyChecked(a,i)?'is-done':'')+'" type="button" data-family-check="'+i+'" aria-pressed="'+familyChecked(a,i)+'"><span class="box">'+(familyChecked(a,i)?icon("check"):'')+'</span><span>'+esc(a)+'</span></button>').join("")+'</div></section>'+
    '<section class="reading-policy"><span class="round">20</span><div><h3>Reading every day</h3><p>Read or be read to for 20 minutes and keep the Reading Log in the homework folder.</p></div></section>'+
    '<section class="family-card"><h3>Current notices</h3><div class="notice-list">'+notices.map(n=>'<div class="notice"><span class="notice-dot"></span><p>'+esc(n)+'</p></div>').join("")+'</div></section>'+
    '<section class="family-card"><h3>Source coverage</h3><div class="notice-list"><div class="notice"><span class="notice-dot"></span><p>'+esc(envelope?.source||"Verified ABVM school sources")+'</p></div>'+(uploadedNoticeStatus()?'<div class="notice"><span class="notice-dot"></span><p>'+esc(uploadedNoticeStatus())+'</p></div>':'')+gaps.map(n=>'<div class="notice"><span class="notice-dot"></span><p>'+esc(n)+'</p></div>').join("")+'</div></section>'+
    '<section class="install-card"><span class="install-icon">'+icon("home")+'</span><div><h3>Put this app on iPhone</h3><p>In Safari, use Share → Add to Home Screen for an app-like launch experience.</p></div></section>'+
    '</div></div>';
}
function render(){
  if(!pack)return;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderStudy,family:renderFamily}[activeTab]||renderToday)();
  $$(".bottom-nav button").forEach(b=>{const on=b.dataset.tab===activeTab;b.classList.toggle("active",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
  const screen=stack().querySelector(".screen");if(screen)screen.scrollTop=0;bindScreen();
}
function bindScreen(){
  $$("[data-check]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.check),item=(pack.homework||[])[i],k=checkKey(item,i);localStorage.getItem(k)==="1"?localStorage.removeItem(k):localStorage.setItem(k,"1");render()}));
  $$("[data-family-check]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.familyCheck),actions=[...(pack?.homework||[]).map(x=>x.task),...currentReminders()].filter((x,j,a)=>x&&a.indexOf(x)===j).slice(0,12),action=actions[i],k=familyKey(action,i);localStorage.getItem(k)==="1"?localStorage.removeItem(k):localStorage.setItem(k,"1");renderFamily();bindScreen()}));
  $$("[data-day]").forEach(b=>b.addEventListener("click",()=>{selectedDay=new Date(b.dataset.day);renderWeek();bindScreen()}));
  $$("[data-cal-day]").forEach(b=>b.addEventListener("click",()=>{calendarDay=new Date(b.dataset.calDay);renderCalendar();bindScreen()}));
  $$("[data-month]").forEach(b=>b.addEventListener("click",()=>{calendarOffset+=Number(b.dataset.month);calendarDay=null;renderCalendar();bindScreen()}));
  $$("[data-cal-mode]").forEach(b=>b.addEventListener("click",()=>{calendarMode=b.dataset.calMode;renderCalendar();bindScreen()}));
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
async function load(){
  let data;
  try{
    const r=await fetch("./data/study-pack.json",{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    data=await r.json();if(!data?.pack?.sourceSufficient)throw new Error("Incomplete school pack");
  }catch(e){
    stack().innerHTML='<div class="screen"><div class="content load-error"><section class="gold-card"><div class="section-label">ABVM GRADE 2</div><h1 class="card-title">School information is temporarily unavailable</h1><p class="muted">Your saved checklist is safe. Check your connection, then refresh the page.</p><button class="retry-button" type="button" onclick="location.reload()">Try again</button></section></div></div>';
    return;
  }
  envelope=data;pack=data.pack;render();
}
load();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();
