(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stack=()=>$("#app-content");
let envelope=null, pack=null, activeTab=(["today","week","calendar","study","games","family"].includes(location.hash.slice(1))?location.hash.slice(1):"today"), selectedDay=null, calendarDay=null, weekOffset=0, calendarOffset=0;
let studyGameCatalogCache=null, studyEnginePromise=null, screenEventsBound=false, lastPackFetchAt=0, packRefreshPromise=null, manualRefreshActive=false, gameState={screen:"menu",mode:null,questions:[],index:0,score:0,streak:0,bestStreak:0,selectedIndex:null,answered:false,hintOpen:false,saved:false};

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const WEEKDAY=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SCHOOL_TIME_ZONE="America/New_York";
const PACK_URL="./data/study-pack.json";
const PACK_REFRESH_MS=5*60*1000;

function storageGet(key){try{return localStorage.getItem(key)}catch{return null}}
function storageSet(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}
function storageRemove(key){try{localStorage.removeItem(key);return true}catch{return false}}

function toast(message){
  let t=$("#toast");
  if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.append(t);}
  t.textContent=message;t.classList.add("show");
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),1700);
}
function parseDate(text){
  if(!text)return null;
  const m=String(text).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!m)return null;
  const month=SHORT_MONTHS[m[1].toLowerCase()], day=Number(m[2]);
  const now=today(); let year=now.getFullYear();
  if(now.getMonth()>=7&&month<=5)year++;
  else if(now.getMonth()<=5&&month>=7)year--;
  return new Date(year,month,day,12);
}
function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function fmtDate(d){return d?WEEKDAY[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate():"";}
function fmtShort(d){return d?WEEKDAY[d.getDay()].slice(0,3)+" "+d.getDate():"";}
function schoolLogo(){return '<img class="school-mark" src="./assets/abvm-app-icon-192.png" alt="Assumption BVM Catholic School logo">';}
function header(kicker,title){
  return '<header class="app-header"><div><p>'+esc(kicker)+'</p><h1>'+esc(title)+'</h1></div>'+schoolLogo()+'</header>';
}
function freshnessState(){
  const raw=envelope?.sourceLastSeenAt||pack?.sourceCapturedAt||pack?.generatedAt;
  const d=raw?new Date(raw):null;
  if(!d||Number.isNaN(d.getTime()))return{state:"attention",label:"Source verification unavailable"};
  const stamp=d.toLocaleDateString(undefined,{month:"short",day:"numeric",timeZone:SCHOOL_TIME_ZONE})+" at "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit",timeZone:SCHOOL_TIME_ZONE})+" ET";
  const ageHours=(Date.now()-d.getTime())/3600000;
  if(navigator.onLine===false)return{state:"offline",label:"Offline · last verified "+stamp};
  if(ageHours>30)return{state:"attention",label:"Needs refresh · last verified "+stamp};
  if(ageHours>8)return{state:"stale",label:"Older data · last verified "+stamp};
  return{state:"current",label:"Verified "+stamp};
}
function freshness(){
  const state=freshnessState(),label=manualRefreshActive?"Checking published school info…":state.label;
  const action=manualRefreshActive?"Checking published school information":"Check published school information. "+state.label;
  return '<button type="button" class="freshness '+state.state+(manualRefreshActive?' is-refreshing':'')+'" data-refresh-pack aria-label="'+esc(action)+'"'+(manualRefreshActive?' disabled':'')+'><span aria-hidden="true"></span><strong>'+esc(label)+'</strong><b aria-hidden="true">↻</b></button>';
}
function kindClass(item){
  const k=(item?.kind||"").toLowerCase(), l=(item?.label||"").toLowerCase();
  if(/test|assessment/.test(k)||/test|star reading/.test(l))return "test";
  if(/mass|relig|faith/.test(k)||/mass/.test(l))return "faith";
  if(/deadline|due/.test(k)||/due|money|order|rsvp/.test(l))return "due";
  if(/club/.test(k)||/lego/.test(l))return "club";
  if(/holiday|closed/.test(k)||/no school|closed/.test(l))return "closed";
  return "family";
}
function eventDateRange(text){
  const value=String(text||"");
  const m=value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})\s*[–-]\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{1,2})/i);
  if(!m){const d=parseDate(value);return d?[d,d]:null;}
  const start=parseDate(m[1]+" "+m[2]); if(!start)return null;
  const endMonth=SHORT_MONTHS[(m[3]||m[1]).toLowerCase()];
  let endYear=start.getFullYear(); if(endMonth<start.getMonth())endYear++;
  const end=new Date(endYear,endMonth,Number(m[4]),12);
  return [start,end];
}
function eventItemsForDate(date){
  return (pack?.importantDates||[]).filter(x=>{
    const range=eventDateRange(x.date); return range&&date>=range[0]&&date<=range[1];
  });
}
function lunchForDate(date){
  const key=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
  return [...(pack?.lunchMenu||[]),...(pack?.lunchArchive||[])].find(x=>x.date?x.date===key:sameDay(parseDate(x.day),date))||null;
}
function keyPart(value){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90)||"item";}
function taskWeekKey(){return keyPart(pack?.weekLabel||"current-week");}
function checkKey(item){return "abvm-task:v2:"+taskWeekKey()+":"+keyPart(item?._sourceSubject||item?.subject)+":"+keyPart(item?.task||item?.label);}
function legacyCheckKey(item,index){return "abvm-old-look:"+String(pack?.sourceHash||"pack")+":"+index+":"+(item?.task||item?.label||"");}
function checked(item,index){
  const key=checkKey(item);
  if(storageGet(key)==="1")return true;
  if(storageGet(legacyCheckKey(item,index))==="1"){storageSet(key,"1");return true;}
  return false;
}
function toggleChecked(item,index){
  const key=checkKey(item),legacy=legacyCheckKey(item,index);
  if(checked(item,index)){storageRemove(key);storageRemove(legacy);}
  else storageSet(key,"1");
  render();
}
function taskPolicy(item){
  const task=String(item?.task||"").trim(),subject=String(item?.subject||"").trim();
  const haystack=(subject+" "+task).toLowerCase();
  if(/cover books|reading log and behavior chart|return everything in the hw folder/.test(haystack)){
    return{type:"background-routine",today:false,family:false};
  }
  if(/^read$/i.test(task))return{type:"daily-habit",today:true,family:false,subject:"20 minutes today"};
  if(/^attend mass$/i.test(task))return{type:"current-action",today:true,family:false};
  if(/parent|if participating|forms/.test(haystack))return{type:"parent-action",today:false,family:true};
  return{type:"current-action",today:true,family:true};
}
function taskRecordsForSurface(surface){
  return (pack?.homework||[]).map((item,index)=>({item,index,policy:taskPolicy(item)}))
    .filter(record=>record.policy[surface]!==false)
    .map(record=>record.policy.subject?{...record,item:{...record.item,_sourceSubject:record.item.subject,subject:record.policy.subject}}:record);
}
function taskHtml(item,index){
  const done=checked(item,index);
  const optional=/parent|if participating/i.test((item.subject||"")+" "+(item.task||"")) || /forms|cover books/i.test(item.task||"");
  const tag=optional?"IF PARTICIPATING":"REQUIRED";
  const action=(done?"Completed: ":"Mark complete: ")+(item.task||"Task");
  return '<button type="button" class="check-item'+(done?' is-done':'')+'" data-check="'+index+'" aria-pressed="'+(done?"true":"false")+'" aria-label="'+esc(action)+'"><span class="check-box" aria-hidden="true">'+(done?"✓":"")+'</span><span class="check-copy"><span class="task-tag '+(optional?"if-participating":"required")+'">'+tag+'</span><strong>'+esc(item.task||"Task")+'</strong>'+(item.subject?'<small>'+esc(item.subject)+'</small>':'')+'</span></button>';
}
function schoolDateParts(value=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:SCHOOL_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return{year:Number(map.year),month:Number(map.month),day:Number(map.day)};
}
function today(){
  const parts=schoolDateParts();
  return new Date(parts.year,parts.month-1,parts.day,12);
}
function mondayFor(date){
  const base=new Date(date); base.setHours(12,0,0,0);
  const day=base.getDay(); base.setDate(base.getDate()-(day===0?6:day-1));
  return base;
}
function weekDays(offset=weekOffset){
  const mon=mondayFor(today()); mon.setDate(mon.getDate()+(offset*7));
  return Array.from({length:5},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return x;});
}
function weekRangeLabel(days){
  const first=days[0],last=days[days.length-1];
  const a=MONTHS[first.getMonth()].slice(0,3)+" "+first.getDate();
  const b=(first.getMonth()===last.getMonth()?"":MONTHS[last.getMonth()].slice(0,3)+" ")+last.getDate();
  return a+" – "+b;
}
function isPackWeek(days){
  const sourceStart=parseDate(pack?.weekLabel||"");
  return !!sourceStart&&days.some(d=>sameDay(d,sourceStart));
}
function lunchText(lunch){
  return lunch?.items?.length?lunch.items.join(", ").replace(/, ([^,]*)$/,", and $1"):"";
}
function lunchUnavailableText(date){
  return "Lunch menu not yet verified for "+MONTHS[date.getMonth()]+" "+date.getDate()+".";
}
function lunchCardHtml(date,lunch){
  const closed=lunch?.status==="no-school"||eventItemsForDate(date).some(e=>kindClass(e)==="closed");
  if([0,6].includes(date.getDay()))return "";
  const message=closed?"No school lunch":lunch?lunchText(lunch):lunchUnavailableText(date);
  const retained=lunch&&!closed&&pack?.lunchMenuSource?.retrievalState!=="verified";
  return '<section class="lunch-card'+(!lunch&&!closed?' lunch-missing':'')+'"><span aria-hidden="true">🍎</span><div><p>SCHOOL LUNCH</p><strong>'+esc(message)+'</strong>'+(retained?'<small>Saved school menu · source check needs attention</small>':'')+'</div></section>';
}
function currentTest(){
  const now=today();
  const upcoming=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>=now&&kindClass(o.x)==="test").sort((a,b)=>a.d-b.d);
  return upcoming[0]||null;
}
function readingSubject(){return (pack?.subjects||[]).find(s=>/Reading \/ ELA/i.test(s.subject||""));}
function religionSubject(){return (pack?.subjects||[]).find(s=>/^Religion$/i.test(s.subject||""));}
function mathSubject(){return (pack?.subjects||[]).find(s=>/^Math$/i.test(s.subject||""));}
function spellingSubject(){return (pack?.subjects||[]).find(s=>/Spelling/i.test(s.subject||""));}
function readingRoutine(){return (pack?.subjects||[]).find(s=>/Reading Routine/i.test(s.subject||""))?.topics?.[0]||"Read for 20 minutes every day.";}

function reminderRange(text){return eventDateRange(text)}
function reminderForDate(date){
  const rows=(pack?.reminders||[]).map(text=>({text,range:reminderRange(text)})).filter(row=>row.range);
  const exact=rows.find(row=>date>=row.range[0]&&date<=row.range[1]);
  if(exact)return exact.text;
  return rows.filter(row=>row.range[0]>=date).sort((a,b)=>a.range[0]-b.range[0])[0]?.text||"";
}
function upcomingReminderTexts(date=today(),limit=6){
  const timed=(pack?.reminders||[]).map(text=>({text,range:reminderRange(text)}))
    .filter(row=>row.range&&row.range[1]>=date)
    .sort((a,b)=>a.range[0]-b.range[0]).map(row=>row.text);
  return [...new Set(timed)].slice(0,limit);
}
function linkedNoticeExpiry(text){
  if(/^Picture (?:ordering|backgrounds):/i.test(String(text||""))){
    const picture=(pack?.importantDates||[]).find(item=>/\bPicture Day\b/i.test(item.label||""));
    return eventDateRange(picture?.date)?.[1]||null;
  }
  return null;
}
function currentNoticeTexts(date=today()){
  return (pack?.parentNotices||[]).filter(text=>{
    const range=eventDateRange(text),expiry=range?.[1]||linkedNoticeExpiry(text);
    return !expiry||expiry>=date;
  });
}
function specialsRows(){
  const source=(pack?.subjects||[]).find(s=>/^Specials$/i.test(s.subject||""));
  return (source?.topics||[]).map(line=>{
    const m=String(line).match(/^(Monday|Tuesday|Wednesday|Thursday|Friday):\s*(.+)$/i);
    return m?{day:m[1].slice(0,3),label:m[2]}:null;
  }).filter(Boolean);
}
function calendarBase(){
  const now=today();
  return new Date(now.getFullYear(),now.getMonth()+calendarOffset,1,12);
}

function todayTaskRecords(){return taskRecordsForSurface("today");}

function studyGameIconHtml(modeId){
  const icons={
    quick:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icon-fill" d="m24 6 5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L24 33.1l-10.6 5.6 2-11.8-8.6-8.4 11.9-1.7L24 6Z"/><path class="icon-spark" d="M37.5 7.5v6M34.5 10.5h6"/></svg>',
    math:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="icon-outline" x="9" y="6.5" width="30" height="35" rx="6"/><rect class="icon-screen" x="14" y="11" width="20" height="7" rx="2.5"/><path class="icon-stroke" d="M16 26h7M19.5 22.5v7M28 26h6M16 34h7M28 34h6"/></svg>',
    words:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icon-book" d="M7.5 11.5c5.5-1.4 10.5-.6 16.5 3.1v24c-5.7-3.5-11-4.3-16.5-2.7V11.5Z"/><path class="icon-book" d="M40.5 11.5c-5.5-1.4-10.5-.6-16.5 3.1v24c5.7-3.5 11-4.3 16.5-2.7V11.5Z"/><text class="icon-letter" x="13" y="27">A</text><text class="icon-letter small" x="29" y="29">a</text></svg>',
    faith:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="icon-halo" cx="24" cy="24" r="18"/><path class="icon-cross" d="M24 12v24M17 20h14"/><path class="icon-ray" d="M10 12l3 3M38 12l-3 3M9 31l4-2M39 31l-4-2"/></svg>'
  };
  return '<span class="study-game-icon game-icon-'+esc(modeId)+'" aria-hidden="true">'+(icons[modeId]||icons.quick)+'</span>';
}

function renderToday(){
  const d=today(), events=eventItemsForDate(d), lunch=lunchForDate(d), next=currentTest();
  const tests=events.filter(e=>kindClass(e)==="test");
  const headline=tests.length?tests.map(e=>e.label.replace(/\s*\/\s*/g," and ")).join(", "):events[0]?.label||"School day";
  let timeline=events.map(e=>'<div class="timeline-row"><time>School</time><span class="timeline-pin '+kindClass(e)+'"></span><div><strong>'+esc(e.label)+'</strong>'+(e.kind?'<small>'+esc(e.kind)+'</small>':'')+'</div><i></i></div>').join("");
  if(!timeline) timeline='<div class="timeline-row"><time>School</time><span class="timeline-pin family"></span><div><strong>No special school events are listed for this date.</strong></div></div>';
  const tasks=todayTaskRecords();
  const html='<div class="screen" role="region" aria-label="Today">'+
    header("ABVM GRADE 2 · "+fmtDate(d).toUpperCase(),"Hi, school star!")+
    freshness()+
    '<section class="hero-card"><span class="spark spark-one">★</span><span class="spark spark-two">♥</span><div class="hero-copy"><p class="pill">ONE STEP AT A TIME</p><h2>A calm plan for the week</h2><p>Start with what is due soon. Check off one item, then keep going when you are ready.</p></div><div class="book-buddy"><span>📚</span></div></section>'+
    '<div class="section-heading"><h2><span class="heading-dot pink"></span>Up next</h2></div>'+
    (next?'<section class="priority-card"><div class="date-tile"><strong>'+esc(WEEKDAY[next.d.getDay()].slice(0,3).toUpperCase())+'</strong><span>'+next.d.getDate()+'</span></div><div><p>CLOSEST TEST</p><h3>'+esc(next.x.label)+'</h3><span>Keep review short and focused.</span></div></section>':'<section class="priority-card"><div class="date-tile"><strong>★</strong><span>✓</span></div><div><p>UP NEXT</p><h3>No upcoming test is currently listed</h3><span>Keep up with the posted homework and reading routine.</span></div></section>')+
    '<div class="section-heading"><h2><span class="heading-dot blue"></span>'+esc(fmtDate(d))+'</h2></div>'+
    '<section class="today-panel"><div class="timeline">'+timeline+'</div><div class="task-list">'+tasks.map(({item,index})=>taskHtml(item,index)).join("")+'</div></section>'+
    lunchCardHtml(d,lunch)+
    '</div>';
  stack().innerHTML=html;
}

function renderWeek(){
  const days=weekDays();
  if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=weekOffset===0?(days.find(d=>sameDay(d,today()))||days[0]):days[0];
  const events=eventItemsForDate(selectedDay), lunch=lunchForDate(selectedDay);
  const picker=days.map(d=>'<button type="button" class="'+(sameDay(d,selectedDay)?"active":"")+'" data-day="'+d.toISOString()+'" aria-label="'+esc(fmtDate(d))+'" aria-pressed="'+(sameDay(d,selectedDay)?"true":"false")+'"><span>'+WEEKDAY[d.getDay()].slice(0,3)+'</span><strong>'+d.getDate()+'</strong></button>').join("");
  const eventRows=events.length?events.map(e=>'<div class="event-row"><time>'+esc((e.kind||"School").replace(/\b\w/g,m=>m.toUpperCase()))+'</time><div><strong>'+esc(e.label)+'</strong></div></div>').join(""):'<div class="event-row"><time>School</time><div><strong>No special school events are listed.</strong></div></div>';
  const sourceWeek=isPackWeek(days), tasks=sourceWeek?(pack?.homework||[]):[];
  const checklist=tasks.length?tasks.map(taskHtml).join(""):'<div class="week-empty"><strong>No checklist has been verified for this week yet.</strong><span>Calendar dates still appear below, and new homework will show here after the school source refreshes.</span></div>';
  const future=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>selectedDay).sort((a,b)=>a.d-b.d).slice(0,4);
  stack().innerHTML='<div class="screen" role="region" aria-label="This week">'+
    header("YOUR SCHOOL PLAN","This week")+freshness()+
    '<nav class="week-nav" aria-label="Change displayed week"><button type="button" data-week-step="-1" aria-label="Previous week">‹</button><div aria-live="polite"><span>'+(weekOffset===0?"CURRENT WEEK":"VIEWING WEEK")+'</span><strong>'+esc(weekRangeLabel(days))+'</strong></div><button type="button" data-week-step="1" aria-label="Next week">›</button></nav>'+
    (weekOffset!==0?'<button class="week-today-jump" type="button" data-week-today>Back to this week</button>':'')+
    '<div class="day-picker">'+picker+'</div>'+
    '<section class="day-detail green"><div class="day-detail-title"><div><p>'+MONTHS[selectedDay.getMonth()].toUpperCase()+'</p><h2>'+esc(fmtDate(selectedDay))+'</h2></div><span>School day</span></div><div class="event-stack">'+eventRows+'</div><h3>My checklist</h3>'+checklist+'</section>'+
    lunchCardHtml(selectedDay,lunch)+
    (reminderForDate(selectedDay)?'<section class="reminder-strip"><span>!</span><p><strong>Don’t forget</strong>'+esc(reminderForDate(selectedDay))+'</p></section>':'')+
    '<section class="future-card"><h3>Coming soon</h3>'+future.map(o=>'<div><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join("")+'</section>'+
    '</div>';
}
function monthGrid(year,month){
  const first=new Date(year,month,1,12), last=new Date(year,month+1,0,12), blanks=first.getDay();
  let html=""; for(let i=0;i<blanks;i++)html+='<span class="calendar-blank"></span>';
  for(let day=1;day<=last.getDate();day++){
    const d=new Date(year,month,day,12), events=eventItemsForDate(d), lunch=lunchForDate(d);
    const dots=[...events.map(e=>kindClass(e)),...(lunch?["lunch"]:[])].slice(0,3);
    const weekend=[0,6].includes(d.getDay()), closed=events.some(e=>kindClass(e)==="closed");
    const eventLabel=events.length?": "+events.map(e=>e.label).join(", "):"";
    html+='<button type="button" class="'+(weekend?"weekend ":"")+(closed?"closed ":"")+(calendarDay&&sameDay(d,calendarDay)?"active":"")+'" data-cal-day="'+d.toISOString()+'" aria-label="'+esc(fmtDate(d)+eventLabel)+'" aria-pressed="'+(calendarDay&&sameDay(d,calendarDay)?"true":"false")+'"><strong>'+day+'</strong><span class="calendar-dots" aria-hidden="true">'+dots.map(k=>'<i class="'+k+'"></i>').join("")+'</span></button>';
  }
  return html;
}
function monthAgendaDays(year,month){
  const last=new Date(year,month+1,0,12).getDate(),days=[];
  for(let n=1;n<=last;n++){
    const d=new Date(year,month,n,12),weekend=[0,6].includes(d.getDay());
    if(!weekend||eventItemsForDate(d).length||lunchForDate(d))days.push(d);
  }
  return days;
}
function agendaLunchHtml(date,lunch){
  const events=eventItemsForDate(date),closed=events.some(e=>kindClass(e)==="closed"),weekend=[0,6].includes(date.getDay());
  const text=closed||weekend||lunch?.status==="no-school"?"No school lunch":lunch?lunchText(lunch):lunchUnavailableText(date);
  return '<div class="agenda-lunch'+(lunch?"":" is-missing")+'"><span>🍎</span><div><b>Lunch</b><p>'+esc(text)+'</p></div></div>';
}
function agendaDayHtml(date){
  const events=eventItemsForDate(date),lunch=lunchForDate(date),closed=events.some(e=>kindClass(e)==="closed"),weekend=[0,6].includes(date.getDay());
  const status=closed?"No school":(weekend?"Weekend":"School day");
  const rows=events.length?events.map(e=>'<div class="agenda-event"><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong>'+(e.kind?'<small>'+esc(e.kind)+'</small>':'')+'</span></div>').join(""):'<div class="agenda-event agenda-regular"><i class="family"></i><span><strong>Regular school day</strong><small>No special event is currently listed.</small></span></div>';
  return '<article class="agenda-day month-agenda-row"><header><div><p>'+WEEKDAY[date.getDay()].toUpperCase()+'</p><h3>'+MONTHS[date.getMonth()]+' '+date.getDate()+'</h3></div><span>'+status+'</span></header><div class="agenda-events">'+rows+'</div>'+agendaLunchHtml(date,lunch)+'</article>';
}

function renderCalendar(){
  const base=calendarBase(),y=base.getFullYear(),m=base.getMonth();
  if(!calendarDay||calendarDay.getFullYear()!==y||calendarDay.getMonth()!==m){
    const now=today();
    calendarDay=calendarOffset===0?new Date(now):new Date(y,m,1,12);
  }
  const events=eventItemsForDate(calendarDay),lunch=lunchForDate(calendarDay);
  const agendaDays=monthAgendaDays(y,m);
  const nextMonthDate=new Date(y,m+1,1,12),nextY=nextMonthDate.getFullYear(),nextM=nextMonthDate.getMonth();
  const nextMonth=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d.getMonth()===nextM&&o.d.getFullYear()===nextY).sort((a,b)=>a.d-b.d).slice(0,5);
  const specials=specialsRows();
  stack().innerHTML='<div class="screen calendar-screen" role="region" aria-label="'+MONTHS[m]+' calendar">'+
    header("SCHOOL MONTH AT A GLANCE",MONTHS[m]+" "+y)+freshness()+
    '<nav class="calendar-month-nav" aria-label="Change calendar month"><button type="button" data-cal-step="-1" aria-label="Previous month">‹</button><div aria-live="polite"><strong>'+MONTHS[m]+' '+y+'</strong><span>'+(calendarOffset===0?"Current month":"Browsing calendar")+'</span></div><button type="button" data-cal-step="1" aria-label="Next month">›</button></nav>'+
    (calendarOffset!==0?'<button type="button" class="calendar-today-jump" data-cal-today>Back to current month</button>':'')+
    '<section class="calendar-card"><div class="calendar-title-row"><div><p>MONTH VIEW</p><h2>'+MONTHS[m]+'</h2></div><span>Tap any date</span></div><div class="calendar-weekdays">'+["S","M","T","W","T","F","S"].map(x=>"<span>"+x+"</span>").join("")+'</div><div class="calendar-grid">'+monthGrid(y,m)+'</div><div class="calendar-legend"><span><i class="test"></i>Test</span><span><i class="faith"></i>Faith</span><span><i class="family"></i>Family</span><span><i class="due"></i>Due</span><span><i class="lunch"></i>Lunch</span></div></section>'+
    '<section class="calendar-day-card" aria-live="polite"><div class="calendar-day-heading"><div><p>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</p><h2>'+MONTHS[calendarDay.getMonth()]+" "+calendarDay.getDate()+'</h2></div></div>'+
      (events.length?'<div class="calendar-event-list">'+events.map(e=>'<div><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong></span></div>').join("")+'</div>':'<p class="calendar-empty">No special school events are listed for this date.</p>')+
      agendaLunchHtml(calendarDay,lunch)+
    '</section>'+
    '<section class="month-agenda"><div class="month-agenda-head"><span class="month-agenda-mark" aria-hidden="true">▦</span><div><p>MONTH AGENDA</p><h2>'+MONTHS[m]+' full agenda</h2></div></div><p class="month-agenda-note">Every school day is included. Lunch is shown when it has been verified; otherwise the app says that it has not been posted yet.</p><div class="month-agenda-list">'+agendaDays.map(agendaDayHtml).join("")+'</div></section>'+
    '<section class="specials-card"><div class="specials-head"><span class="specials-mark" aria-hidden="true">★</span><div><p>WEEKLY ROTATION</p><h2>Specials</h2></div></div><div class="specials-list">'+specials.map(row=>'<div class="special-row"><span>'+esc(row.day)+'</span><strong>'+esc(row.label)+'</strong></div>').join("")+'</div></section>'+
    '<section class="next-month-card"><h2>Coming in '+MONTHS[nextM]+'</h2>'+nextMonth.map(o=>'<div><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join("")+'</section>'+
    '</div>';
}
function subjectCard(id,klass,title,subject){
  const notes=[...(subject?.topics||[]),...(subject?.studyNotes||[])];
  return '<details id="'+id+'" class="subject-card study-accordion '+klass+'"><summary><span><small>'+esc(title.toUpperCase())+'</small><strong>'+esc(title)+'</strong></span><b aria-hidden="true">+</b></summary><ul>'+notes.map(n=>'<li>✓ '+esc(n)+'</li>').join("")+'</ul></details>';
}
function renderStudy(){
  const r=readingSubject(), rel=religionSubject(), math=mathSubject(), spell=spellingSubject(), next=currentTest();
  const essentials=[
    ["Daily",readingRoutine()],
    next?[fmtShort(next.d),next.x.label]:["This week","Keep up with current class skills"],
    ["Friday","Spelling / Handwriting review"]
  ];
  const sight=(r?.topics||[]).find(x=>/^Sight words:/i.test(x))?.replace(/^Sight words:\s*/i,"").split(",").map(x=>x.trim()).filter(Boolean)||[];
  const vocab=(pack?.vocabulary||[]).map(v=>v.term);
  stack().innerHTML='<div class="screen study-screen" role="region" aria-label="Study room">'+
    header("STUDY","Study room")+
    '<section class="study-at-a-glance"><div class="quick-look-head"><span class="quick-look-mark" aria-hidden="true">✓</span><div><p>START HERE</p><h2>What matters this week</h2></div></div><ol>'+essentials.map(x=>'<li><time>'+esc(x[0])+'</time><span>'+esc(x[1])+'</span></li>').join("")+'</ol></section>'+
    '<a class="study-games-cta" href="#games" data-open-games><span>★</span><div><small>5–10 MINUTES</small><strong>Practice with Study Games</strong><p>Current school skills with hints and explanations.</p></div><b aria-hidden="true">›</b></a>'+
    '<div class="study-section-label"><p>SUBJECT DETAILS</p><span>Tap a subject only when you need it.</span></div>'+
    subjectCard("study-religion","religion",rel?.subject||"Religion",rel)+
    subjectCard("study-reading","reading","Reading",r)+
    subjectCard("study-math","math","Math",math)+
    subjectCard("study-spelling","spelling","Spelling and phonics",spell)+
    '<details id="study-sight" class="subject-card study-accordion sight"><summary><span><small>SIGHT WORDS</small><strong>Sight words</strong></span><b aria-hidden="true">+</b></summary><div class="sight-cloud">'+sight.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></details>'+
    '<details class="subject-card study-accordion reading"><summary><span><small>VOCABULARY</small><strong>Words to know</strong></span><b aria-hidden="true">+</b></summary><div class="word-grid">'+vocab.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></details>'+
    '<section class="calm-card compact"><h3>STAR reminder</h3><p>Normal reading, calm practice, and a good night’s sleep are enough.</p></section>'+
    '</div>';
}
function studyGameEngine(){return window.ABVMStudyGames||null}
function ensureStudyGameEngine(){
  if(window.ABVMStudyGames)return Promise.resolve(window.ABVMStudyGames);
  if(studyEnginePromise)return studyEnginePromise;
  studyEnginePromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="./study-games.js?v=76";
    script.async=true;
    script.onload=()=>window.ABVMStudyGames?resolve(window.ABVMStudyGames):reject(new Error("Study Games engine did not initialize"));
    script.onerror=()=>reject(new Error("Study Games engine could not be loaded"));
    document.head.append(script);
  }).catch(error=>{studyEnginePromise=null;throw error;});
  return studyEnginePromise;
}
function studyGameCatalog(){
  const engine=studyGameEngine();
  if(!engine)return null;
  const sourceKey=engine.sourceKeyFromEnvelope(pack,envelope);
  if(!studyGameCatalogCache||studyGameCatalogCache.sourceKey!==sourceKey){
    studyGameCatalogCache=engine.buildCatalog(pack,{sourceKey});
  }
  return studyGameCatalogCache;
}
function studyGameModes(){
  return [
    {id:"quick",title:"Quick Mix",icon:"★",subjects:[],count:8,copy:"Current school skills mixed into one quick round."},
    {id:"math",title:"Math Dash",icon:"−",subjects:["Math"],count:8,copy:"Eight questions built from the current subtraction skill."},
    {id:"words",title:"Word Power",icon:"Aa",subjects:["Reading / ELA","Spelling / Handwriting"],preferredSkills:["long-short-a","suffix-ed-ing"],count:8,copy:"Current spelling-test, phonics, word-building, and reading skills."},
    {id:"faith",title:"Faith Quest",icon:"✦",subjects:["Religion"],count:8,copy:"Religion practice from the current class material."}
  ];
}
function gameMode(id){return studyGameModes().find(mode=>mode.id===id)||studyGameModes()[0]}
function gameModeQuestionTotal(catalog,mode){
  const wanted=mode?.subjects||[];
  const pool=(catalog?.questions||[]).filter(q=>!wanted.length||wanted.includes(q.subject));
  return Math.min(mode?.count||0,pool.length);
}
function gameRecordKey(modeId){
  const catalog=studyGameCatalog();
  return "abvm-study-games:"+String(catalog?.sourceKey||"current")+":"+modeId;
}
function loadGameRecord(modeId){
  try{
    const value=JSON.parse(storageGet(gameRecordKey(modeId))||"{}");
    return {best:Number(value.best)||0,plays:Number(value.plays)||0,totalCorrect:Number(value.totalCorrect)||0,totalAnswered:Number(value.totalAnswered)||0};
  }catch{return {best:0,plays:0,totalCorrect:0,totalAnswered:0}}
}
function saveGameRecord(){
  if(gameState.saved||!gameState.mode||!gameState.questions.length)return;
  const record=loadGameRecord(gameState.mode);
  const next={
    best:Math.max(record.best,gameState.score),
    plays:record.plays+1,
    totalCorrect:record.totalCorrect+gameState.score,
    totalAnswered:record.totalAnswered+gameState.questions.length
  };
  storageSet(gameRecordKey(gameState.mode),JSON.stringify(next));
  gameState.saved=true;
}
function nextGameSessionSeed(modeId){
  const catalog=studyGameCatalog();
  const key="abvm-study-games-session:"+String(catalog?.sourceKey||"current")+":"+modeId;
  const next=(Number(storageGet(key))||0)+1;
  storageSet(key,String(next));
  return String(catalog?.sourceKey||"current")+"|"+modeId+"|"+next;
}
function gameLearningKey(){return "abvm-study-learning:v2";}
function loadGameLearning(){
  try{
    const parsed=JSON.parse(storageGet(gameLearningKey())||"{}");
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{return {}}
}
function recordGameLearning(question,correct){
  if(!question?.skill)return null;
  const all=loadGameLearning(),row=all[question.skill]||{Seen:0,Correct:0,Wrong:0,ConsecutiveCorrect:0,ConsecutiveWrong:0,TargetDifficulty:2};
  row.Seen=(Number(row.Seen)||0)+1;
  if(correct){
    row.Correct=(Number(row.Correct)||0)+1;
    row.ConsecutiveCorrect=(Number(row.ConsecutiveCorrect)||0)+1;
    row.ConsecutiveWrong=0;
    if(row.ConsecutiveCorrect>=2)row.TargetDifficulty=3;
  }else{
    row.Wrong=(Number(row.Wrong)||0)+1;
    row.ConsecutiveWrong=(Number(row.ConsecutiveWrong)||0)+1;
    row.ConsecutiveCorrect=0;
    if(row.ConsecutiveWrong>=2)row.TargetDifficulty=2;
  }
  all[question.skill]=row;
  storageSet(gameLearningKey(),JSON.stringify(all));
  return row;
}
function startStudyGame(modeId){
  const engine=studyGameEngine(),catalog=studyGameCatalog(),mode=gameMode(modeId);
  if(!engine||!catalog)return;
  const questions=engine.selectQuestions(catalog,{subjects:mode.subjects,preferredSkills:mode.preferredSkills||[],count:mode.count,seed:nextGameSessionSeed(mode.id),skillStats:loadGameLearning()});
  gameState={screen:"play",mode:mode.id,questions,index:0,score:0,streak:0,bestStreak:0,selectedIndex:null,answered:false,hintOpen:false,saved:false,learningRow:null};
  renderGames();bindScreen();
}
function answerStudyGame(index){
  if(gameState.screen!=="play"||gameState.answered)return;
  const question=gameState.questions[gameState.index],choice=question?.choices?.[index];
  if(choice===undefined)return;
  const correct=choice===question.answer;
  gameState.selectedIndex=index;gameState.answered=true;gameState.hintOpen=false;
  gameState.learningRow=recordGameLearning(question,correct);
  if(correct){
    gameState.score++;
    gameState.streak++;
    gameState.bestStreak=Math.max(gameState.bestStreak,gameState.streak);
  }else gameState.streak=0;
  renderGames();bindScreen();
}
function advanceStudyGame(){
  if(!gameState.answered)return;
  if(gameState.index>=gameState.questions.length-1){
    gameState.screen="finish";
    saveGameRecord();
  }else{
    gameState.index++;
    gameState.selectedIndex=null;
    gameState.answered=false;
    gameState.hintOpen=false;
    gameState.learningRow=null;
  }
  renderGames();bindScreen();
}
function leaveStudyGame(){gameState.screen="menu";renderGames();bindScreen()}
function toggleStudyHint(){if(gameState.screen==="play"&&!gameState.answered){gameState.hintOpen=!gameState.hintOpen;renderGames();bindScreen()}}
function gameTypeLabel(type){
  return ({direct:"Direct practice",transfer:"Try it a new way",reasoning:"Explain your thinking",source:"Current class material"})[type]||"Practice";
}
function gameMenuHtml(catalog){
  const modes=studyGameModes();
  return '<section class="study-games-hero simple"><div class="study-games-mascot">★</div><div><p>SMART PRACTICE</p><h2>Pick a game and start</h2><span>Questions prioritize this week’s school skills and adjust as you practice.</span></div></section>'+
    '<div class="study-game-grid">'+modes.map(mode=>{
      const record=loadGameRecord(mode.id),total=gameModeQuestionTotal(catalog,mode),disabled=total===0;
      return '<button type="button" class="study-game-tile game-'+mode.id+'" data-game-start="'+esc(mode.id)+'"'+(disabled?' disabled aria-disabled="true"':'')+'>'+studyGameIconHtml(mode.id)+'<span class="study-game-copy"><strong>'+esc(mode.title)+'</strong><small>'+esc(mode.copy)+'</small>'+(disabled?'<em>Not ready yet</em>':record.plays?'<em>Best '+record.best+' / '+total+'</em>':'')+'</span><b aria-hidden="true">›</b></button>';
    }).join("")+'</div>'+
    '<p class="game-privacy-note">Practice prioritizes verified school skills; private student answers and grades are not used.</p>';
}
function gamePlayHtml(){
  const mode=gameMode(gameState.mode),q=gameState.questions[gameState.index];
  if(!q)return '<section class="game-empty"><h2>No questions are ready for this game yet.</h2><button type="button" data-game-home>Back to games</button></section>';
  const progress=gameState.index+1,total=gameState.questions.length,pct=Math.round((gameState.index/Math.max(1,total))*100);
  const chosen=gameState.selectedIndex;
  const answers=q.choices.map((choice,index)=>{
    let klass="";
    if(gameState.answered){
      if(choice===q.answer)klass=" correct";
      else if(index===chosen)klass=" wrong";
    }
    return '<button type="button" class="game-answer'+klass+'" data-game-answer="'+index+'" '+(gameState.answered?'disabled':'')+'><span>'+String.fromCharCode(65+index)+'</span><strong>'+esc(choice)+'</strong></button>';
  }).join("");
  const selected=chosen===null?null:q.choices[chosen],correct=selected===q.answer;
  const targeted=!correct&&selected?q.choiceDiagnostics?.[selected]?.feedback:null;
  const adaptive=!correct&&(gameState.learningRow?.ConsecutiveWrong||0)>=2?'<small class="adaptive-note">Support mode: the next rounds will favor a simpler same-skill item until this skill stabilizes.</small>':'';
  const feedback=gameState.answered
    ? '<section class="game-feedback '+(correct?'correct':'retry')+'" aria-live="polite"><span>'+(correct?'✓':'↻')+'</span><div><strong>'+(correct?'Nice work!':'Good try — here’s the answer.')+'</strong><p>'+esc(correct?q.explanation:(targeted||q.explanation))+'</p>'+adaptive+'</div></section><button type="button" class="game-next" data-game-next>'+(progress===total?'See my score':'Next question')+' <span>›</span></button>'
    : '<div class="game-hint-wrap"><button type="button" class="game-hint-button" data-game-hint>'+(gameState.hintOpen?'Hide hint':'Need a hint?')+'</button>'+(gameState.hintOpen?'<p class="game-hint">'+esc(q.hint)+'</p>':'')+'</div>';
  return '<div class="game-topbar"><button type="button" data-game-home aria-label="Back to study games">‹</button><div><span>'+esc(mode.title)+'</span><strong>'+progress+' of '+total+'</strong></div><b>★ '+gameState.score+'</b></div>'+
    '<div class="game-progress" aria-label="Game progress"><span style="width:'+pct+'%"></span></div>'+
    '<section class="game-question-card"><div class="game-question-meta"><span>'+esc(q.subject)+'</span><b>'+esc(gameTypeLabel(q.questionType))+'</b></div><h2>'+esc(q.prompt)+'</h2><div class="game-answer-list">'+answers+'</div>'+feedback+'</section>'+
    '<div class="game-streak"><span>Streak <b>'+gameState.streak+'</b></span><span>Best this round <b>'+gameState.bestStreak+'</b></span></div>';
}
function gameFinishHtml(){
  const mode=gameMode(gameState.mode),total=gameState.questions.length,record=loadGameRecord(gameState.mode);
  const pct=total?Math.round((gameState.score/total)*100):0;
  const stars=pct>=90?3:pct>=70?2:pct>=40?1:0;
  return '<section class="game-finish"><div class="game-finish-stars" aria-label="'+stars+' stars">'+[0,1,2].map(i=>'<span class="'+(i<stars?'earned':'')+'">★</span>').join("")+'</div><p>'+esc(mode.title.toUpperCase())+'</p><h2>'+gameState.score+' out of '+total+'</h2><strong>'+pct+'%</strong><span>'+(pct>=90?'Fantastic work!':pct>=70?'Great job — one more round can make it even stronger.':pct>=40?'Good practice. Try another round to build the skill.':'Keep practicing — every round helps.')+'</span><div class="game-finish-actions"><button type="button" class="primary" data-game-start="'+esc(mode.id)+'">Play again</button><button type="button" data-game-home>All study games</button></div><small>Best score on this material: '+record.best+' / '+total+'</small></section>';
}
function renderGames(){
  const engine=studyGameEngine();
  if(!engine){
    stack().innerHTML='<div class="screen games-screen game-loading" role="region" aria-label="Study games"><section class="game-empty"><span class="loading-star">★</span><h2>Getting Study Games ready…</h2><p>One moment.</p></section></div>';
    ensureStudyGameEngine().then(()=>{studyGameCatalogCache=null;renderGames();bindScreen();}).catch(()=>{stack().innerHTML='<div class="screen games-screen"><section class="error-card"><p>STUDY GAMES</p><h1>Games could not be loaded</h1><span>Check your connection and try again.</span></section></div>';});
    return;
  }
  const catalog=studyGameCatalog();
  const body=gameState.screen==="play"?gamePlayHtml():gameState.screen==="finish"?gameFinishHtml():gameMenuHtml(catalog);
  const chrome=gameState.screen==="menu"?header("STUDY GAMES","Study games")+freshness():"";
  stack().innerHTML='<div class="screen games-screen'+(gameState.screen!=="menu"?' is-playing':'')+'" role="region" aria-label="Study games">'+chrome+body+'</div>';
}

function renderFamily(){
  const weekEnd=weekDays()[4],todayDate=today();
  const tests=new Set((pack?.importantDates||[])
    .filter(x=>kindClass(x)==="test")
    .map(x=>parseDate(x.date))
    .filter(d=>d&&d>=todayDate&&d<=weekEnd)
    .map(d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"))).size;
  const notices=currentNoticeTexts();
  const homeworkActions=taskRecordsForSurface("family").map(({item})=>item.task);
  const actions=[...new Set([...homeworkActions,...upcomingReminderTexts(today(),6)])].slice(0,6);
  stack().innerHTML='<div class="screen family-screen" role="region" aria-label="Family dashboard">'+
    header("FAMILY","Family dashboard")+freshness()+
    '<section class="family-hero compact"><p>THIS WEEK</p><h2>What needs attention</h2><span>Current school actions and notices in one place.</span></section>'+
    '<div class="family-stats"><div><strong>'+tests+'</strong><span>test days</span></div><div><strong>'+actions.length+'</strong><span>current actions</span></div></div>'+
    '<section class="parent-card family-actions-card"><div class="family-actions-head"><span class="family-actions-mark" aria-hidden="true">✓</span><div><small>TO DO</small><h3>Family actions</h3></div></div><ul>'+actions.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>'+
    '<section class="parent-card sources notices-card" aria-labelledby="family-current-notices"><div class="notices-head"><span class="notices-mark" aria-hidden="true">i</span><div><small>SCHOOL UPDATES</small><h3 id="family-current-notices">Current notices</h3></div></div><div class="static-notice-list" role="list">'+notices.map(x=>'<div class="notice-row" role="listitem"><span class="status ok" aria-hidden="true"></span><p>'+esc(x)+'</p></div>').join("")+'</div></section>'+
    '<details class="family-more"><summary><span>App & privacy</span><b aria-hidden="true">+</b></summary><div><p>Study-game progress stays on this device. No student IDs or private classmates’ information are used.</p><a href="#games" data-open-games>Open Study Games</a><p>To install on iPhone, use Safari’s Share menu → Add to Home Screen.</p></div></details>'+
    '<p class="unofficial-note">Family planning tool based on current ABVM Grade 2 sources.</p>'+
    '</div>';
}
function render({preserveScroll=false}={}){
  if(!pack)return;
  const scrollTop=stack().querySelector(".screen")?.scrollTop||0;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderStudy,games:renderGames,family:renderFamily}[activeTab]||renderToday)();
  $$(".bottom-nav button").forEach(b=>{
    const on=b.dataset.tab===activeTab;b.classList.toggle("active",on);
    on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current");
  });
  const screen=stack().querySelector(".screen");
  if(screen)screen.scrollTop=preserveScroll?scrollTop:0;
  bindScreen();
}
function updateFreshnessUI(){
  const node=stack().querySelector(".freshness");
  if(node)node.outerHTML=freshness();
}
function bindScreen(){
  if(screenEventsBound)return;
  screenEventsBound=true;
  stack().addEventListener("click",event=>{
    const target=event.target.closest("button,a");
    if(!target||!stack().contains(target))return;
    if(target.matches("[data-refresh-pack]")){manualRefreshSchoolInfo();return;}
    if(target.matches("[data-check]")){toggleChecked((pack.homework||[])[Number(target.dataset.check)],Number(target.dataset.check));return;}
    if(target.matches("[data-day]")){selectedDay=new Date(target.dataset.day);renderWeek();return;}
    if(target.matches("[data-week-step]")){weekOffset+=Number(target.dataset.weekStep||0);selectedDay=null;renderWeek();return;}
    if(target.matches("[data-week-today]")){weekOffset=0;selectedDay=null;renderWeek();return;}
    if(target.matches("[data-cal-day]")){calendarDay=new Date(target.dataset.calDay);renderCalendar();return;}
    if(target.matches("[data-cal-step]")){calendarOffset+=Number(target.dataset.calStep||0);calendarDay=null;renderCalendar();return;}
    if(target.matches("[data-cal-today]")){calendarOffset=0;calendarDay=null;renderCalendar();return;}
    if(target.matches("[data-game-start]")){startStudyGame(target.dataset.gameStart);return;}
    if(target.matches("[data-game-answer]")){answerStudyGame(Number(target.dataset.gameAnswer));return;}
    if(target.matches("[data-game-next]")){advanceStudyGame();return;}
    if(target.matches("[data-game-home]")){leaveStudyGame();return;}
    if(target.matches("[data-game-hint]")){toggleStudyHint();return;}
    if(target.matches("[data-open-games]")){event.preventDefault();activeTab="games";history.replaceState(null,"","#games");gameState.screen="menu";render();return;}
  });
}
$$(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;history.replaceState(null,"","#"+activeTab);render();}));
function packContentKey(data){
  const p=data?.pack||{},lunchSource=p.lunchMenuSource||{};
  return JSON.stringify({
    sourceHash:p.sourceHash||"",
    uploadedNoticeHash:p.uploadedNoticeHash||"",
    weekLabel:p.weekLabel||"",
    importantDates:p.importantDates||[],
    homework:p.homework||[],
    subjects:p.subjects||[],
    reminders:p.reminders||[],
    parentNotices:p.parentNotices||[],
    lunchMenu:p.lunchMenu||[],
    lunchStatus:lunchSource.status||"",
    lunchRetrievalState:lunchSource.retrievalState||"",
    lunchMissingDates:lunchSource.missingDates||[]
  });
}
async function fetchPack({force=false,notify=false}={}){
  const now=Date.now();
  if(!force&&pack&&(now-lastPackFetchAt)<PACK_REFRESH_MS)return false;
  if(packRefreshPromise)return packRefreshPromise;
  packRefreshPromise=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const r=await fetch(PACK_URL,{cache:"no-store",signal:controller.signal});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const data=await r.json();
      if(!data?.pack?.sourceSufficient)throw new Error("Incomplete pack");
      const before=packContentKey(envelope),after=packContentKey(data),changed=!!before&&before!==after;
      envelope=data;pack=data.pack;lastPackFetchAt=Date.now();
      if(changed)studyGameCatalogCache=null;
      if(!before||changed)render({preserveScroll:!!before});
      else updateFreshnessUI();
      if(notify&&changed)toast("School info updated");
      return changed;
    }finally{
      clearTimeout(timeout);
      packRefreshPromise=null;
    }
  })();
  return packRefreshPromise;
}
async function manualRefreshSchoolInfo(){
  if(manualRefreshActive)return;
  if(navigator.onLine===false){
    toast("You’re offline. Showing saved school info.");
    updateFreshnessUI();
    return;
  }
  manualRefreshActive=true;
  updateFreshnessUI();
  try{
    const changed=await fetchPack({force:true,notify:false});
    const state=freshnessState();
    if(changed)toast("School info updated");
    else if(state.state==="current")toast("Latest published school info is loaded");
    else toast("Checked published school info — no newer verified update is available yet.");
  }catch{
    toast("Couldn’t refresh school info. Try again.");
  }finally{
    manualRefreshActive=false;
    updateFreshnessUI();
  }
}
async function load(){
  try{
    await fetchPack({force:true});
    const warmGames=()=>ensureStudyGameEngine().catch(()=>{});
    if("requestIdleCallback" in window)requestIdleCallback(warmGames,{timeout:2200});
    else setTimeout(warmGames,1400);
  }catch(e){
    stack().innerHTML='<div class="screen"><section class="error-card"><p>ABVM GRADE 2</p><h1>School info could not be loaded</h1><span>Refresh the page to try again.</span></section></div>';
  }
}
window.addEventListener("hashchange",()=>{
  const next=location.hash.slice(1);
  if(["today","week","calendar","study","games","family"].includes(next)&&next!==activeTab){
    activeTab=next;
    if(next==="games")gameState.screen="menu";
    render();
  }
});
window.addEventListener("online",()=>{if(pack)fetchPack({force:true,notify:true}).catch(()=>updateFreshnessUI())});
window.addEventListener("offline",()=>{if(pack)updateFreshnessUI()});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&pack)fetchPack({notify:true}).catch(()=>{});
});
window.addEventListener("pageshow",event=>{
  if(event.persisted&&pack)fetchPack({force:true,notify:true}).catch(()=>{});
});
load();
})();