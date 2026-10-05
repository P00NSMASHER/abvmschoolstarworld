(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stack=()=>$("#app-content");
let envelope=null, pack=null, activeTab=(["today","week","calendar","study","games","family"].includes(location.hash.slice(1))?location.hash.slice(1):"today"), selectedDay=null, calendarDay=null, weekOffset=0, calendarOffset=0;
let studyGameCatalogCache=null, derivedPackCache=null, studyEnginePromise=null, screenEventsBound=false, lastPackFetchAt=0, packRefreshPromise=null, manualRefreshActive=false, lastPackFetchUsedCache=false, gameState={screen:"menu",mode:null,questions:[],index:0,score:0,streak:0,bestStreak:0,selectedIndex:null,answered:false,hintOpen:false,saved:false,supportMode:false,supportQuestion:null,supportCorrect:null,supportOriginQuestion:null,comebackMode:false,comebackQuestion:null,comebackKey:null,comebackCorrect:null,sourceKey:"",sessionSeed:"",learningEvents:[],comebackSucceeded:false,rewardStatus:"idle",rewardAwarded:0,rewardCurrency:"Study Stars",starBalance:0,rewardRevealAmount:0,rewardRevealScheduled:false,tries:0,misses:0,hints:0,retry:0,lastWrong:null};

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
  Object.freeze({id:"quick",title:"Quick Mix",subjects:[],count:8,copy:"Current school skills mixed into one quick round."}),
  Object.freeze({id:"math",title:"Math Dash",subjects:["Math"],count:8,copy:"Current math first; STAR-style practice fills verified-data gaps."}),
  Object.freeze({id:"words",title:"Word Power",subjects:["Reading / ELA","Spelling / Handwriting"],preferredSkills:["long-short-a","suffix-ed-ing"],count:8,copy:"Current spelling-test, phonics, word-building, and reading skills."}),
  Object.freeze({id:"faith",title:"Faith Quest",subjects:["Religion"],count:8,copy:"Religion practice from the current class material."})
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
  return '<header class="app-header"><div><p>'+esc(kicker)+'</p><h1>'+esc(title)+'</h1></div>'+SCHOOL_LOGO_HTML+'</header>';
}
function freshnessState(){
  const raw=envelope?.sourceLastSeenAt||pack?.sourceCapturedAt||pack?.generatedAt;
  const d=raw?new Date(raw):null;
  if(!d||Number.isNaN(d.getTime()))return{state:"attention",label:"Source verification unavailable"};
  const stamp=FRESH_DATE_FORMATTER.format(d)+" at "+FRESH_TIME_FORMATTER.format(d)+" ET";
  const ageHours=(Date.now()-d.getTime())/3600000;
  if(navigator.onLine===false||lastPackFetchUsedCache)return{state:"offline",label:"Offline · last verified "+stamp};
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
function taskRecordsForSurface(surface){
  return getDerivedPack().homeworkRows.filter(record=>record.policy[surface]!==false);
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
  return '<section class="lunch-card'+(!lunch&&!closed?' lunch-missing':'')+'"><span aria-hidden="true">🍎</span><div><p>SCHOOL LUNCH</p><strong>'+esc(message)+'</strong>'+(sourceNote?'<small>'+esc(sourceNote)+'</small>':'')+'</div></section>';
}
function currentTest(){
  const now=today();
  const row=datedImportantEvents().find(({item,date})=>date>=now&&kindClass(item)==="test");
  return row?{x:row.item,d:row.date}:null;
}
function currentWeekTest(){
  const now=today(),end=weekDays(0)[4];
  const row=datedImportantEvents().find(({item,date})=>date>=now&&date<=end&&kindClass(item)==="test");
  return row?{x:row.item,d:row.date}:null;
}
function nextSpellingTest(){
  const now=today();
  const row=datedImportantEvents().find(({item,date})=>date>=now&&kindClass(item)==="test"&&/spelling|handwriting/i.test(item.label||""));
  return row?{x:row.item,d:row.date}:null;
}
function testReadyMode(){return studyGameEngine()?.testReadyMode?.(pack,currentWeekTest())||null}
function availableStudyGameModes(){const test=testReadyMode();return test?[test,...STUDY_GAME_MODES]:STUDY_GAME_MODES}
function currentOrSoonStarAssessment(){
  const now=today(),weekMs=7*24*60*60*1000;
  const row=datedImportantEvents().find(({item,range})=>
    /\bSTAR\b/i.test(item.label||"")&&range[1]>=now&&range[0].getTime()-now.getTime()<=weekMs);
  return row?{x:row.item,range:row.range}:null;
}
function subjectByName(name){return getDerivedPack().subjects.get(name.toLowerCase())||null;}
function readingSubject(){return subjectByName("Reading / ELA");}
function religionSubject(){return subjectByName("Religion");}
function mathSubject(){return subjectByName("Math");}
function spellingSubject(){return subjectByName("Spelling / Handwriting");}
function readingRoutine(){return subjectByName("Reading Routine")?.topics?.[0]||"Read for 20 minutes every day.";}

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

function studyGameIconHtml(modeId){
  const icons={
    quick:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icon-fill" d="m24 6 5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L24 33.1l-10.6 5.6 2-11.8-8.6-8.4 11.9-1.7L24 6Z"/><path class="icon-spark" d="M37.5 7.5v6M34.5 10.5h6"/></svg>',
    math:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="icon-outline" x="9" y="6.5" width="30" height="35" rx="6"/><rect class="icon-screen" x="14" y="11" width="20" height="7" rx="2.5"/><path class="icon-stroke" d="M16 26h7M19.5 22.5v7M28 26h6M16 34h7M28 34h6"/></svg>',
    words:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icon-book" d="M7.5 11.5c5.5-1.4 10.5-.6 16.5 3.1v24c-5.7-3.5-11-4.3-16.5-2.7V11.5Z"/><path class="icon-book" d="M40.5 11.5c-5.5-1.4-10.5-.6-16.5 3.1v24c5.7-3.5 11-4.3 16.5-2.7V11.5Z"/><text class="icon-letter" x="13" y="27">A</text><text class="icon-letter small" x="29" y="29">a</text></svg>',
    faith:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="icon-halo" cx="24" cy="24" r="18"/><path class="icon-cross" d="M24 12v24M17 20h14"/><path class="icon-ray" d="M10 12l3 3M38 12l-3 3M9 31l4-2M39 31l-4-2"/></svg>',
    "test-ready":'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="10" y="8" width="28" height="32" rx="5"/><path d="M17 17h14M17 24h8M17 31h5M28 30l3 3 6-7"/></svg>'
  };
  return '<span class="study-game-icon game-icon-'+esc(modeId)+'" aria-hidden="true">'+(icons[modeId]||icons.quick)+'</span>';
}

function renderToday(){
  const d=today(), events=eventItemsForDate(d), lunch=lunchForDate(d);
  const priority=datedImportantEvents().find(({item,date})=>date>=d&&(kindClass(item)==="test"||/\b(?:deadline|due)\b/i.test((item.kind||"")+" "+item.label)));
  const next=priority?{x:priority.item,d:priority.date}:currentTest();
  let timeline=events.map(e=>'<div class="timeline-row"><time>'+(kindClass(e)==="closed"?"Closed":"School")+'</time><span class="timeline-pin '+kindClass(e)+'"></span><div><strong>'+esc(e.label)+'</strong>'+(e.kind?'<small>'+esc(e.kind)+'</small>':'')+'</div><i></i></div>').join("");
  if(!timeline) timeline='<div class="timeline-row"><time>School</time><span class="timeline-pin family"></span><div><strong>No special school events are listed for this date.</strong></div></div>';
  const tasks=taskRecordsForSurface("today");
  const schoolUpdates=upcomingReminderTexts(d,3);
  const html='<div class="screen today-screen" role="region" aria-label="Today">'+
    header("ABVM GRADE 2", "Today")+
    freshness()+
    window.ABVMSchoolUpdates.banner(pack)+
    '<section class="hero-card"><div class="hero-copy"><p class="pill">YOUR SCHOOL DAY</p><h2>One thing at a time.</h2><p>Your next deadline, daily plan, and school updates.</p></div><div class="hero-brand" role="img" aria-label="Assumption BVM Catholic School"><span class="hero-brand-mark"><img src="./assets/abvm-app-icon-192.png" srcset="./assets/abvm-app-icon-192.png 192w, ./assets/abvm-app-icon-512.png 512w" sizes="(min-width:700px) 118px, (max-width:370px) 62px, 76px" width="118" height="118" alt=""></span><strong>ASSUMPTION</strong><b>BVM</b><small>FAITH AND EDUCATION</small></div></section>'+
    '<div class="section-heading today-priority-heading"><h2><span class="heading-dot pink"></span>Up next</h2></div>'+
    (next?'<section class="priority-card"><div class="date-tile"><strong>'+esc(WEEKDAY[next.d.getDay()].slice(0,3).toUpperCase())+'</strong><span>'+next.d.getDate()+'</span></div><div><p>'+(kindClass(next.x)==="due"?"NEXT DEADLINE":"NEXT TEST")+'</p><h3>'+esc(next.x.label)+'</h3><span>'+(kindClass(next.x)==="due"?"Plan ahead for this date.":"Keep review short and focused.")+'</span></div></section>':'<section class="priority-card"><div class="date-tile"><strong>★</strong><span>✓</span></div><div><p>UP NEXT</p><h3>No upcoming test is currently listed</h3><span>Keep up with the posted homework and reading routine.</span></div></section>')+
    '<div class="section-heading today-date-heading"><h2><span class="heading-dot blue"></span>'+esc(fmtDate(d))+'</h2></div>'+
    '<section class="today-panel"><div class="timeline">'+timeline+'</div><div class="task-list">'+tasks.map(({item,index})=>taskHtml(item,index)).join("")+'</div></section>'+
    (schoolUpdates.length?'<section class="future-card today-updates-card"><h3>School updates</h3>'+schoolUpdates.map(x=>'<div><span>UP NEXT</span><p>'+linkedTextHtml(x)+'</p></div>').join("")+'</section>':'')+
    lunchCardHtml(d,lunch)+
    '</div>';
  stack().innerHTML=html;
}

function renderWeek(){
  const days=weekDays();
  if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=weekOffset===0?(days.find(d=>sameDay(d,today()))||days[0]):days[0];
  const events=eventItemsForDate(selectedDay), lunch=lunchForDate(selectedDay), closed=events.some(e=>kindClass(e)==="closed");
  const picker=days.map(d=>'<button type="button" class="'+(sameDay(d,selectedDay)?"active":"")+'" data-day="'+d.toISOString()+'" aria-label="'+esc(fmtDate(d))+'" aria-pressed="'+(sameDay(d,selectedDay)?"true":"false")+'"><span>'+WEEKDAY[d.getDay()].slice(0,3)+'</span><strong>'+d.getDate()+'</strong></button>').join("");
  const eventRows=events.length?events.map(e=>'<div class="event-row"><time>'+esc((e.kind||"School").replace(/\b\w/g,m=>m.toUpperCase()))+'</time><div><strong>'+esc(e.label)+'</strong></div></div>').join(""):'<div class="event-row"><time>School</time><div><strong>No special school events are listed.</strong></div></div>';
  const sourceWeek=isPackWeek(days), tasks=sourceWeek?(pack?.homework||[]):[];
  const checklist=tasks.length?tasks.map(taskHtml).join(""):'<div class="week-empty"><strong>No checklist has been verified for this week yet.</strong><span>Calendar dates still appear below, and new homework will show here after the school source refreshes.</span></div>';
  const future=datedImportantEvents().filter(({date})=>date>selectedDay).slice(0,4).map(({item,date})=>({x:item,d:date}));
  const reminder=reminderForDate(selectedDay);
  stack().innerHTML='<div class="screen week-screen" role="region" aria-label="This week">'+
    header("YOUR SCHOOL PLAN","This week")+freshness()+
    '<nav class="week-nav" aria-label="Change displayed week"><button type="button" data-week-step="-1" aria-label="Previous week">‹</button><div aria-live="polite"><span>'+(weekOffset===0?([0,6].includes(today().getDay())?"COMING SCHOOL WEEK":"CURRENT WEEK"):"VIEWING WEEK")+'</span><strong>'+esc(weekRangeLabel(days))+'</strong></div><button type="button" data-week-step="1" aria-label="Next week">›</button></nav>'+
    (weekOffset!==0?'<button class="week-today-jump" type="button" data-week-today>Back to this week</button>':'')+
    '<div class="day-picker">'+picker+'</div>'+
    '<div class="week-main"><section class="day-detail green"><div class="day-detail-title"><div><p>'+MONTHS[selectedDay.getMonth()].toUpperCase()+'</p><h2>'+esc(fmtDate(selectedDay))+'</h2></div><span>'+(closed?"No school":"School day")+'</span></div><div class="event-stack">'+eventRows+'</div><h3>My checklist</h3>'+checklist+'</section><div class="week-rail">'+
    lunchCardHtml(selectedDay,lunch)+
    (reminder?'<section class="reminder-strip"><span>!</span><p><strong>Don’t forget</strong>'+esc(reminder)+'</p></section>':'')+
    '<section class="future-card"><h3>Coming soon</h3>'+future.map(o=>'<div><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join("")+'</section></div></div>'+
    '</div>';
}
function monthGrid(year,month){
  const first=new Date(year,month,1,12), last=new Date(year,month+1,0,12), blanks=first.getDay();
  let html=""; for(let i=0;i<blanks;i++)html+='<span class="calendar-blank"></span>';
  for(let day=1;day<=last.getDate();day++){
    const d=new Date(year,month,day,12), events=eventItemsForDate(d), lunch=lunchForDate(d);
    const dots=[...new Set([...events.map(e=>kindClass(e)),...(lunch?["lunch"]:[])])].slice(0,3);
    const weekend=[0,6].includes(d.getDay()), closed=events.some(e=>kindClass(e)==="closed");
    const eventLabel=events.length?": "+events.map(e=>e.label).join(", "):"";
    html+='<button type="button" class="'+(weekend?"weekend ":"")+(closed?"closed ":"")+(calendarDay&&sameDay(d,calendarDay)?"active":"")+'" data-cal-day="'+d.toISOString()+'" aria-label="'+esc(fmtDate(d)+eventLabel)+'" aria-pressed="'+(calendarDay&&sameDay(d,calendarDay)?"true":"false")+'"><strong>'+day+'</strong><span class="calendar-dots" aria-hidden="true">'+dots.map(k=>'<i class="'+k+'"></i>').join("")+'</span></button>';
  }
  return html;
}
function agendaLunchHtml(date,lunch){
  const events=eventItemsForDate(date),closed=events.some(e=>kindClass(e)==="closed"),weekend=[0,6].includes(date.getDay());
  const text=closed||weekend||lunch?.status==="no-school"?"No school lunch":lunch?lunchText(lunch):lunchUnavailableText(date);
  return '<div class="agenda-lunch'+(lunch?"":" is-missing")+'"><span>🍎</span><div><b>Lunch</b><p>'+esc(text)+'</p></div></div>';
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
    header("SCHOOL MONTH AT A GLANCE",MONTHS[m]+" "+y)+freshness()+
    '<nav class="calendar-month-nav" aria-label="Change calendar month"><button type="button" data-cal-step="-1" aria-label="Previous month">‹</button><div aria-live="polite"><strong>'+MONTHS[m]+' '+y+'</strong><span>'+(calendarOffset===0?"Current month":"Browsing calendar")+'</span></div><button type="button" data-cal-step="1" aria-label="Next month">›</button></nav>'+
    (calendarOffset!==0?'<button type="button" class="calendar-today-jump" data-cal-today>Back to current month</button>':'')+
    '<section class="calendar-card"><div class="calendar-title-row"><div><p>MONTH VIEW</p><h2>'+MONTHS[m]+'</h2></div><span>Tap any date</span></div><div class="calendar-weekdays">'+["S","M","T","W","T","F","S"].map(x=>"<span>"+x+"</span>").join("")+'</div><div class="calendar-grid">'+monthGrid(y,m)+'</div><div class="calendar-legend"><span><i class="test"></i>Test</span><span><i class="faith"></i>Faith</span><span><i class="family"></i>Family</span><span><i class="due"></i>Due</span><span><i class="lunch"></i>Lunch</span></div></section>'+
    '<section class="calendar-day-card" aria-live="polite"><div class="calendar-day-heading"><div><p>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</p><h2>'+MONTHS[calendarDay.getMonth()]+" "+calendarDay.getDate()+'</h2></div></div>'+
      (events.length?'<div class="calendar-event-list">'+events.map(e=>'<div><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong></span></div>').join("")+'</div>':'<p class="calendar-empty">No special school events are listed for this date.</p>')+
      agendaLunchHtml(calendarDay,lunch)+
    '</section>'+
    compactMonthCardHtml(m,monthSummary,"current-month-summary")+
    '<section class="specials-card"><div class="specials-head"><span class="specials-mark" aria-hidden="true">★</span><div><p>WEEKLY ROTATION</p><h2>Specials</h2></div></div><div class="specials-list">'+specials.map(row=>'<div class="special-row"><span>'+esc(row.day)+'</span><strong>'+esc(row.label)+'</strong></div>').join("")+'</div></section>'+
    compactMonthCardHtml(nextM,nextMonth,"next-month-card")+
    '</div>';
}
const studyNotes=subject=>window.ABVMStudyPractice.notes(subject);
const subjectPracticeHtml=key=>window.ABVMStudyPractice.html(key);
function subjectCard(id,klass,title,subject,key=klass){
  const notes=studyNotes(subject);
  return '<details id="'+id+'" class="subject-card study-accordion '+klass+'"><summary><span><small>'+esc(title.toUpperCase())+'</small><strong>'+esc(title)+'</strong></span><b aria-hidden="true">+</b></summary>'+(notes.length?'<ul>'+notes.map(n=>'<li>✓ '+esc(n)+'</li>').join("")+'</ul>':subjectPracticeHtml(key))+'</details>';
}
function wordSubjectCard(id,klass,title,words,key){
  const clean=words.filter(w=>typeof w==="string"&&w.trim());
  return '<details id="'+id+'" class="subject-card study-accordion '+klass+'"><summary><span><strong>'+esc(title)+'</strong></span><b aria-hidden="true">+</b></summary>'+(clean.length?'<div class="'+(key==="sight"?'sight-cloud':'word-grid')+'">'+clean.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div>':subjectPracticeHtml(key))+'</details>';
}
function weeklyLearningDashboardHtml(){
  let learning={};
  try{const parsed=JSON.parse(storageGet("abvm-study-learning:v2")||"{}");if(parsed&&typeof parsed==="object")learning=parsed}catch{}
  return window.ABVMWeeklyLearning?.render({pack,learning,now:Date.now(),timeZone:SCHOOL_TIME_ZONE})||"";
}
function renderStudy(){
  const r=readingSubject(), rel=religionSubject(), math=mathSubject(), spell=spellingSubject(), next=currentWeekTest(), spellingTest=nextSpellingTest(), star=currentOrSoonStarAssessment();
  const essentials=[
    ["Daily",readingRoutine()],
    next?[fmtShort(next.d),next.x.label]:["This week","Keep up with current class skills"],
    ...(spellingTest?[ [fmtShort(spellingTest.d),"Spelling / Handwriting review"] ]:[])
  ];
  const sight=(r?.topics||[]).find(x=>/^Sight words:/i.test(x))?.replace(/^Sight words:\s*/i,"").split(",").map(x=>x.trim()).filter(Boolean)||[];
  const vocab=(pack?.vocabulary||[]).map(v=>v.term);
  stack().innerHTML='<div class="screen study-screen" role="region" aria-label="Study room">'+
    header("STUDY","Study room")+
    '<section class="study-at-a-glance"><div class="quick-look-head"><span class="quick-look-mark" aria-hidden="true">✓</span><div><p>START HERE</p><h2>What matters this week</h2></div></div><ol>'+essentials.map(x=>'<li><time>'+esc(x[0])+'</time><span>'+esc(x[1])+'</span></li>').join("")+'</ol></section>'+
    '<a class="study-games-cta" href="#games" data-open-games><span>★</span><div><small>5–10 MINUTES</small><strong>Practice with Study Games</strong><p>Current school skills with hints and explanations.</p></div><b aria-hidden="true">›</b></a>'+
    weeklyLearningDashboardHtml()+
    '<div class="study-section-label"><p>SUBJECT DETAILS</p><span>Tap a subject only when you need it.</span></div>'+
    subjectCard("study-religion","religion",rel?.subject||"Religion",rel)+
    subjectCard("study-reading","reading","Reading",r)+
    subjectCard("study-math","math","Math",math)+
    subjectCard("study-spelling","spelling","Spelling and phonics",spell)+
    wordSubjectCard("study-sight","sight","Sight words",sight,"sight")+
    wordSubjectCard("study-vocabulary","reading","Words to know",vocab,"vocabulary")+
    (star?'<section class="calm-card compact"><h3>STAR reminder</h3><p>Normal reading, calm practice, and a good night’s sleep are enough.</p></section>':'')+
    '</div>';
}
function studyGameEngine(){return window.ABVMStudyGames||null}
function ensureStudyGameEngine(){
  if(window.ABVMStudyGames&&window.ABVMStudyGameView)return Promise.resolve(window.ABVMStudyGames);
  if(studyEnginePromise)return studyEnginePromise;
  const load=(src,key)=>window[key]?Promise.resolve():new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>window[key]?resolve():reject(new Error(key+" did not initialize"));s.onerror=()=>reject(new Error(key+" could not be loaded"));document.head.append(s)});
  studyEnginePromise=Promise.all([load("./study-games.js?v=93","ABVMStudyGames"),load("./study-games-view.js?v=6","ABVMStudyGameView")]).then(()=>window.ABVMStudyGames).catch(error=>{studyEnginePromise=null;throw error;});
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
function gameMode(id){return availableStudyGameModes().find(mode=>mode.id===id)||availableStudyGameModes()[0]}
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
function scheduleGameComeback(origin){const e=studyGameEngine(),c=studyGameCatalog(),s=gameState.sourceKey||currentGameSourceKey();return e?.scheduleComeback?.(c,origin,{sourceKey:s,remaining:3,seenIds:gameState.questions.slice(0,gameState.index+1).map(q=>q.id),seed:s+"|comeback|"+String(origin?.id||"item")})||null}
function tickGameComebacks(){studyGameEngine()?.tickComebacks?.(gameState.sourceKey||currentGameSourceKey())}
function markGameComebacksNextSession(){studyGameEngine()?.deferComebacksToNextSession?.(gameState.sourceKey||currentGameSourceKey())}
function activateDueGameComeback(){const due=studyGameEngine()?.dueComeback?.(studyGameCatalog(),gameState.sourceKey||currentGameSourceKey());if(!due)return false;Object.assign(gameState,{comebackMode:true,comebackQuestion:due.question,comebackKey:due.row.key,comebackCorrect:null,selectedIndex:null,answered:false,hintOpen:false,learningRow:null,tries:0,misses:0,hints:0,retry:0,lastWrong:null});return true}
function clearActiveGameComeback(){studyGameEngine()?.resolveComeback?.(gameState.comebackKey);Object.assign(gameState,{comebackMode:false,comebackQuestion:null,comebackKey:null,comebackCorrect:null})}
function activeGameQuestion(){return gameState.comebackMode?gameState.comebackQuestion:gameState.supportMode?gameState.supportQuestion:gameState.questions[gameState.index]}
function startStudyGame(modeId){
  const engine=studyGameEngine(),catalog=studyGameCatalog(),mode=gameMode(modeId);
  if(!engine||!catalog)return;
  const sourceKey=currentGameSourceKey(),sessionSeed=engine.nextSessionSeed?.(sourceKey,mode.id)||"session";
  const questions=engine.selectQuestions(catalog,{subjects:mode.subjects,skills:mode.skills||[],preferredSkills:mode.preferredSkills||[],count:mode.count,seed:sessionSeed,skillStats:engine.loadLearning?.()||{}});
  gameState={screen:"play",mode:mode.id,questions,index:0,score:0,streak:0,bestStreak:0,selectedIndex:null,answered:false,hintOpen:false,saved:false,learningRow:null,supportMode:false,supportQuestion:null,supportCorrect:null,supportOriginQuestion:null,comebackMode:false,comebackQuestion:null,comebackKey:null,comebackCorrect:null,sourceKey,sessionSeed,learningEvents:[],comebackSucceeded:false,rewardStatus:"idle",rewardAwarded:0,rewardCurrency:"Study Stars",starBalance:0,rewardRevealAmount:0,rewardRevealScheduled:false,tries:0,misses:0,hints:0,retry:0,lastWrong:null};
  activateDueGameComeback();
  renderGames();bindScreen();
}
function noteRoundLearning(g,q,kind,correct,independent=false){
  const skill=String(q?.skill||"").trim();if(!skill)return;
  if(!Array.isArray(g.learningEvents))g.learningEvents=[];
  if(kind!=="support")g.learningEvents.push({skill,kind,correct:!!correct,independent:!!independent});
  if(kind==="comeback"&&correct)g.comebackSucceeded=true;
}
function answerStudyGame(index){
  const g=gameState,q=activeGameQuestion(),choice=q?.choices?.[index];if(g.screen!=="play"||g.answered||choice===undefined)return;
  const correct=choice===q.answer,e=studyGameEngine();e?.note?.(q,index);g.tries=(g.tries||0)+1;g.selectedIndex=index;g.hintOpen=false;
  if(g.comebackMode){g.answered=true;g.learningRow=e?.recordComeback?.(q,correct)||null;g.comebackCorrect=correct;noteRoundLearning(g,q,"comeback",correct,false)}
  else if(g.supportMode){g.answered=true;g.learningRow=e?.recordSupport?.(q,correct)||null;g.supportCorrect=correct}
  else if(correct){g.answered=true;g.retry=0;g.learningRow=e?.recordLearning?.(q,true,{attemptCount:g.tries,incorrectCount:g.misses,hintCount:g.hints})||null;noteRoundLearning(g,q,q.tier==="recent-review"?"review":"normal",true,g.learningRow?.LastResolution?.independent===true);g.score++;g.streak++;g.bestStreak=Math.max(g.bestStreak,g.streak)}
  else{g.misses=(g.misses||0)+1;g.lastWrong=index;g.streak=0;if(g.misses<3){g.retry=g.misses;g.selectedIndex=null}else{g.answered=true;g.retry=3;g.learningRow=e?.recordLearning?.(q,false,{attemptCount:g.tries,incorrectCount:g.misses,hintCount:g.hints})||null;noteRoundLearning(g,q,q.tier==="recent-review"?"review":"normal",false,false)}}
  renderGames();bindScreen()
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
  Promise.resolve(e.commitStudyStarRewards({sourcePack:sourceKey,mode:g.mode,sessionSeed:g.sessionSeed,roundId,completed:true,comebackSucceeded:!!g.comebackSucceeded}))
    .then(async result=>{
      const balance=await e.studyStarBalance();
      if(gameState!==g)return;
      g.rewardStatus="done";g.rewardAwarded=Number(result?.awardedAmount)||0;g.rewardCurrency=String(result?.currency||"Study Stars");g.starBalance=Math.max(0,Number(balance)||0);g.rewardRevealAmount=g.rewardAwarded;g.rewardRevealScheduled=false;
      renderGames();bindScreen();
    })
    .catch(()=>{if(gameState===g){g.rewardStatus="error";renderGames();bindScreen();}});
}
function finishStudyGame(){
  const g=gameState;markGameComebacksNextSession();g.screen="finish";saveGameRecord();settleStudyStarRewards(g);
}
function advanceStudyGame(){
  const g=gameState;if(!g.answered)return;
  const reset=()=>Object.assign(g,{selectedIndex:null,answered:false,hintOpen:false,learningRow:null,tries:0,misses:0,hints:0,retry:0,lastWrong:null});
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
  if(!correct&&(g.learningRow?.ConsecutiveWrong||0)>=2){
    const engine=studyGameEngine(),catalog=studyGameCatalog(),support=engine?.supportQuestion(catalog,current,{skillStats:engine?.loadLearning?.()||{},seed:String(catalog?.sourceKey||"current")+"|support|"+String(current?.id||"item")+"|"+String(g.learningRow?.Seen||0)});
    if(support){Object.assign(g,{supportMode:true,supportQuestion:support,supportCorrect:null,supportOriginQuestion:current});reset();renderGames();bindScreen();return}
  }
  if(g.index>=g.questions.length-1){finishStudyGame()}
  else{g.index++;tickGameComebacks();reset();activateDueGameComeback()}
  renderGames();bindScreen()
}
function leaveStudyGame(){gameState.screen="menu";renderGames();bindScreen()}
function toggleStudyHint(){const g=gameState;if(g.screen==="play"&&!g.answered){g.hintOpen=!g.hintOpen;if(g.hintOpen)g.hints=(g.hints||0)+1;renderGames();bindScreen()}}
function gameMenuHtml(catalog){
  const modes=availableStudyGameModes();
  return '<section class="study-games-hero simple"><div class="study-games-mascot">★</div><div><p>SMART PRACTICE</p><h2>Pick a game and start</h2><span>Questions prioritize current school skills, then recent verified review, then original Grade 2 STAR-style practice when a subject still has a gap.</span></div></section>'+
    '<div class="study-game-grid">'+modes.map(mode=>{
      const record=loadGameRecord(mode.id),total=gameModeQuestionTotal(catalog,mode),disabled=total===0;
      return '<button type="button" class="study-game-tile game-'+mode.id+'" data-game-start="'+esc(mode.id)+'"'+(disabled?' disabled aria-disabled="true"':'')+'>'+studyGameIconHtml(mode.id)+'<span class="study-game-copy"><strong>'+esc(mode.title)+'</strong><small>'+esc(mode.copy)+'</small>'+(disabled?'<em>Not ready yet</em>':record.plays?'<em>Best '+record.best+' / '+total+'</em>':'')+'</span><b aria-hidden="true">›</b></button>';
    }).join("")+'</div>'+
    '<p class="game-privacy-note">Practice prioritizes verified school skills. STAR-style fallback uses original Grade 2 practice, not copied STAR test items; private student answers and grades are not used.</p>';
}
function gamePlayHtml(){const g=gameState,q=activeGameQuestion(),e=studyGameEngine();if(q)e?.markQuestionShown?.(q,g.sourceKey||currentGameSourceKey());return window.ABVMStudyGameView.play({g,mode:gameMode(g.mode),q,teach:g.supportMode?e?.teachCardFor?.(q):null,retryInstruction:e?.teachCardFor?.(q)?.instruction,labels:GAME_TYPE_LABELS})}
function gameFinishHtml(){
  const g=gameState,e=studyGameEngine(),v=window.ABVMStudyGameView;
  const summary=e?.learningFirstSummary?.(g.learningEvents)||{strong:0,remembered:0,practice:0,total:0};
  const reward={status:g.rewardStatus,awardedAmount:g.rewardAwarded,currency:g.rewardCurrency,balance:g.starBalance};
  const reveal=g.rewardRevealAmount>0?v.rewardReveal({amount:g.rewardRevealAmount,currency:g.rewardCurrency}):"";
  const finish=v.finish({mode:gameMode(g.mode),state:g,record:loadGameRecord(g.mode,g.sourceKey||currentGameSourceKey()),summary,reward});
  const goal=g.rewardStatus==="done"?v.goal({state:e.studyStarGoalProgress(g.starBalance)}):"";
  return reveal+finish+goal;
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
  if(gameState.screen==="finish"&&gameState.rewardRevealAmount>0&&!gameState.rewardRevealScheduled){
    const round=gameState;round.rewardRevealScheduled=true;
    setTimeout(()=>{if(gameState!==round)return;round.rewardRevealAmount=0;stack().querySelector("[data-reward-reveal]")?.remove()},1200);
  }
}

function renderFamily(){
  const weekEnd=weekDays()[4],todayDate=today();
  const tests=new Set(datedImportantEvents()
    .filter(({item,date})=>kindClass(item)==="test"&&date>=todayDate&&date<=weekEnd)
    .map(({date})=>isoDateKey(date))).size;
  const notices=currentNoticeTexts();
  const homeworkActions=taskRecordsForSurface("family").map(({item})=>item.task);
  const actions=[...new Set([...homeworkActions,...upcomingReminderTexts(today(),6)])].slice(0,6);
  stack().innerHTML='<div class="screen family-screen" role="region" aria-label="Family dashboard">'+
    header("FAMILY","Family dashboard")+freshness()+
    '<section class="family-hero compact"><p>THIS WEEK</p><h2>What needs attention</h2><span>Current school actions and notices in one place.</span></section>'+
    '<div class="family-stats"><div><strong>'+tests+'</strong><span>test days</span></div><div><strong>'+actions.length+'</strong><span>current actions</span></div></div>'+
    window.ABVMSchoolUpdates.card(pack)+
    '<section class="parent-card family-actions-card"><div class="family-actions-head"><span class="family-actions-mark" aria-hidden="true">✓</span><div><small>TO DO</small><h3>Family actions</h3></div></div><ul>'+actions.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>'+
    '<section class="parent-card sources notices-card" aria-labelledby="family-current-notices"><div class="notices-head"><span class="notices-mark" aria-hidden="true">i</span><div><small>SCHOOL UPDATES & SIGN-UPS</small><h3 id="family-current-notices">Current notices</h3></div></div><div class="static-notice-list" role="list">'+notices.map(x=>'<div class="notice-row" role="listitem"><span class="status ok" aria-hidden="true"></span><p>'+linkedTextHtml(x)+'</p></div>').join("")+'</div></section>'+
    (window.ABVMWeeklyLearning?.renderChanges?.(pack?.schoolChangeFeed)||"")+
    '<details class="family-more"><summary><span>App & privacy</span><b aria-hidden="true">+</b></summary><div><p>Study-game progress stays on this device. No student IDs or private classmates’ information are used.</p><a href="#games" data-open-games>Open Study Games</a><p>Verified shows the last successful source check; individual notices may be older.</p><p>To install on iPhone, use Safari’s Share menu → Add to Home Screen.</p></div></details>'+
    '<p class="unofficial-note">Family planning tool based on current ABVM Grade 2 sources.</p>'+
    '</div>';
}
function render({preserveScroll=false}={}){
  if(!pack)return;
  const pending=window.ABVMSchoolUpdates.state(pack).unread.length;
  const familyTab=document.querySelector('.bottom-nav [data-tab="family"]');
  familyTab?.setAttribute("data-has-updates",pending?"true":"false");
  familyTab?.setAttribute("aria-description",pending?pending+" unread school updates":"");
  const scrollTop=stack().querySelector(".screen")?.scrollTop||0;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderStudy,games:renderGames,family:renderFamily}[activeTab]||renderToday)();
  const navTab=activeTab==="games"?"study":activeTab;
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
    if(target.matches("[data-open-family]")){activeTab="family";history.replaceState(null,"","#family");render();return;}
    if(target.matches("[data-mark-updates-read]")){const saved=window.ABVMSchoolUpdates.markRead(pack);render({preserveScroll:true});toast(saved?"Updates marked as read":"Could not save read status on this device");return;}
    if(target.matches("[data-refresh-pack]")){manualRefreshSchoolInfo();return;}
    if(target.matches("[data-check]")){toggleChecked((pack.homework||[])[Number(target.dataset.check)],Number(target.dataset.check));return;}
    if(target.matches("[data-day]")){selectedDay=new Date(target.dataset.day);renderWeek();return;}
    if(target.matches("[data-week-step]")){weekOffset+=Number(target.dataset.weekStep||0);selectedDay=null;renderWeek();return;}
    if(target.matches("[data-week-today]")){weekOffset=0;selectedDay=null;renderWeek();return;}
    if(target.matches("[data-cal-day]")){calendarDay=new Date(target.dataset.calDay);renderCalendar();return;}
    if(target.matches("[data-cal-step]")){calendarOffset+=Number(target.dataset.calStep||0);calendarDay=null;renderCalendar();return;}
    if(target.matches("[data-cal-today]")){calendarOffset=0;calendarDay=null;renderCalendar();return;}
    if(target.matches("[data-subject-practice]")){
      const mode=target.dataset.subjectPractice;target.disabled=true;
      try{await ensureStudyGameEngine();if(!target.isConnected||activeTab!=="study")return;activeTab="games";history.replaceState(null,"","#games");startStudyGame(mode);render();}
      catch{target.disabled=false;toast("Practice could not load. Please try again.");}
      return;
    }
    if(target.matches("[data-game-start]")){startStudyGame(target.dataset.gameStart);return;}
    if(target.matches("[data-study-star-goal]")){studyGameEngine()?.selectStudyStarGoal?.(target.dataset.studyStarGoal);renderGames();return;}
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
async function readPackUrl(url){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(url,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("HTTP "+response.status+" for "+url);
    const data=await response.json();
    if(!data?.pack?.sourceSufficient)throw new Error("Incomplete pack from "+url);
    return{response,data};
  }finally{clearTimeout(timeout)}
}
async function fetchPack({force=false,notify=false}={}){
  const now=Date.now();
  if(!force&&pack&&(now-lastPackFetchAt)<PACK_REFRESH_MS)return false;
  if(packRefreshPromise)return packRefreshPromise;
  packRefreshPromise=(async()=>{
    try{
      let loaded=null,lastError=null;
      for(const url of [PACK_URL,PACK_FALLBACK_URL]){
        try{loaded=await readPackUrl(url);break}catch(error){lastError=error}
      }
      if(!loaded)throw lastError||new Error("School pack unavailable");
      const {response:r,data}=loaded;
      lastPackFetchUsedCache=r.headers.get("x-abvm-cache-fallback")==="1";
      const before=packContentKey(envelope),after=packContentKey(data),changed=!!before&&before!==after;
      envelope=data;pack=data.pack;derivedPackCache=null;lastPackFetchAt=Date.now();
      if(changed)studyGameCatalogCache=null;
      if(!before||changed)render({preserveScroll:!!before});
      else updateFreshnessUI();
      if(notify&&changed)toast("School info updated");
      return changed;
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
  const next=location.hash.slice(1);
  if(["today","week","calendar","study","games","family"].includes(next)&&next!==activeTab){
    activeTab=next;
    if(next==="games")gameState.screen="menu";
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
