(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stack=()=>$("#app-content");
if(location.hash==="#progress")history.replaceState(null,"","#family");
let envelope=null, pack=null, activeTab=(["today","week","calendar","study","games","family"].includes(location.hash.slice(1).split("?")[0])?location.hash.slice(1).split("?")[0]:"today"), selectedDay=null, calendarDay=null, weekOffset=0, calendarOffset=0;
let studyGameCatalogCache=null, derivedPackCache=null, studyEnginePromise=null, screenEventsBound=false, lastPackFetchAt=0, packRefreshPromise=null, manualRefreshActive=false, lastPackFetchUsedCache=false, gameState={screen:"menu",mode:null,questions:[],index:0,score:0,streak:0,negativeStreak:0,bestStreak:0,streakAdjustment:0,lastStreakDelta:0,selectedIndex:null,answered:false,hintOpen:false,saved:false,supportMode:false,supportQuestion:null,supportCorrect:null,supportOriginQuestion:null,comebackMode:false,comebackQuestion:null,comebackKey:null,comebackCorrect:null,sourceKey:"",sessionSeed:"",learningEvents:[],results:[],comebackSucceeded:false,rewardStatus:"idle",rewardAwarded:0,rewardCurrency:"Study Stars",starBalance:0,rewardRevealAmount:0,rewardRevealScheduled:false,tries:0,misses:0,hints:0,retry:0,wrong:[]};
let studyMaterials=null,studyMaterialsPack=null,studyMaterialsPromise=null,studyMaterialsError=null,studyMaterialsView=null,screenGeneration=0;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function linkedTextHtml(value){return esc(value).replace(/https?:\/\/[^\s<]+/g,url=>'<a href="'+url+'" target="_blank" rel="noopener">'+url.replace(/^https?:\/\//,"")+'</a>')}
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const WEEKDAY=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SCHOOL_TIME_ZONE="America/New_York";
const SCHOOL_DATE_FORMATTER=new Intl.DateTimeFormat("en-US",{timeZone:SCHOOL_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"});
const FRESH_DATE_FORMATTER=new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",timeZone:SCHOOL_TIME_ZONE});
const FRESH_TIME_FORMATTER=new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit",timeZone:SCHOOL_TIME_ZONE});
const PACK_URL="./data/study-pack-runtime.json",PACK_FALLBACK_URL="./data/study-pack.json";
const PACK_REFRESH_MS=5*60*1000;
const SCHOOL_LOGO_HTML='<img class="school-mark" src="./assets/abvm-app-icon-192.png" width="52" height="52" alt="Assumption BVM Catholic School logo">';
const GAME_TYPE_LABELS=Object.freeze({
  direct:"Direct practice",
  transfer:"Try it a new way",
  reasoning:"Explain your thinking"
});
const STUDY_GAME_MODES=Object.freeze([
  Object.freeze({id:"reading",icon:"words",title:"Reading / ELA",subjects:["Reading / ELA"],count:8,copy:"Stories & words"}),
  Object.freeze({id:"spelling",icon:"pencil",title:"Spelling / Handwriting",subjects:["Spelling / Handwriting"],count:8,copy:"Sounds & spelling"}),
  Object.freeze({id:"math",icon:"math",title:"Math",subjects:["Math"],count:8,copy:"Numbers & skills"}),
  Object.freeze({id:"religion",icon:"faith",title:"Religion",subjects:["Religion"],count:8,copy:"Faith & learning"}),
  Object.freeze({id:"mix",icon:"quick",title:"Mix",subjects:[],count:8,copy:"A little of every subject"})
]);
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
function isoDateKey(date){
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function getDerivedPack(){
  if(derivedPackCache?.pack===pack)return derivedPackCache;
  const datedEvents=window.ABVMSchoolUpdates.uniqueRows((pack?.importantDates||[]).map(item=>{
    const range=eventDateRange(item.date);
    return{item,date:range?.[0]||null,range};
  }).filter(row=>row.range));
  const chronologicalEvents=[...datedEvents].sort((a,b)=>a.date-b.date);
  const eventsByDate=new Map();
  for(const row of datedEvents){
    for(let cursor=new Date(row.range[0]);cursor<=row.range[1];cursor.setDate(cursor.getDate()+1)){
      const key=isoDateKey(cursor),items=eventsByDate.get(key)||[];
      items.push(row.item);eventsByDate.set(key,window.ABVMSchoolUpdates.uniqueEvents(items));
    }
  }
  const lunchByDate=new Map();
  const lunchKey=item=>{
    if(item?.date)return item.date;
    const parsed=parseDate(item?.day);
    return parsed?isoDateKey(parsed):null;
  };
  for(const item of pack?.lunchArchive||[]){
    const key=lunchKey(item);
    if(key)lunchByDate.set(key,item);
  }
  for(const item of pack?.lunchMenu||[]){
    const key=lunchKey(item);
    if(key)lunchByDate.set(key,item);
  }
  const subjects=new Map((pack?.subjects||[]).map(item=>[String(item.subject||"").trim().toLowerCase(),item]));
  const specials=(subjects.get("specials")?.topics||[]).map(line=>{
    const m=String(line).match(/^(Monday|Tuesday|Wednesday|Thursday|Friday):\s*(.+)$/i);
    return m?{day:m[1].slice(0,3),label:m[2]}:null;
  }).filter(Boolean);
  const reminderRows=(pack?.reminders||[]).map(text=>({text,range:eventDateRange(text)}))
    .filter(row=>row.range).sort((a,b)=>a.range[0]-b.range[0]);
  const homeworkRows=(pack?.homework||[]).map((item,index)=>{
    const policy=taskPolicy(item);
    const displayItem=policy.subject?{...item,_sourceSubject:item.subject,subject:policy.subject}:item;
    return{item:displayItem,index,policy};
  });
  const parentNoticeRows=(pack?.parentNotices||[]).map(text=>({
    text,
    range:eventDateRange(text),
    pictureLinked:/^Picture (?:ordering|backgrounds):/i.test(String(text||""))
  }));
  const lunchProofs=new Map((pack?.lunchMenuSource?.sourcePages||[]).map(row=>[row.id,row]));
  const packWeekStart=parseDate(pack?.weekLabel||"");
  const pictureDayEnd=datedEvents.find(({item})=>/\bPicture Day\b/i.test(item.label||""))?.range?.[1]||null;
  derivedPackCache={pack,datedEvents,chronologicalEvents,eventsByDate,lunchByDate,lunchProofs,subjects,specials,reminderRows,homeworkRows,parentNoticeRows,packWeekStart,pictureDayEnd};
  return derivedPackCache;
}
function datedImportantEvents(){
  return getDerivedPack().chronologicalEvents;
}
function fmtDate(d){return d?WEEKDAY[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate():"";}
function fmtShort(d){return d?WEEKDAY[d.getDay()].slice(0,3)+" "+d.getDate():"";}
function header(kicker,title){
  return '<header class="app-header"><div><p>'+esc(kicker)+'</p><h1 tabindex="-1">'+esc(title)+'</h1></div>'+SCHOOL_LOGO_HTML+'</header>';
}
function calendarSegments(view){
  return '<nav class="calendar-segments" aria-label="Calendar view"><button type="button" data-route="calendar" aria-pressed="'+(view==="month")+'">Month</button><button type="button" data-route="week" aria-pressed="'+(view==="week")+'">Week</button></nav>';
}
function freshnessState(){
  // Imported Yahoo notices can be newer than verified teacher-page checks.
  // Never use sourceLastSeenAt, generatedAt, or sourceCapturedAt as proof
  // that Homework/Tests/Spelling and the other teacher pages were rechecked.
  const raw=envelope?.sourceLastCheckedAt||pack?.sourceCheckedAt;
  const d=raw?new Date(raw):null;
  if(!d||Number.isNaN(d.getTime()))return{state:"attention",label:"Teacher page check unavailable"};
  const stamp=FRESH_DATE_FORMATTER.format(d)+" at "+FRESH_TIME_FORMATTER.format(d)+" ET";
  const ageHours=(Date.now()-d.getTime())/3600000;
  if(navigator.onLine===false||lastPackFetchUsedCache)return{state:"offline",label:"Offline · teacher pages last checked "+stamp};
  if(ageHours<-.25)return{state:"attention",label:"Teacher page check time invalid"};
  if(ageHours>30)return{state:"attention",label:"Teacher pages need refresh · last checked "+stamp};
  if(ageHours>8)return{state:"stale",label:"Teacher pages older · last checked "+stamp};
  return{state:"current",label:"Teacher pages verified "+stamp};
}
function freshness(){
  const state=freshnessState(),label=manualRefreshActive?"Checking published school info…":state.label;
  const action=manualRefreshActive?"Checking published school information":"Check published school information. "+state.label;
  return '<button type="button" class="freshness '+state.state+(manualRefreshActive?' is-refreshing':'')+'" data-refresh-pack aria-label="'+esc(action)+'"'+(manualRefreshActive?' disabled':'')+'><span aria-hidden="true"></span><strong>'+esc(label)+'</strong><b aria-hidden="true">↻</b></button>';
}
function kindClass(item){
  const k=(item?.kind||"").toLowerCase(), l=(item?.label||"").toLowerCase();
  if(/\btests?\b|\bassessments?\b/.test(k)||/\btests?\b|\bassessments?\b|star reading/.test(l))return "test";
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
  return getDerivedPack().eventsByDate.get(isoDateKey(date))||[];
}
function lunchForDate(date){
  return getDerivedPack().lunchByDate.get(isoDateKey(date))||null;
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
  const wasDone=checked(item,index);
  if(wasDone){storageRemove(key);storageRemove(legacy);}
  else storageSet(key,"1");
  render({preserveScroll:true});
  stack().querySelector(`[data-check="${index}"]`)?.focus({preventScroll:true});
  toast(`${wasDone?"Marked incomplete":"Completed"}: ${item?.task||item?.label||"Task"}`);
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
function hasVerifiedMassForDate(date){
  const events=eventItemsForDate(date);
  if(events.some(event=>kindClass(event)==="closed"||/\bno school\b/i.test(String(event?.label||""))))return false;
  if(events.some(event=>/\bmass\b/i.test(String(event?.label||""))))return true;
  const reminders=getDerivedPack().reminderRows;
  if(reminders.some(row=>row.range&&date>=row.range[0]&&date<=row.range[1]&&/\bmass\b/i.test(String(row.text||""))))return true;
  const day=WEEKDAY[date.getDay()].slice(0,3).toLowerCase();
  return getDerivedPack().specials.some(item=>String(item.day||"").toLowerCase()===day&&/\bmass\b/i.test(String(item.label||"")));
}
function taskAppliesToDate(item,date){
  if(!/^attend mass$/i.test(String(item?.task||"").trim()))return true;
  return hasVerifiedMassForDate(date);
}
function taskRecordsForSurface(surface,date=today()){
  return getDerivedPack().homeworkRows.filter(record=>record.policy[surface]!==false&&taskAppliesToDate(record.item,date));
}
function taskHtml(item,index){
  const done=checked(item,index);
  const optional=/\bif participating\b|\boptional\b/i.test((item.subject||"")+" "+(item.task||""));
  const tag=optional?"IF PARTICIPATING":"REQUIRED";
  const action=(done?"Completed: ":"Mark complete: ")+(item.task||"Task");
  return '<button type="button" class="check-item'+(done?' is-done':'')+'" data-check="'+index+'" aria-pressed="'+(done?"true":"false")+'" aria-label="'+esc(action)+'"><span class="check-box" aria-hidden="true">'+(done?"✓":"")+'</span><span class="check-copy"><span class="task-tag '+(optional?"if-participating":"required")+'">'+tag+'</span><strong>'+esc(item.task||"Task")+'</strong>'+(item.subject?'<small>'+esc(item.subject)+'</small>':'')+'</span></button>';
}
function schoolDateParts(value=new Date()){
  const parts=SCHOOL_DATE_FORMATTER.formatToParts(value);
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
  const now=today(),mon=mondayFor(now); mon.setDate(mon.getDate()+(([0,6].includes(now.getDay())?1:0)+offset)*7);
  return Array.from({length:5},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return x;});
}
function weekRangeLabel(days){
  const first=days[0],last=days[days.length-1];
  const a=MONTHS[first.getMonth()].slice(0,3)+" "+first.getDate();
  const b=(first.getMonth()===last.getMonth()?"":MONTHS[last.getMonth()].slice(0,3)+" ")+last.getDate();
  return a+" – "+b;
}
function isPackWeek(days){
  const sourceStart=getDerivedPack().packWeekStart;
  return !!sourceStart&&days.some(d=>sameDay(d,sourceStart));
}
function lunchText(lunch){
  return lunch?.items?.length?lunch.items.join(", ").replace(/, ([^,]*)$/,", and $1"):"";
}
function lunchUnavailableText(date){
  return "Lunch menu not yet verified for "+MONTHS[date.getMonth()]+" "+date.getDate()+".";
}
function lunchVerificationNote(lunch){
  if(!lunch?.sourceId)return "";
  const proof=getDerivedPack().lunchProofs.get(lunch.sourceId);
  if(proof?.checkedAt)return "";
  if(proof?.reviewedAt)return pack?.lunchMenuSource?.retrievalState==="needs-review"
    ?"Reviewed school menu · automated source check pending"
    :"Reviewed school menu · automated source check unavailable";
  return "Lunch source verification unavailable";
}
function lunchCardHtml(date,lunch){
  const closed=lunch?.status==="no-school"||eventItemsForDate(date).some(e=>kindClass(e)==="closed");
  if([0,6].includes(date.getDay()))return "";
  const message=closed?"No school lunch":lunch?lunchText(lunch):lunchUnavailableText(date);
  const sourceNote=lunch&&!closed?lunchVerificationNote(lunch):"";
  const main=!closed&&lunch?.items?.length?String(lunch.items[0]):message;
  const remaining=message.startsWith(main)?message.slice(main.length).replace(/^,\s*/,""):"";
  return '<section class="lunch-card'+(!lunch&&!closed?' lunch-missing':'')+'"><span class="meal-icon" aria-hidden="true">'+window.ABVMProductView.icon("lunch")+'</span><div><p>SCHOOL LUNCH</p><strong>'+esc(main)+'</strong>'+(remaining?' <span class="lunch-details">'+esc(remaining)+'</span>':'')+(sourceNote?'<small>'+esc(sourceNote)+'</small>':'')+'</div>'+(!closed?(window.ABVMLunchArt?.html(lunch)||''):'')+'</section>';
}
function currentTest(){
  const now=today();
  const row=datedImportantEvents().find(({item,date})=>date>=now&&kindClass(item)==="test");
  return row?{x:row.item,d:row.date}:null;
}
function reminderForDate(date){
  const rows=getDerivedPack().reminderRows;
  const exact=rows.find(row=>date>=row.range[0]&&date<=row.range[1]);
  if(exact)return exact.text;
  return rows.find(row=>row.range[0]>=date)?.text||"";
}
function upcomingReminderTexts(date=today(),limit=6){
  const timed=getDerivedPack().reminderRows.filter(row=>row.range[1]>=date).map(row=>row.text);
  return [...new Set(timed)].slice(0,limit);
}
function currentNoticeTexts(date=today()){
  const {parentNoticeRows,pictureDayEnd}=getDerivedPack();
  return parentNoticeRows.filter(row=>{
    const expiry=row.range?.[1]||(row.pictureLinked?pictureDayEnd:null);
    return !expiry||expiry>=date;
  }).map(row=>row.text);
}
function specialsRows(){return getDerivedPack().specials;}
function calendarBase(){
  const now=today();
  return new Date(now.getFullYear(),now.getMonth()+calendarOffset,1,12);
}
function loadStudyRanks(){return ensureStudyGameEngine().then(e=>e.studyBadgeCollection())}
function renderToday(){
 const d=today(),priority=datedImportantEvents().find(({item,date})=>date>=d&&(kindClass(item)==="test"||kindClass(item)==="due"));
 stack().innerHTML=window.ABVMProductView.today({d,pack,header,freshness,taskHtml,kindClass,fmtDate,fmtShort,linkedTextHtml,events:eventItemsForDate(d),tasks:taskRecordsForSurface("today"),next:currentTest()||(priority?{x:priority.item,d:priority.date}:null),reminders:upcomingReminderTexts(d,2),lunchHtml:lunchCardHtml(d,lunchForDate(d))});
 // If a reviewed illustration fails, retain the complete accurate lunch
 // description and remove the broken image frame (never substitute invented art).
 const mealArt=stack().querySelector(".today-screen .lunch-art img");
 if(mealArt){
   const hideBrokenArt=()=>mealArt.closest(".lunch-art")?.remove();
   mealArt.addEventListener("error",hideBrokenArt,{once:true});
   if(mealArt.complete&&mealArt.naturalWidth===0)hideBrokenArt();
 }
 window.ABVMStudyBadges.mount(stack(),"today",loadStudyRanks);
}
function renderWeek(){
 const days=weekDays();
 if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=weekOffset===0?(days.find(d=>sameDay(d,today()))||days[0]):days[0];
 stack().innerHTML=window.ABVMProductView.week({days,selectedDay,offset:weekOffset,header,segments:calendarSegments("week"),freshness,taskHtml,kindClass,fmtDate,fmtShort,weekRangeLabel,eventItemsForDate,events:eventItemsForDate(selectedDay),tasks:isPackWeek(days)?taskRecordsForSurface("week",selectedDay):[],lunchHtml:lunchCardHtml(selectedDay,lunchForDate(selectedDay)),reminder:reminderForDate(selectedDay),future:datedImportantEvents().filter(({date})=>date>selectedDay).slice(0,4).map(({item,date})=>({x:item,d:date})),overview:window.ABVMWeeklyLearning.renderWeekOverview({days,lunchForDate,eventItemsForDate,kindClass,fmtShort,lunchText,lunchUnavailableText})});
}
function monthGrid(year,month){const first=new Date(year,month,1,12), last=new Date(year,month+1,0,12), blanks=first.getDay();let html=""; for(let i=0;i<blanks;i++)html+='<span class="calendar-blank"></span>';for(let day=1;day<=last.getDate();day++){const d=new Date(year,month,day,12), events=eventItemsForDate(d), lunch=lunchForDate(d);const dots=[...new Set([...events.map(e=>kindClass(e)),...(lunch?["lunch"]:[])])].slice(0,3);const weekend=[0,6].includes(d.getDay()), closed=events.some(e=>kindClass(e)==="closed");const eventLabel=events.length?": "+events.map(e=>e.label).join(", "):"";html+='<button type="button" class="'+(weekend?"weekend ":"")+(closed?"closed ":"")+(calendarDay&&sameDay(d,calendarDay)?"active":"")+'" data-cal-day="'+d.toISOString()+'" aria-label="'+esc(fmtDate(d)+eventLabel)+'" aria-pressed="'+(calendarDay&&sameDay(d,calendarDay)?"true":"false")+'"><strong>'+day+'</strong><span class="calendar-dots" aria-hidden="true">'+dots.map(k=>'<span class="calendar-mark '+k+'"></span>').join("")+'</span></button>';}return html;}
function agendaLunchHtml(date,lunch){
  const events=eventItemsForDate(date),closed=events.some(e=>kindClass(e)==="closed"),weekend=[0,6].includes(date.getDay());
  const text=closed||weekend||lunch?.status==="no-school"?"No school lunch":lunch?lunchText(lunch):lunchUnavailableText(date);
  return '<div class="agenda-lunch'+(lunch?"":" is-missing")+'"><span class="meal-icon" aria-hidden="true">'+window.ABVMProductView.icon("lunch")+'</span><div><b>Lunch</b><p>'+esc(text)+'</p></div>'+(!closed&&!weekend?(window.ABVMLunchArt?.html(lunch)||''):'')+'</div>';
}
function compactMonthCardHtml(month,rows,extraClass){
  const dates=new Map();
  for(const {x,d} of rows){
    const key=d.getTime();
    if(!dates.has(key)){
      if(dates.size>=5)continue;
      dates.set(key,{d,labels:[]});
    }
    const group=dates.get(key);
    if(!group.labels.includes(x.label))group.labels.push(x.label);
  }
  return '<section class="'+extraClass+' compact-month-card"><h2>Coming in '+MONTHS[month]+'</h2>'+[...dates.values()].map(o=>'<div><span>'+esc(fmtShort(o.d))+'</span><p>'+o.labels.map(esc).join("<br>")+'</p></div>').join("")+'</section>';
}
function renderCalendar(){
  const base=calendarBase(),y=base.getFullYear(),m=base.getMonth();
  if(!calendarDay||calendarDay.getFullYear()!==y||calendarDay.getMonth()!==m){
    const now=today();
    calendarDay=calendarOffset===0?new Date(now):new Date(y,m,1,12);
  }
  const events=eventItemsForDate(calendarDay),lunch=lunchForDate(calendarDay);
  const monthSummary=datedImportantEvents()
    .filter(({date})=>date.getMonth()===m&&date.getFullYear()===y&&(calendarOffset!==0||date>=today()))
    .map(({item,date})=>({x:item,d:date}));
  const nextMonthDate=new Date(y,m+1,1,12),nextY=nextMonthDate.getFullYear(),nextM=nextMonthDate.getMonth();
  const nextMonth=datedImportantEvents()
    .filter(({date})=>date.getMonth()===nextM&&date.getFullYear()===nextY)
    .map(({item,date})=>({x:item,d:date}));
  const specials=specialsRows();
  stack().innerHTML='<div class="screen calendar-screen" role="region" aria-label="'+MONTHS[m]+' calendar">'+
    header("ASSUMPTION BVM · GRADE 2","Calendar")+calendarSegments("month")+window.ABVMSchoolUpdates.officialCalendarLink()+
    '<nav class="calendar-month-nav" aria-label="Change calendar month"><button type="button" data-cal-step="-1" aria-label="Previous month">‹</button><div aria-live="polite"><strong>'+MONTHS[m]+' '+y+'</strong><span>'+(calendarOffset===0?"Current month":"Browsing calendar")+'</span></div><button type="button" data-cal-step="1" aria-label="Next month">›</button></nav>'+
    (calendarOffset!==0?'<button type="button" class="calendar-today-jump" data-cal-today>Back to current month</button>':'')+
    '<div class="calendar-layout"><section class="calendar-card"><div class="calendar-title-row"><span>Choose a day to see the plan.</span></div><div class="calendar-weekdays">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>"<span>"+x+"</span>").join("")+'</div><div class="calendar-grid">'+monthGrid(y,m)+'</div><div class="calendar-legend"><span><i class="test"></i>Test</span><span><i class="faith"></i>Faith</span><span><i class="family"></i>Family</span><span><i class="due"></i>Due</span><span><i class="lunch"></i>Lunch</span></div></section>'+
    '<section class="calendar-day-card" aria-live="polite"><div class="calendar-day-heading"><div><p>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</p><h2>'+MONTHS[calendarDay.getMonth()]+" "+calendarDay.getDate()+'</h2></div></div>'+
      (events.length?'<div class="calendar-event-list">'+events.map(e=>'<div><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong></span></div>').join("")+'</div>':'<p class="calendar-empty">No special school events are listed for this date.</p>')+
      agendaLunchHtml(calendarDay,lunch)+'<button class="calendar-study-action primary-button" type="button" data-route="study">Start studying '+window.ABVMProductView.icon("arrow")+'</button>'+
    '</section></div>'+compactMonthCardHtml(m,monthSummary,"current-month-summary")+
    '<details class="calendar-more"'+(window.matchMedia("(min-width: 700px)").matches?' open':'')+'><summary>Weekly lunches and tests <span aria-hidden="true">⌄</span></summary><div class="calendar-more-content">'+
    window.ABVMWeeklyLearning.renderWeekOverview({days:weekDays(),lunchForDate,eventItemsForDate,kindClass,fmtShort,lunchText,lunchUnavailableText})+
    '</div></details>'+
    '<section class="specials-card"><div class="specials-head"><span class="specials-mark" aria-hidden="true">★</span><div><p>WEEKLY ROTATION</p><h2>Specials</h2></div></div><div class="specials-list">'+specials.map(row=>'<div class="special-row"><span>'+esc(row.day)+'</span><strong>'+esc(row.label)+'</strong></div>').join("")+'</div></section>'+
    compactMonthCardHtml(nextM,nextMonth,"next-month-card")+freshness()+
    '</div>';
}
function isStudyRoute(){return activeTab==="study"||activeTab==="games"}
function currentStudyScreen(generation,data){return isStudyRoute()&&screenGeneration===generation&&pack===data}
function currentStudyMaterials(){return studyMaterialsPack===pack?studyMaterials:null}
function studySelection(){return{source:"weekly",sources:["weekly"]}}
function ensureStudyMaterials(retry=false){
  if(studyMaterialsPromise?.pack===pack)return studyMaterialsPromise.promise;
  if(currentStudyMaterials()&&!retry)return Promise.resolve(studyMaterials);
  const data=pack,catalog=studyGameCatalog(),engine=studyGameEngine(),events=datedImportantEvents().filter(r=>kindClass(r.item)==="test").map(r=>({date:isoDateKey(r.date),label:r.item.label,kind:r.item.kind,endsAt:r.item.endsAt}));
  const request={pack:data,promise:null};
  request.promise=Promise.all([import("./study-materials.mjs"),import("./study-games-materials-view.mjs?v=4")]).then(async([materials,view])=>{
    if(pack===data&&!studyMaterialsView){studyMaterialsView=view.createMaterialsView({onChange:()=>{if(isStudyRoute())renderGames()},onRetry:retryStudyMaterials,onTest:startStudyTest});if(isStudyRoute()&&gameState.screen==="menu")renderGames()}
    const model=await materials.loadStudyMaterials({pack:data,catalog,events,engine});
    if(pack===data){
      studyMaterials=model;studyMaterialsPack=data;studyMaterialsError=null;studyMaterialsView.setModel(model);
    }
    return model;
  }).catch(error=>{if(pack===data)studyMaterialsError={pack:data,error};throw error}).finally(()=>{if(studyMaterialsPromise===request)studyMaterialsPromise=null});
  studyMaterialsPromise=request;return request.promise;
}
function retryStudyMaterials(){studyMaterialsError=null;ensureStudyMaterials(true).catch(()=>{});renderGames()}
function studyGameEngine(){return window.ABVMStudyGames||null}
function ensureStudyGameEngine(){
  if(window.ABVMStudyGames&&window.ABVMStudyGameView)return Promise.resolve(window.ABVMStudyGames);
  if(studyEnginePromise)return studyEnginePromise;
  const load=(src,key)=>window[key]?Promise.resolve():new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>window[key]?resolve():reject(new Error(key+" did not initialize"));s.onerror=()=>reject(new Error(key+" could not be loaded"));document.head.append(s)});
  studyEnginePromise=Promise.all([load("./study-games.js?v=103","ABVMStudyGames"),load("./study-games-view.js?v=15","ABVMStudyGameView")]).then(()=>window.ABVMStudyGames).catch(error=>{studyEnginePromise=null;throw error;});
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
function gameMode(id){if(gameState.mode===id&&gameState.modeInfo)return gameState.modeInfo;if(id==="daily")return{id:"daily",title:"Daily Practice",subjects:[],count:8};return STUDY_GAME_MODES.find(mode=>mode.id===id)||STUDY_GAME_MODES[0]}
function gameModeQuestionTotal(c,m){
  const s=m?.subjects||[],k=m?.skills||[],x=s.length||k.length;
  const eligible=(c?.questions||[]).filter(q=>(!s.length||s.includes(q.subject))&&(!k.length||k.includes(q.skill)));
  if(!x)return Math.min(m?.count||0,eligible.length);
  if(k.length)return Math.min(m?.count||0,eligible.filter(q=>q.tier==="material").length);
  const current=eligible.filter(q=>q.tier==="material"),review=eligible.filter(q=>q.tier==="recent-review"),star=eligible.filter(q=>q.tier==="star-fallback");
  return Math.min(m?.count||0,(current.length?current:review.length?review:star).length)
}
function loadGameRecord(modeId,sourceKey=currentGameSourceKey()){return studyGameEngine()?.loadGameRecord?.(sourceKey,modeId)||{best:0,plays:0,totalCorrect:0,totalAnswered:0}}
function saveGameRecord(){if(gameState.saved||!gameState.mode||!gameState.questions.length)return;studyGameEngine()?.saveGameRecord?.(gameState.sourceKey||currentGameSourceKey(),gameState.mode,{score:gameState.score,total:gameState.questions.length});gameState.saved=true}
function currentGameSourceKey(){return studyGameCatalog()?.sourceKey||"current"}
function roundCatalog(eligible=false){const g=gameState,c=g.catalog||studyGameCatalog();return eligible&&g.eligibleIds?{...c,questions:c.questions.filter(q=>g.eligibleIds.includes(q.id))}:c}
function scheduleGameComeback(origin){if(gameState.strict)return null;const e=studyGameEngine(),c=roundCatalog(true),s=gameState.sourceKey||currentGameSourceKey();return e?.scheduleComeback?.(c,origin,{sourceKey:s,remaining:3,seenIds:gameState.questions.slice(0,gameState.index+1).map(q=>q.id),seed:s+"|comeback|"+String(origin?.id||"item")})||null}
function tickGameComebacks(){if(!gameState.strict)studyGameEngine()?.tickComebacks?.(gameState.sourceKey||currentGameSourceKey())}
function markGameComebacksNextSession(){if(!gameState.strict)studyGameEngine()?.deferComebacksToNextSession?.(gameState.sourceKey||currentGameSourceKey())}
function activateDueGameComeback(){if(gameState.strict)return false;const due=studyGameEngine()?.dueComeback?.(roundCatalog(),gameState.sourceKey||currentGameSourceKey(),{eligibleIds:gameState.eligibleIds});if(!due||gameState.eligibleIds&&!gameState.eligibleIds.includes(due.question.id))return false;Object.assign(gameState,{comebackMode:true,comebackQuestion:due.question,comebackKey:due.row.key,comebackCorrect:null,selectedIndex:null,answered:false,hintOpen:false,learningRow:null,tries:0,misses:0,hints:0,retry:0,wrong:[]});return true}
function clearActiveGameComeback(){studyGameEngine()?.resolveComeback?.(gameState.comebackKey);Object.assign(gameState,{comebackMode:false,comebackQuestion:null,comebackKey:null,comebackCorrect:null})}
function activeGameQuestion(){return gameState.comebackMode?gameState.comebackQuestion:gameState.supportMode?gameState.supportQuestion:gameState.questions[gameState.index]}
function startStudyGame(modeId){
  if(modeId==="test-ready"){startStudyTest(gameState.testIndex);return}
  const engine=studyGameEngine(),catalog=studyGameCatalog(),mode=gameMode(modeId),model=currentStudyMaterials(),selection=studySelection();
  if(!engine||!catalog)return;
  if(model){openStudyRound(model.round(modeId,{...selection,learning:engine.loadLearning?.()||{}}),mode);return}
  if(selection.source!=="weekly"){toast("Those materials are still loading. Please try again.");return}
  const sourceKey=currentGameSourceKey(),sessionSeed=engine.nextSessionSeed?.(sourceKey,mode.id)||"session";
  const questions=mode.id==="daily"?engine.selectDailyQuestions(catalog,{count:8,seed:sessionSeed,skillStats:engine.loadLearning(),pack}):engine.selectQuestions(catalog,{subjects:mode.subjects,skills:mode.skills||[],preferredSkills:mode.preferredSkills||[],count:mode.count,seed:sessionSeed,skillStats:engine.loadLearning?.()||{}});
  const eligibleIds=catalog.questions.filter(q=>!mode.subjects?.length||mode.subjects.includes(q.subject)).map(q=>q.id);
  openStudyRound({questions,catalog,eligibleIds,sourceKey,sessionSeed,strict:false},mode);
}
function startStudyTest(index){const round=currentStudyMaterials()?.testRound({index,upcoming:true});if(round)openStudyRound(round,{id:"test-ready",title:round.title,subjects:[],count:8},index)}
function openStudyRound(round,mode,testIndex){
  if(!isStudyRoute()||!round.questions?.length){toast("No questions are ready for that selection.");return}
  const {questions,catalog,sourceKey,sessionSeed,strict,eligibleIds}=round;
  gameState={screen:"play",mode:mode.id,modeInfo:mode,testIndex,catalog,eligibleIds:Object.freeze([...(eligibleIds||catalog.questions.map(q=>q.id))]),strict:!!strict,questions,index:0,score:0,streak:0,bestStreak:0,selectedIndex:null,answered:false,hintOpen:false,saved:false,learningRow:null,supportMode:false,supportQuestion:null,supportCorrect:null,supportOriginQuestion:null,comebackMode:false,comebackQuestion:null,comebackKey:null,comebackCorrect:null,sourceKey,sessionSeed,learningEvents:[],results:[],comebackSucceeded:false,rewardStatus:"idle",rewardAwarded:0,rewardCurrency:"Study Stars",rewardRevealAmount:0,rewardRevealScheduled:false,penaltyTasks:[],starBalance:window.ABVMStudyBadges.snapshot()?.balance??null,tries:0,misses:0,hints:0,retry:0,wrong:[]};
  activateDueGameComeback();
  const started=gameState;loadStudyRanks().then(c=>{if(gameState===started&&started.screen==="play"){started.starBalance=c.balance;started.starBalanceUnavailable=false;const node=stack().querySelector(".game-star-balance");if(node)node.textContent="★ "+c.balance+" Study Stars"}}).catch(()=>{if(gameState===started&&started.screen==="play"){started.starBalanceUnavailable=true;const node=stack().querySelector(".game-star-balance");if(node)node.textContent="Study Stars unavailable"}});
  renderGames();bindScreen();
}
function noteRoundLearning(g,q,kind,correct,independent=false){
  const skill=String(q?.skill||"").trim();if(!skill)return;
  if(!Array.isArray(g.learningEvents))g.learningEvents=[];
  if(kind!=="support")g.learningEvents.push({skill,kind,correct:!!correct,independent:!!independent});
  if(kind==="comeback"&&correct)g.comebackSucceeded=true;
}
function focusStudyAnswer(g){const node=stack().querySelector(g.answered||g.penaltyPending?".game-feedback":".game-answer:not(:disabled)");if(node){if(node.classList.contains("game-feedback"))node.tabIndex=-1;node.focus({preventScroll:true})}}
function answerStudyGame(index){
  const g=gameState,q=activeGameQuestion(),choice=q?.choices?.[index];if(g.screen!=="play"||g.answered||g.penaltyPending||choice===undefined||g.wrong?.includes(index))return;
  const correct=choice===q.answer,e=studyGameEngine();e?.note?.(q,index);g.tries=(g.tries||0)+1;g.selectedIndex=index;g.hintOpen=false;
  const firstScoredAttempt=!g.comebackMode&&!g.supportMode&&g.tries===1;
  if(firstScoredAttempt){
    const streak=e?.nextStreakBonus?.({positiveStreak:g.streak,negativeStreak:g.negativeStreak,adjustment:g.streakAdjustment},correct);
    if(streak){g.streak=streak.positiveStreak;g.negativeStreak=streak.negativeStreak;g.lastStreakDelta=correct?streak.delta:-2;g.streakAdjustment=correct?streak.adjustment:(g.streakAdjustment||0);g.bestStreak=Math.max(g.bestStreak,g.streak)}
  }
  if(g.comebackMode){g.answered=true;g.learningRow=e?.recordComeback?.(q,correct)||null;g.comebackCorrect=correct;noteRoundLearning(g,q,"comeback",correct,false)}
  else if(g.supportMode){g.answered=true;g.learningRow=e?.recordSupport?.(q,correct)||null;g.supportCorrect=correct}
  else if(correct){g.answered=true;g.retry=0;g.learningRow=e?.recordLearning?.(q,true,{attemptCount:g.tries,incorrectCount:g.misses,hintCount:g.hints})||null;noteRoundLearning(g,q,q.tier==="recent-review"?"review":"normal",true,g.learningRow?.LastResolution?.independent===true);g.score++}
  else{g.misses=(g.misses||0)+1;g.wrong.push(index);if(g.misses<Math.min(2,q.choices.length-1)){g.retry=g.misses;g.selectedIndex=null}else{g.answered=true;g.retry=g.misses;g.learningRow=e?.recordLearning?.(q,false,{attemptCount:g.tries,incorrectCount:g.misses,hintCount:g.hints})||null;noteRoundLearning(g,q,q.tier==="recent-review"?"review":"normal",false,false)}}
  window.ABVMStudyGameView?.recordAttempt?.(g,q,{counted:!g.comebackMode&&!g.supportMode,kind:g.comebackMode?"comeback":g.supportMode?"support":"primary",correct,resolved:g.answered,index:g.index,hintUsed:(g.hints||0)>0,attempt:g.tries});
  if(!correct){
    g.penaltyPending=true;g.lastStarPenalty={status:"pending",amount:0};
    const attemptId=[q.id,g.index,g.tries,g.comebackMode?"comeback":g.supportMode?"support":"primary"].join("|");
    const penalty=e.commitStudyStarPenalty({sourcePack:g.sourceKey,mode:g.mode,sessionSeed:g.sessionSeed,attemptId}).then(result=>{g.penaltyPending=false;g.lastStarPenalty={status:"done",amount:result.deductedAmount};g.starBalance=result.balance;g.starBalanceUnavailable=false;window.ABVMStudyBadges.sync(result.collection);if(gameState===g&&isStudyRoute()&&g.screen==="play"){renderGames();bindScreen();focusStudyAnswer(g)}}).catch(error=>{g.penaltyPending=false;g.lastStarPenalty={status:"error",amount:0};if(gameState===g&&isStudyRoute()&&g.screen==="play"){renderGames();bindScreen();focusStudyAnswer(g)}throw error});
    (g.penaltyTasks||(g.penaltyTasks=[])).push(penalty);penalty.catch(()=>{});
  }
  renderGames();bindScreen();focusStudyAnswer(g)
}
function settleStudyStarRewards(g=gameState){
  const e=studyGameEngine();
  if(!e||g.rewardStatus!=="idle"||!g.sessionSeed)return;
  g.rewardStatus="pending";
  let roundId;
  const sourceKey=g.sourceKey||currentGameSourceKey();
  try{roundId=e.studyStarRoundId({sourcePack:sourceKey,mode:g.mode,sessionSeed:g.sessionSeed})}
  catch{g.rewardStatus="error";return}
  g.roundId=roundId;
  Promise.all(g.penaltyTasks||[]).then(()=>e.commitStudyStarRewards({sourcePack:sourceKey,mode:g.mode,sessionSeed:g.sessionSeed,roundId,completed:true,comebackSucceeded:!!g.comebackSucceeded,streakAdjustment:g.streakAdjustment||0,firstTryCorrect:window.ABVMStudyGameView.scoreSummary(g).correct,questionCount:g.questions.length}))
    .then(async result=>{
      const balance=result.balance;g.perfectBonus=result.perfectBonus;g.rankCollection=result.collection;
      g.newRanks=(result.newlyUnlocked||[]).map(id=>result.collection.badges.find(b=>b.id===id)).filter(Boolean);
      window.ABVMStudyBadges.sync(result.collection);
      if(gameState!==g)return;
      g.rewardStatus="done";g.rewardAwarded=Number(result?.awardedAmount)||0;g.rewardCurrency=String(result?.currency||"Study Stars");g.starBalance=Math.max(0,Number(balance)||0);g.starBalanceUnavailable=false;g.rewardRevealAmount=g.rewardAwarded;g.rewardRevealScheduled=false;
      if(isStudyRoute()&&g.screen==="finish"&&g.renderGeneration===screenGeneration){renderGames();bindScreen();}
    })
    .catch(()=>{if(gameState===g){g.rewardStatus="error";if(isStudyRoute()&&g.screen==="finish"&&g.renderGeneration===screenGeneration){renderGames();bindScreen();}}});
}
function finishStudyGame(){
  const g=gameState;markGameComebacksNextSession();g.screen="finish";if(g.mode==="daily")window.ABVMStudyReview.complete();saveGameRecord();settleStudyStarRewards(g);
}
function advanceStudyGame(){
  const g=gameState;if(!g.answered||g.penaltyPending)return;
  const reset=()=>Object.assign(g,{selectedIndex:null,answered:false,hintOpen:false,learningRow:null,lastStreakDelta:0,lastStarPenalty:null,tries:0,misses:0,hints:0,retry:0,wrong:[]});
  if(g.comebackMode){clearActiveGameComeback();reset();renderGames();bindScreen();return}
  if(g.supportMode){
    const origin=g.supportOriginQuestion;Object.assign(g,{supportMode:false,supportQuestion:null,supportCorrect:null,supportOriginQuestion:null});
    if(origin)scheduleGameComeback(origin);
    if(g.index>=g.questions.length-1){finishStudyGame()}
    else{g.index++;tickGameComebacks();reset();activateDueGameComeback()}
    renderGames();bindScreen();return
  }
  const current=g.questions[g.index],selected=current?.choices?.[g.selectedIndex],correct=selected===current?.answer;
  if(!correct)scheduleGameComeback(current);
  if(!g.strict&&!correct&&(g.learningRow?.ConsecutiveWrong||0)>=2){
    const engine=studyGameEngine(),catalog=roundCatalog(true),support=engine?.supportQuestion(catalog,current,{skillStats:engine?.loadLearning?.()||{},seed:String(catalog?.sourceKey||"current")+"|support|"+String(current?.id||"item")+"|"+String(g.learningRow?.Seen||0)});
    if(support){Object.assign(g,{supportMode:true,supportQuestion:support,supportCorrect:null,supportOriginQuestion:current});reset();renderGames();bindScreen();return}
  }
  if(g.index>=g.questions.length-1){finishStudyGame()}
  else{g.index++;tickGameComebacks();reset();activateDueGameComeback()}
  renderGames();bindScreen()
}
function leaveStudyGame(){markGameComebacksNextSession();gameState.screen="menu";renderGames();bindScreen()}
function toggleStudyHint(){const g=gameState;if(g.screen==="play"&&!g.answered){g.hintOpen=!g.hintOpen;if(g.hintOpen)g.hints=(g.hints||0)+1;renderGames();bindScreen()}}
function gameMenuHtml(catalog){
  const modes=STUDY_GAME_MODES,materials=currentStudyMaterials(),view=studyMaterialsView,selection=studySelection();
  const grid='<div class="study-game-grid">'+modes.map(mode=>{
    const scope=materials?.forMode(mode.id,selection),record=loadGameRecord(mode.id,scope?.sourceKey||catalog.sourceKey),total=scope?Math.min(8,scope.count):selection.source==="weekly"?gameModeQuestionTotal(catalog,mode):0,disabled=total===0;
    return '<button type="button" class="study-game-tile game-'+mode.icon+'" data-game-start="'+esc(mode.id)+'"'+(mode.id==="reading"?' aria-label="Reading / ELA"':'')+(disabled?' disabled aria-disabled="true"':'')+'>'+window.ABVMStudyGameView.icon(mode.icon)+'<span class="study-game-copy"><strong>'+esc(mode.id==="spelling"?"Spelling":mode.id==="reading"?"Reading":mode.title)+'</strong><small>'+esc(mode.copy)+'</small>'+(disabled?'<em>Not ready yet</em>':record.plays?'<em>Practiced before · '+record.best+' / '+total+' best</em>':'')+'</span><b aria-hidden="true">›</b></button>';
  }).join("")+'</div>';
  if(view)return view.homeHtml({gameGrid:grid,complete:!!window.ABVMStudyReview?.completion(),loading:studyMaterialsError?.pack!==pack,error:studyMaterialsError?.pack===pack});
  return '<section class="study-game-section"><div class="study-section-heading"><h2>Choose your subject</h2></div>'+grid+'</section>'+
    '<p class="game-material-status" role="status">Loading notes and test prep…</p>';
}
function gamePlayHtml(){const g=gameState,q=activeGameQuestion(),e=studyGameEngine();if(q)e?.markQuestionShown?.(q,g.sourceKey||currentGameSourceKey());return window.ABVMStudyGameView.play({g,mode:gameMode(g.mode),q,teach:g.supportMode?e?.teachCardFor?.(q):null,retryInstruction:e?.teachCardFor?.(q)?.instruction,labels:GAME_TYPE_LABELS,canRead:!!studyMaterialsView?.readAloud.supported})}
function gameFinishHtml(){
  const g=gameState,e=studyGameEngine(),v=window.ABVMStudyGameView;
  const summary=e?.learningFirstSummary?.(g.learningEvents)||{strong:0,remembered:0,practice:0,total:0};
  const reward={status:g.rewardStatus,awardedAmount:g.rewardAwarded,currency:g.rewardCurrency,balance:g.starBalance};
  const reveal=g.rewardRevealAmount>0?v.rewardReveal({amount:g.rewardRevealAmount,currency:g.rewardCurrency}):"";
  const finish=v.finish({mode:gameMode(g.mode),state:g,record:loadGameRecord(g.mode,g.sourceKey||currentGameSourceKey()),summary,reward});
  const goal=g.rewardStatus==="done"?window.ABVMStudyBadges.render(g.rankCollection,"finish"):"";
  const promotion=g.rewardStatus==="done"&&g.newRanks?.length?window.ABVMStudyBadges.promotion(g.newRanks):"";
  // Put newly earned rank first so an iPhone learner sees the promotion
  // immediately, without scrolling through the entire score report.
  return reveal+promotion+finish+goal;
}
function renderGames(){
  const previousScreen=stack().querySelector(".games-screen"),menuScroll=gameState.screen==="menu"&&previousScreen&&!previousScreen.classList.contains("is-playing")?previousScreen.scrollTop:null;
  if(!isStudyRoute())return;
  studyMaterialsView?.readAloud.stop();
  const engine=studyGameEngine(),generation=++screenGeneration,data=pack;
  if(!engine||!window.ABVMStudyGameView){
    stack().innerHTML='<div class="screen games-screen game-loading" data-study-state="loading" role="region" aria-label="Study games"><section class="game-empty"><span class="loading-star" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg></span><h2>Getting your practice ready…</h2><p>One moment.</p></section></div>';
    ensureStudyGameEngine().then(()=>{if(currentStudyScreen(generation,data)){studyGameCatalogCache=null;renderGames();bindScreen();}}).catch(()=>{if(currentStudyScreen(generation,data))stack().innerHTML='<div class="screen games-screen"><section class="error-card"><p>STUDY</p><h1>Practice could not load</h1><span>Check your connection and try again.</span><button type="button" data-retry-games>Try again</button></section></div>';});
    return;
  }
  if(!currentStudyMaterials()&&studyMaterialsError?.pack!==pack)ensureStudyMaterials().catch(()=>{});
  if(studyMaterialsPromise?.pack===pack)studyMaterialsPromise.promise.then(()=>{if(currentStudyScreen(generation,data)&&gameState.screen==="menu")renderGames()}).catch(()=>{if(currentStudyScreen(generation,data)&&gameState.screen==="menu")renderGames()});
  const materials=currentStudyMaterials();studyMaterialsView?.setModel(materials);
  const catalog=studyGameCatalog();
  const practiceTitle=gameState.screen!=="menu"?'<h1 class="visually-hidden" tabindex="-1">'+esc(gameMode(gameState.mode).title.replace(/ practice$/i,""))+(gameState.screen==="finish"?' results':' practice')+'</h1>':"";
  const body=practiceTitle+(gameState.screen==="play"?gamePlayHtml():gameState.screen==="finish"?gameFinishHtml():gameMenuHtml(catalog));
  const chrome=gameState.screen==="menu"&&!studyMaterialsView?.isPrep?.()?'<header class="app-header study-hero"><div class="study-hero-copy"><p>ASSUMPTION BVM · GRADE 2</p><h1 class="visually-hidden" tabindex="-1">Study</h1><h2>Let’s learn, <span>eagle!</span></h2></div>'+SCHOOL_LOGO_HTML+'<img class="study-hero-art" src="./assets/illustrations/eagle.webp" width="240" height="240" alt=""></header>':"";
  const state=materials?(materials.status.partial?"partial":"ready"):studyMaterialsError?.pack===pack?"partial":"loading";
  stack().innerHTML='<div class="screen games-screen'+(gameState.screen!=="menu"?' is-playing':'')+'" data-study-state="'+state+'" role="region" aria-label="Study games">'+chrome+body+(gameState.screen==="menu"?freshness():"")+'</div>';
  if(gameState.screen==="menu")window.ABVMStudyBadges.mount(stack(),"study",loadStudyRanks);
  if(menuScroll!==null)stack().querySelector(".games-screen").scrollTop=menuScroll;
  if(gameState.screen==="menu"){studyMaterialsView?.bind(stack());if(location.hash.includes("?notes")&&!stack().querySelector("[data-study-notes]")?.open)studyMaterialsView?.openNotes?.();}
  gameState.renderGeneration=generation;
  if(gameState.screen==="finish"&&gameState.rewardRevealAmount>0&&!gameState.rewardRevealScheduled){
    const round=gameState;round.rewardRevealScheduled=true;
    setTimeout(()=>{if(gameState!==round)return;round.rewardRevealAmount=0;stack().querySelector("[data-reward-reveal]")?.remove()},1200);
  }
}
function renderFamily(){
 const learning=studyGameEngine()?.loadLearning?.()||{};
 const actions=[...new Set([...taskRecordsForSurface("family").map(({item})=>item.task),...upcomingReminderTexts(today(),6)])].slice(0,6);
 stack().innerHTML=window.ABVMProductView.progress({pack,header,freshness,learning,actions,notices:currentNoticeTexts(),linkedTextHtml});
 window.ABVMStudyBadges.mount(stack(),"collection",loadStudyRanks);
 if(!studyGameEngine())ensureStudyGameEngine().then(()=>{if(activeTab==="family")renderFamily()}).catch(()=>{});
}
function render({preserveScroll=false}={}){
  if(!pack)return;
  screenGeneration++;studyMaterialsView?.readAloud.stop();
  if(!isStudyRoute()&&gameState.screen!=="menu"){markGameComebacksNextSession();gameState.screen="menu"}
  const scrollTop=stack().querySelector(".screen")?.scrollTop||0;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderGames,games:renderGames,family:renderFamily}[activeTab]||renderToday)();
  const navTab=activeTab==="games"?"study":activeTab==="week"?"calendar":activeTab;
  $$(".bottom-nav button").forEach(b=>{
    const on=b.dataset.tab===navTab;b.classList.toggle("active",on);
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
  stack().addEventListener("click",async event=>{
    const target=event.target.closest("button,a");
    if(!target||!stack().contains(target))return;
    if(target.matches("[data-route]")){activeTab=target.dataset.route.split("?")[0];history.replaceState(null,"","#"+target.dataset.route);render();stack().querySelector("h1")?.focus({preventScroll:true});return;}
    if(target.matches("[data-open-badges]")){activeTab="family";history.replaceState(null,"","#family");render();const title=stack().querySelector("#badge-title");if(title){title.tabIndex=-1;title.focus();title.scrollIntoView({block:"start"})}return;}
    if(target.matches("[data-open-family]")){activeTab="family";history.replaceState(null,"","#family");render();return;}
    if(target.matches("[data-refresh-pack]")){manualRefreshSchoolInfo();return;}
    if(target.matches("[data-check]")){toggleChecked((pack.homework||[])[Number(target.dataset.check)],Number(target.dataset.check));return;}
    if(target.matches("[data-day]")){selectedDay=new Date(target.dataset.day);renderWeek();return;}
    if(target.matches("[data-week-step]")){weekOffset+=Number(target.dataset.weekStep||0);selectedDay=null;renderWeek();return;}
    if(target.matches("[data-week-today]")){weekOffset=0;selectedDay=null;renderWeek();return;}
    if(target.matches("[data-cal-day]")){calendarDay=new Date(target.dataset.calDay);renderCalendar();return;}
    if(target.matches("[data-cal-step]")){calendarOffset+=Number(target.dataset.calStep||0);calendarDay=null;renderCalendar();return;}
    if(target.matches("[data-cal-today]")){calendarOffset=0;calendarDay=null;renderCalendar();return;}
    if(target.matches("[data-study-retry]")){if(!studyMaterialsView)retryStudyMaterials();return;}
    if(target.matches("[data-retry-games]")){renderGames();return;}
    if(target.matches("[data-game-read]")){const q=activeGameQuestion();if(q&&!studyMaterialsView?.readAloud.read(q.prompt+". "+q.choices.map((choice,i)=>String.fromCharCode(65+i)+". "+choice).join(". ")))toast("Read aloud is unavailable. You can keep practicing.");return;}
    if(target.matches("[data-game-start]")){startStudyGame(target.dataset.gameStart);return;}
    if(target.matches("[data-study-star-goal]")){studyGameEngine()?.selectStudyStarGoal?.(target.dataset.studyStarGoal);renderGames();return;}
    if(target.matches("[data-game-answer]")){answerStudyGame(Number(target.dataset.gameAnswer));return;}
    if(target.matches("[data-game-next]")){advanceStudyGame();return;}
    if(target.matches("[data-game-home]")){leaveStudyGame();return;}
    if(target.matches("[data-game-hint]")){toggleStudyHint();return;}
    if(target.matches("[data-open-games]")){event.preventDefault();activeTab="games";history.replaceState(null,"","#games");gameState.screen="menu";render();return;}
  });
}
$$(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.tab==="study"){markGameComebacksNextSession();gameState.screen="menu"}activeTab=b.dataset.tab;history.replaceState(null,"","#"+activeTab);render();}));
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
function validatePackEnvelope(d,u){
  const p=d?.pack,o=v=>!!v&&typeof v==="object"&&!Array.isArray(v),a=(v,f)=>Array.isArray(v)&&v.every(f),b=()=>{throw Error("Invalid pack "+u)},s=d?.sourceLastSeenAt||p?.sourceCapturedAt||p?.generatedAt,f=p?.schoolChangeFeed;
  if(!o(d)||!o(p)||p.schemaVersion!==2||p.sourceSufficient!==true||!String(p.sourceHash||"").trim()||!String(p.weekLabel||"").trim()||typeof s!=="string"||Number.isNaN(Date.parse(s)))b();
  if(!"subjects importantDates homework lunchMenu lunchArchive vocabulary questions".split(" ").every(k=>a(p[k],o)))b();
  if(!"reminders parentNotices".split(" ").every(k=>a(p[k],v=>typeof v==="string")))b();
  if(!"lunchMenuSource contentPipeline recentReviewPipeline".split(" ").every(k=>o(p[k])))b();
  if(![p.lunchMenuSource.sourcePages,p.contentPipeline.skills,p.contentPipeline.questions,p.recentReviewPipeline.skills,p.recentReviewPipeline.questions].every(Array.isArray))b();
  if(f!=null&&(!o(f)||!Array.isArray(f.items)))b();
  return d;
}
async function readPackUrl(url){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(url,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("HTTP "+response.status+" for "+url);
    const data=validatePackEnvelope(await response.json(),url);
    return{response,data};
  }finally{clearTimeout(timeout)}
}
function promotePackCandidate({response,data}){
  const previous={envelope,pack,derivedPackCache,studyGameCatalogCache,lastPackFetchAt,lastPackFetchUsedCache,selectedDay,calendarDay};
  const before=packContentKey(envelope),after=packContentKey(data),changed=!!before&&before!==after;
  try{
    envelope=data;pack=data.pack;derivedPackCache=null;
    if(changed)studyGameCatalogCache=null;
    lastPackFetchUsedCache=response.headers.get("x-abvm-cache-fallback")==="1";
    if(!before||changed)render({preserveScroll:!!before});
    else updateFreshnessUI();
  }catch(error){
    ({envelope,pack,derivedPackCache,studyGameCatalogCache,lastPackFetchAt,lastPackFetchUsedCache,selectedDay,calendarDay}=previous);
    if(pack){try{render({preserveScroll:true})}catch{}}
    throw error;
  }
  lastPackFetchAt=Date.now();
  return changed;
}
async function fetchPack({force=false,notify=false}={}){
  const now=Date.now();
  if(!force&&pack&&(now-lastPackFetchAt)<PACK_REFRESH_MS)return false;
  if(packRefreshPromise)return packRefreshPromise;
  packRefreshPromise=(async()=>{
    try{
      let lastError=null;
      for(const url of [PACK_URL,PACK_FALLBACK_URL]){
        try{
          const changed=promotePackCandidate(await readPackUrl(url));
          if(notify&&changed)toast("School info updated");
          return changed;
        }catch(error){lastError=error}
      }
      throw lastError||new Error("School pack unavailable");
    }finally{packRefreshPromise=null}
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
    if(state.state==="offline")toast("You’re offline. Showing saved school info.");
    else if(changed)toast("School info updated");
    else if(state.state==="current")toast("Latest published school info is loaded");
    else toast("Checked published school info — no newer verified update is available yet.");
  }catch{
    toast("Couldn’t check published school info. Try again.");
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
  const next=location.hash.slice(1)==="progress"?"family":location.hash.slice(1).split("?")[0];
  if(["today","week","calendar","study","games","family"].includes(next)&&next!==activeTab){
    activeTab=next;
    if(next==="games"||next==="study"){markGameComebacksNextSession();gameState.screen="menu"}
    render();
  }
});
window.addEventListener("online",()=>{lastPackFetchUsedCache=false;if(pack)fetchPack({force:true,notify:true}).catch(()=>updateFreshnessUI())});
window.addEventListener("offline",()=>{lastPackFetchUsedCache=true;if(pack)updateFreshnessUI()});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&pack)fetchPack({notify:true}).catch(()=>{});
});
window.addEventListener("pageshow",event=>{
  if(event.persisted&&pack)fetchPack({force:true,notify:true}).catch(()=>{});
});
load();
})();
